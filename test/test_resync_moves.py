"""The resync's dry run names each move for a range of the parent's commits (docs/CUT.md, "The resync recipe"; TODO 1.7)."""
import subprocess
import unittest
from pathlib import Path

from scripts import resync_moves
from test.support import scratch

FILLER = [f"export const filler{n} = 'line number {n} of the middle';" for n in range(12)]
REPORT = ["export interface CrawlReport { pages: number; started: string }"] + FILLER + ["export interface PageLoad { status: number; after: string }"]
TRIMMED = ["export const keptByTheCopy = 'what the cut left in place';"] + FILLER + ["export const cutAtOneTwo = 'what the cut removed here';"]
PARENT_1 = {
    "src/crawl/crawler.ts": "import { a } from './a';\nexport const crawler = a;\n",
    "src/crawl/a.ts": "export const a = 'the first answer of the page';\n",
    "src/crawl/report.ts": "\n".join(REPORT) + "\n",
    "src/crawl/t.ts": "\n".join(TRIMMED) + "\n",
    "src/kits/k.ts": "export const kit = 'a suite part';\n",
    "src/cli/parse.ts": "export const OPTIONS = {\n  offline: { type: 'boolean', shapesCrawl: true, ...BUILD },\n} as const;\n",
    "test/unit/x.test.ts": "it('reads the first answer of the page', () => {});\n",
    "test/unit/words.test.ts": "it('is the parent words test', () => {});\n",
}
PARENT_2 = {
    "src/crawl/crawler.ts": "import { a } from './a';\nimport { b } from './b';\nexport const crawler = a + b;\n",
    "src/crawl/b.ts": "export const b = 'new';\n",
    "src/crawl/a.ts": "export const a = 'the second answer of the page';\n",
    "src/crawl/report.ts": "\n".join([REPORT[0].replace("started: string", "started: string; ended: string")] + FILLER
                                     + [REPORT[-1].replace("after: string", "after: string; late: boolean")]) + "\n",
    "src/crawl/t.ts": "\n".join(TRIMMED[:-1] + [TRIMMED[-1].replace("removed here", "removed here, changed")]) + "\n",
    "src/kits/k.ts": "export const kit = 'a suite part, changed';\n",
    "src/cli/parse.ts": "export const OPTIONS = {\n  offline: { type: 'boolean', shapesCrawl: true, ...BUILD },\n"
                        "  turbo: { type: 'boolean', shapesCrawl: true, ...BUILD },\n  colour: { type: 'boolean', ...TUNING },\n} as const;\n",
    "test/unit/x.test.ts": "it('reads the second answer of the page', () => {});\n",
    "test/unit/words.test.ts": "it('is the parent words test, changed', () => {});\n",
    "docs/notes.md": "the parent's own notes\n",
}
CUT = """# The cut

```cut-closure
entry src/crawl/crawler.ts
cut src/kits
```

```resync
own test/unit/words.test.ts
```

## The files

| Parent path | Ghostreach path | Lines | Loses at 1.2 | Flags at 1.3 |
| --- | --- | --- | --- | --- |
| `src/crawl/crawler.ts` | `src/crawl/crawler.ts` | 2 | — | — |
| `src/crawl/a.ts` | `src/crawl/a.ts` | 1 | — | — |
| `src/crawl/report.ts` | `src/leaf/report.ts` | 14 | its page parts | --offline |
| `src/crawl/report.ts` | `src/leaf/report-page.ts` | (part) | its page parts | — |
| `src/crawl/t.ts` | `src/crawl/t.ts` | 14 | `cutAtOneTwo` | — |

## The flags stripped

| Flag | What it set | Status | Fixed at |
| --- | --- | --- | --- |
| `--offline` | no other host | stripped | off |

## The parent's unit tests: dropped or trimmed at 1.4

- `x.test.ts`: trimmed: a case.
"""
LOCAL = {
    "docs/CUT.md": CUT,
    "src/crawl/crawler.ts": "import { a } from './a.js';\nexport const crawler = a;\n",
    "src/crawl/a.ts": "export const a = 'the first answer of the page';\n",
    "src/leaf/report.ts": REPORT[0] + "\n" + "\n".join(FILLER[:3]) + "\n",
    "src/leaf/report-page.ts": "\n".join(FILLER[-3:]) + "\n" + REPORT[-1] + "\n",
    "src/crawl/t.ts": TRIMMED[0] + "\n" + "\n".join(FILLER[:3]) + "\n",
    "test/unit/x.test.ts": "it('reads the first answer of the page', () => {});\n",
    "test/unit/words.test.ts": "it('is Ghostreach own', () => {});\n",
}


def write(root: Path, files: dict[str, str]) -> None:
    """Each file written under root."""
    for path, text in files.items():
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_text(text)


def parent() -> tuple[Path, str, str]:
    """A scratch parent repository with two commits, and their hashes."""
    root = scratch()
    run = lambda *args: subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=True).stdout.strip()  # noqa: E731
    run("init", "-q", "-b", "main")
    run("config", "user.name", "Someone")
    run("config", "user.email", "someone@example.invalid")
    hashes = []
    for files in (PARENT_1, PARENT_2):
        write(root, files)
        run("add", "-A")
        run("commit", "-q", "-m", "a commit")
        hashes.append(run("rev-parse", "--short=7", "HEAD"))
    return root, hashes[0], hashes[1]


class MovesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        local = scratch()
        write(local, LOCAL)
        repo, pin, target = parent()
        cls.pin, cls.target = pin, target
        cls.lines = resync_moves.moves(repo, pin, target, root=local, listed_skips=True)
        cls.text = "\n".join(cls.lines)

    def test_a_one_to_one_copy_takes_the_parent_patch(self) -> None:
        self.assertIn("apply src/crawl/a.ts -> src/crawl/a.ts: the parent's patch, 1:1", self.lines)

    def test_a_split_file_names_the_local_file_each_hunk_lands_in(self) -> None:
        at = self.lines.index("split src/crawl/report.ts -> src/leaf/report.ts, src/leaf/report-page.ts")
        self.assertTrue(self.lines[at + 1].startswith("    hunk 1: lands in src/leaf/report.ts"))
        self.assertTrue(self.lines[at + 2].startswith("    hunk 2: lands in src/leaf/report-page.ts"))

    def test_a_hunk_on_code_the_cut_removed_is_read_by_hand(self) -> None:
        at = next(i for i, line in enumerate(self.lines) if line.startswith("trimmed src/crawl/t.ts"))
        self.assertEqual(self.lines[at + 1], "    hunk 1: touches code the cut removed: read by hand")

    def test_a_file_the_closure_newly_reaches_is_new_and_the_suite_side_is_skipped(self) -> None:
        self.assertIn("new src/crawl/b.ts: the target's closure reaches it; copy it, with a row in CUT.md", self.lines)
        self.assertIn("\n    src/kits/k.ts", self.text)

    def test_an_option_a_crawl_reads_is_a_flag_and_a_build_one_is_not(self) -> None:
        self.assertIn("flag --turbo:", self.text)
        self.assertNotIn("--colour", self.text)

    def test_carried_tests_apply_and_an_own_file_under_a_parent_name_is_skipped(self) -> None:
        self.assertTrue(any(line.startswith("trimmed test/unit/x.test.ts") for line in self.lines))
        self.assertNotIn("test/unit/words.test.ts", self.text)
        self.assertIn("skip 2 files outside src/ and the carried tests", self.lines)

    def test_the_closing_steps_name_the_pin_and_the_reruns(self) -> None:
        self.assertIn(f"then: the pin {self.pin} -> {self.target} in docs/CUT.md", self.text)
        self.assertIn("moves 7", self.lines)
        self.assertTrue(self.lines[-1].startswith("then: rerun 1.5 and 1.6"))


class PartsTest(unittest.TestCase):
    def test_options_say_which_a_review_reads(self) -> None:
        text = "  offline: { type: 'boolean', shapesCrawl: true, ...BUILD },\n  md: { type: 'boolean', table: 'common', ...AUDIT },\n" \
               "  theme: { type: 'boolean', table: 'common', ...TUNING },\n"
        self.assertEqual(resync_moves.options(text), {"offline": True, "md": True, "theme": False})

    def test_an_import_only_hunk_is_said_to_be_one(self) -> None:
        self.assertTrue(resync_moves.imports_only([" const a = 1;", "+import { b } from './b';", "-import type { C } from '../c';"]))
        self.assertFalse(resync_moves.imports_only(["+import { b } from './b';", "+const c = b;"]))

    def test_cut_rows_say_how_each_copy_was_kept(self) -> None:
        rows = resync_moves.cut_rows(CUT)
        self.assertEqual([r["kept"] for r in rows["src/crawl/report.ts"]], ["trimmed", "part"])
        self.assertEqual(rows["src/crawl/a.ts"], [{"here": "src/crawl/a.ts", "kept": "1:1"}])


if __name__ == "__main__":
    unittest.main()
