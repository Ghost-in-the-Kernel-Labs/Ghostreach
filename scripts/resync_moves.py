"""The resync's moves for a range of the parent's commits (docs/CUT.md, "The resync recipe"; GR-002, TODO 1.7). A dry run:
it reads the parent's git and docs/CUT.md and changes nothing.

    python3 -I scripts/resync_moves.py <parent git dir> <pin> <target>          # the moves
    python3 -I scripts/resync_moves.py <parent git dir> <pin> <target> --list   # and every file skipped

Each file the parent changed between the two commits is one move: `skip` (not copied), `apply` (a 1:1 copy: the parent's
patch, at the Ghostreach path), `trimmed` (a copy that lost something at 1.2 to 1.4: each hunk said to land or to touch what
was cut), `split` (a `(part)` row: the local file each hunk lands in), `whole` (a generated or binary file: the parent's copy
at the target), `new` (the target's closure reaches a file not copied), `gone` (a listed file the target's closure no longer
reaches), `flag` (an option the parent added that a review would read: fixed at its bare default, P-15). A hunk lands in the
local file holding most of its lines; a hunk none of whose lines is there touches code the cut removed, and is read by hand.
The closing steps (the pin bumped, 1.5 and 1.6 rerun) follow the moves.
"""
import re
import subprocess
import sys
import tarfile
import tempfile
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts import cut_closure  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
# Decision: GR-004 — the parent's paths a copy never comes from (test/unit/cut.test.ts's SUITE_SIDE).
SUITE_SIDE = re.compile(r"^src/(kits|model|targets|bench|truth|theme|guide|sec)/|^src/project/(dock|history|recipe|generate|write)"
                        r"|^src/crawl/(history\.ts|locator-ladder/)")
CARRIED_FROM_MODEL = {"src/model/links-to-look.ts"}
OPTION = re.compile(r"^\s+'?([a-z][a-z0-9-]*)'?: \{ type: '(?:string|boolean)'(.*)\},?$", re.M)
FLAG_WORD = re.compile(r"(?<![\w-])--([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b")
PIN_SITES = ("docs/CUT.md",)


def git(parent: Path, *args: str) -> str:
    """git's output in the parent, read only: git(parent, "rev-parse", "HEAD")."""
    return subprocess.run(["git", "-C", str(parent), *args], capture_output=True, text=True, check=True).stdout


def section(document: str, heading: str) -> str:
    """A `## heading` section of CUT.md, up to the next `## `."""
    match = re.search(rf"^## {re.escape(heading)}\n(.*?)(?=^## |\Z)", document, re.M | re.S)
    return match.group(1) if match else ""


def cut_rows(document: str) -> dict[str, list[dict[str, str]]]:
    """CUT.md's file rows by parent path: {"src/crawl/report.ts": [{"here": "src/leaf/report.ts", "kept": "..."}, ...]}.
    `kept` is "1:1" when the row loses nothing and strips no flag, else "trimmed"; a `(part)` row is "part"."""
    rows: dict[str, list[dict[str, str]]] = {}
    for line in section(document, "The files").splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 5 or not cells[0].startswith("`src/"):
            continue
        parent, here, lines, loses, flags = (c.strip("`") for c in cells)
        kept = "part" if lines == "(part)" else "1:1" if loses == "—" and flags == "—" else "trimmed"
        rows.setdefault(parent, []).append({"here": here, "kept": kept})
    return rows


def resync_block(document: str) -> tuple[set[str], dict[str, str]]:
    """CUT.md's ```resync``` block as (own, into): `own <path>` is Ghostreach's own file under a parent's name;
    `into <parent path> <local path>` is a parent's file carried as part of another local file."""
    match = re.search(r"```resync\n(.*?)```", document, re.S)
    words = [line.split() for line in (match.group(1) if match else "").splitlines() if line.strip()]
    return {w[1] for w in words if w[0] == "own"}, {w[1]: w[2] for w in words if w[0] == "into"}


def trimmed_tests(document: str) -> set[str]:
    """The tests 1.4 trimmed, carried in part or re-pointed: the names of "dropped or trimmed at 1.4"."""
    return {f"test/unit/{name}" for name in re.findall(r"^- `([\w.-]+)`", section(document, "The parent's unit tests: dropped or trimmed at 1.4"), re.M)}


def stripped_flags(document: str) -> set[str]:
    """The flags CUT.md's table says are stripped: {"offline", "max-pages", ...}."""
    return set(re.findall(r"^\| `--([a-z-]+)` \|", section(document, "The flags stripped"), re.M))


def options(text: str) -> dict[str, bool]:
    """The parent's command-line options (src/cli/parse.ts's OPTIONS) and whether a review would read each: one that shapes
    the crawl or applies to the audit. options("  offline: { type: 'boolean', shapesCrawl: true, ...BUILD },") == {"offline": True}."""
    return {m.group(1): "shapesCrawl: true" in m.group(2) or bool(re.search(r"\.\.\.(AUDIT|BOTH|PAID)\b", m.group(2)))
            for m in OPTION.finditer(text)}


def hunks(diff: str) -> list[list[str]]:
    """A unified diff's hunks, each its lines with their mark: [[" kept", "-removed", "+added"], ...]."""
    found: list[list[str]] = []
    for line in diff.splitlines():
        if line.startswith("@@"):
            found.append([])
        elif found and line[:1] in (" ", "-", "+") and not line.startswith(("---", "+++")):
            found[-1].append(line)
    return found


def imports_only(hunk: list[str]) -> bool:
    """Whether every line a hunk adds or removes is an import's: its change is rewritten for the local folder."""
    changed = [line[1:].strip() for line in hunk if line[:1] in "+-"]
    return bool(changed) and all(re.match(r"(import|export) .* from '|import '|\} from '", text) for text in changed)


def added(diff: str) -> list[str]:
    """The lines a diff adds."""
    return [line[1:] for line in diff.splitlines() if line.startswith("+") and not line.startswith("+++")]


def telling(line: str) -> str | None:
    """A line stripped, or None for one that says nothing about where it is (short, punctuation, an import's path)."""
    text = line.strip()
    if len(text) < 6 or not re.search(r"[A-Za-z]{3}", text) or text.startswith(("import ", "} from ", "from ")):
        return None
    return text


def landing(hunk: list[str], candidates: list[str], root: Path) -> tuple[str | None, int]:
    """The local file among candidates holding most of the hunk's telling lines, and how many; (None, 0) when none holds one."""
    lines = {t for t in (telling(line[1:]) for line in hunk) if t}
    best: tuple[str | None, int] = (None, 0)
    for path in candidates:
        local = root / path
        held = {t for t in map(telling, local.read_text(encoding="utf8").splitlines()) if t} if local.is_file() else set()
        score = len(lines & held)
        if score > best[1]:
            best = (path, score)
    return best


def archived_closure(parent: Path, commit: str, document: str) -> dict[str, int]:
    """The cut closure (scripts/cut_closure.py, CUT.md's block) of the parent's src/ at a commit, from `git archive`."""
    entries, cuts = cut_closure.block(document)
    archive = subprocess.run(["git", "-C", str(parent), "archive", commit, "src"], capture_output=True, check=True).stdout
    with tempfile.TemporaryDirectory(prefix="ghostreach-resync-") as folder:
        with tarfile.open(fileobj=BytesIO(archive)) as tar:
            tar.extractall(folder, filter="data")
        present = [e for e in entries if (Path(folder) / e).is_file()]
        files, _ = cut_closure.closure(Path(folder), present, cuts)
    return files


def per_hunk(diff: str, candidates: list[str], root: Path, verb: str) -> list[str]:
    """One line per hunk: where it lands, or that it touches what the cut removed."""
    lines = []
    for n, hunk in enumerate(hunks(diff), 1):
        path, score = landing(hunk, candidates, root)
        if imports_only(hunk):
            lines.append(f"    hunk {n}: imports: the parent's change, its paths rewritten for {candidates[0] if len(candidates) == 1 else 'the file that uses them'} (.js)")
            continue
        lines.append(f"    hunk {n}: {verb} {path} ({score} lines found)" if path else f"    hunk {n}: touches code the cut removed: read by hand")
    return lines


def moves(parent: Path, pin: str, target: str, root: Path = ROOT, listed_skips: bool = False) -> list[str]:
    """The dry run's lines: every move for the parent's pin..target, then the closing steps; the commits as short hashes."""
    pin, target = (git(parent, "rev-parse", "--short=7", f"{c}^{{commit}}").strip() for c in (pin, target))
    document = (root / "docs" / "CUT.md").read_text(encoding="utf8")
    rows, (own, into), trimmed = cut_rows(document), resync_block(document), trimmed_tests(document)
    status = [line.split("\t") for line in git(parent, "diff", "--name-status", "-M", pin, target).splitlines() if line]
    binary = {line.split("\t")[-1] for line in git(parent, "diff", "--numstat", pin, target).splitlines() if line.startswith("-\t-\t")}
    before, after = archived_closure(parent, pin, document), archived_closure(parent, target, document)
    out, skipped, outside = [f"resync {pin}..{target}: {len(status)} files changed in the parent"], [], 0
    for fields in status:
        kind, path = fields[0][0], fields[-1]
        old = fields[1]
        diff = git(parent, "diff", "-M", pin, target, "--", *({old, path}))
        listed = rows.get(old) or rows.get(path)
        if listed:
            heres = [r["here"] for r in listed]
            if kind == "D":
                out.append(f"gone {old}: the parent deleted it; delete {', '.join(heres)} and its rows")
            elif kind == "R":
                out.append(f"moved {old} -> {path}: the row's parent path changes; then its patch as below")
            if kind == "D":
                continue
            if path in binary:
                way = "whole" if all(r["kept"] == "1:1" for r in listed) else "by hand (generated, and the row loses something)"
                out.append(f"{way} {path}: the parent's file at {target} to {heres[0]}")
            elif len(listed) > 1:
                out.append(f"split {path} -> {', '.join(heres)}")
                out += per_hunk(diff, heres, root, "lands in")
            elif listed[0]["kept"] == "trimmed":
                out.append(f"trimmed {path} -> {heres[0]}: each hunk to what the copy kept; its row's losses and flags kept")
                out += per_hunk(diff, heres, root, "applies to")
            else:
                out.append(f"apply {path} -> {heres[0]}: the parent's patch, 1:1")
        elif path.startswith("src/"):
            if path in after and path not in before and not (SUITE_SIDE.search(path) and path not in CARRIED_FROM_MODEL):
                out.append(f"new {path}: the target's closure reaches it; copy it, with a row in CUT.md")
            else:
                skipped.append(path)
        elif path in into:
            out.append(f"trimmed {path} -> {into[path]}: carried as its cases")
            out += per_hunk(diff, [into[path]], root, "applies to")
        elif (root / path).is_file() and path not in own and (path.startswith("test/") or path == "playwright.config.ts"):
            if path in trimmed:
                out.append(f"trimmed {path}: trimmed at 1.4 (its line in CUT.md); each hunk to the cases kept")
                out += per_hunk(diff, [path], root, "applies to")
            else:
                out.append(f"apply {path}: the parent's patch, 1:1")
        else:
            outside += 1
    for path in sorted(set(before) - set(after)):
        if path in rows:
            out.append(f"gone {path}: the target's closure no longer reaches it; delete its copy and rows")
    pin_options = options(git(parent, "show", f"{pin}:src/cli/parse.ts"))
    for name, read in options(git(parent, "show", f"{target}:src/cli/parse.ts")).items():
        if name not in pin_options and read:
            out.append(f"flag --{name}: added to the parent's options and read by a crawl or audit; fix it at its bare default (P-15), a stripped row")
    copied_diff = git(parent, "diff", pin, target, "--", *sorted(p for p in rows if p not in binary))
    for name in sorted(set(FLAG_WORD.findall("\n".join(added(copied_diff)))) - set(pin_options)):
        out.append(f"flag --{name}: a copied file's new line names it; if it is the parent's option, fix it at its bare default (P-15)")
    for name in sorted(set(FLAG_WORD.findall("\n".join(added(copied_diff)))) & stripped_flags(document)):
        out.append(f"strip --{name}: a copied file's new line names a stripped flag; apply that line without it")
    out.append(f"skip {len(skipped)} files of src/ not copied (suite side, cut, or outside the closure)" + "".join(f"\n    {p}" for p in skipped if listed_skips))
    out.append(f"skip {outside} files outside src/ and the carried tests")
    acted = sum(1 for line in out[1:] if not line.startswith(("    ", "skip ")))
    out.append(f"moves {acted}" + ("" if acted else ": nothing to apply"))
    out.append(f"then: the pin {pin} -> {target} in " + ", ".join(PIN_SITES) + "; GR-002's text is Ghost's (owed)")
    out.append("then: rerun 1.5 and 1.6 (CUT.md, the resync recipe): scripts/parent-findings.mjs from the target's archive, "
               "UPDATE_GOLDEN=1 for the page (the parent's code only), the unit project, npx playwright test")
    return out


def main(argv: list[str]) -> int:
    """Prints the moves; 2 on a usage error."""
    words = [a for a in argv if a != "--list"]
    if len(words) != 3 or any(a.startswith("--") for a in words):
        print(__doc__)
        return 2
    print("\n".join(moves(Path(words[0]), words[1], words[2], listed_skips="--list" in argv)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
