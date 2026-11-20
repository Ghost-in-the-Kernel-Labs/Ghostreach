"""The parent's import closure for docs/CUT.md (GR-002): the files the crawl and the audit reach, cut where CUT.md says.

    git -C <parent> archive a4c8045 src | tar -x -C <dir>
    python3 -I scripts/cut_closure.py <dir>            # the closure from CUT.md's entries, severed at its cut points
    python3 -I scripts/cut_closure.py <dir> --before   # the uncut closure from the parent's audit command
    python3 -I scripts/cut_closure.py <dir> --list     # either, with every file and its lines

Reads every static import and `export ... from`, side-effect import, `import()` (a type position's too) and `require()` of
a TypeScript or JavaScript file, and resolves a relative one as the parent's Bundler resolution does (no extension, `.js`
for `.ts`, an index file). A package import (`playwright`, `node:fs`) is not ours and is not followed. The entries and the
cut points are CUT.md's ```cut-closure``` block, one `entry <path>` or `cut <path prefix>` per line, so the document and
the numbers it reports cannot drift apart (REV-02).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BEFORE_ENTRY = "src/cli/commands/audit.ts"
STATIC = re.compile(r"^\s*(?:import|export)\b([^;]*?)\bfrom\s*['\"]([^'\"]+)['\"]", re.M | re.S)
SIDE_EFFECT = re.compile(r"^\s*import\s*['\"]([^'\"]+)['\"]", re.M)
DYNAMIC = re.compile(r"\bimport\(\s*['\"]([^'\"]+)['\"]\s*\)")
REQUIRE = re.compile(r"\brequire\(\s*['\"]([^'\"]+)['\"]\s*\)")
EXTENSIONS = (".ts", ".tsx", ".mts", ".js", ".mjs", ".json")


def specifiers(text: str) -> list[tuple[str, str]]:
    """Every import a file's text makes, as (specifier, kind), kind one of type, value, side, dynamic, require:
    specifiers("import type { A } from './a';") == [("./a", "type")]."""
    found = []
    for match in STATIC.finditer(text):
        clause = match.group(1)
        names = re.search(r"\{([^}]*)\}", clause)
        parts = [p.strip() for p in names.group(1).split(",") if p.strip()] if names else []
        only_types = bool(parts) and not clause.split("{")[0].strip().rstrip(",") and all(p.startswith("type ") for p in parts)
        found.append((match.group(2), "type" if re.match(r"\s*type\b", clause) or only_types else "value"))
    found += [(m.group(1), "side") for m in SIDE_EFFECT.finditer(text)]
    found += [(m.group(1), "dynamic") for m in DYNAMIC.finditer(text)]
    found += [(m.group(1), "require") for m in REQUIRE.finditer(text)]
    return found


def resolve(root: Path, importer: str, specifier: str) -> str | None:
    """The file a relative specifier names, relative to root; None for a package; "UNRESOLVED:<spec>" when nothing is there:
    resolve(root, "src/a/b.ts", "../c") == "src/c.ts" when src/c.ts exists."""
    if not specifier.startswith("."):
        return None
    base = (root / importer).parent / specifier
    candidates = ([base.with_suffix(".ts")] if specifier.endswith(".js") else []) + [base]
    candidates += [Path(f"{base}{ext}") for ext in EXTENSIONS] + [base / f"index{ext}" for ext in EXTENSIONS]
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve().relative_to(root.resolve()).as_posix()
    return f"UNRESOLVED:{specifier}"


def closure(root: Path, entries: list[str], cuts: list[str]) -> tuple[dict[str, int], list[tuple[str, str, str]]]:
    """The files reachable from entries without passing a cut, with their lines, and each severed import as
    (importer, imported, kind): the importer is copied, the imported is not."""
    seen: dict[str, int] = {}
    severed: list[tuple[str, str, str]] = []
    queue = list(entries)
    while queue:
        current = queue.pop()
        if current in seen:
            continue
        text = (root / current).read_text(encoding="utf8")
        seen[current] = len(text.splitlines())
        for specifier, kind in specifiers(text):
            target = resolve(root, current, specifier)
            if target is None or target.startswith("UNRESOLVED:"):
                continue
            if any(target.startswith(cut) for cut in cuts):
                severed.append((current, target, kind))
            else:
                queue.append(target)
    return dict(sorted(seen.items())), sorted(set(severed))


def block(document: str) -> tuple[list[str], list[str]]:
    """CUT.md's ```cut-closure``` block as (entries, cuts): "entry src/x.ts" and "cut src/kits" lines."""
    match = re.search(r"```cut-closure\n(.*?)```", document, re.S)
    lines = [line.split() for line in (match.group(1) if match else "").splitlines() if line.strip()]
    return [w[1] for w in lines if w[0] == "entry"], [w[1] for w in lines if w[0] == "cut"]


def main(argv: list[str]) -> int:
    """Prints `files N lines M` (and with --list each file), then each severed import; 2 on a usage error."""
    if not argv or argv[0].startswith("--"):
        print(__doc__)
        return 2
    root = Path(argv[0])
    entries, cuts = ([BEFORE_ENTRY], []) if "--before" in argv else block((ROOT / "docs" / "CUT.md").read_text())
    files, severed = closure(root, entries, cuts)
    print(f"files {len(files)} lines {sum(files.values())}")
    if "--list" in argv:
        for path, lines in files.items():
            print(f"{lines:5d} {path}")
    for importer, imported, kind in severed:
        print(f"severed {importer} -> {imported} ({kind})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
