"""The cut's closure follows every kind of import, stops at a cut point, and reads CUT.md's own block (GR-002, REV-02)."""
import unittest
from pathlib import Path

from scripts import cut_closure
from test.support import ROOT, scratch

FILES = {
    "src/a.ts": "import { b } from './b';\nimport type { C } from './c.js';\nimport {\n  d,\n} from './d';\nimport './side';\n"
                "export * from './e';\nconst f = await import('./f');\nconst g = require('./g');\nimport { kit } from './kits/kit';\n"
                "import { chromium } from 'playwright';\n",
    "src/b.ts": "import { only } from './only-b';\n",
    "src/c.ts": "", "src/d.ts": "", "src/side.ts": "", "src/e/index.ts": "", "src/f.ts": "", "src/g.js": "", "src/only-b.ts": "",
    "src/kits/kit.ts": "import { deep } from '../deep';\n",
    "src/deep.ts": "",
}


def tree() -> Path:
    """A parent tree with each kind of import, e.g. /tmp/ghost-core-x/src/a.ts importing ./b, ./c.js and the rest."""
    root = scratch()
    for path, text in FILES.items():
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_text(text)
    return root


class ClosureTest(unittest.TestCase):
    def test_every_kind_of_import_is_followed_and_a_package_is_not(self) -> None:
        files, _ = cut_closure.closure(tree(), ["src/a.ts"], [])
        self.assertEqual(sorted(files), ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/deep.ts", "src/e/index.ts",
                                         "src/f.ts", "src/g.js", "src/kits/kit.ts", "src/only-b.ts", "src/side.ts"])

    def test_a_cut_point_severs_the_import_and_what_only_it_reached(self) -> None:
        files, severed = cut_closure.closure(tree(), ["src/a.ts"], ["src/kits"])
        self.assertNotIn("src/kits/kit.ts", files)
        self.assertNotIn("src/deep.ts", files)
        self.assertEqual(severed, [("src/a.ts", "src/kits/kit.ts", "value")])

    def test_a_type_only_import_is_said_to_be_one(self) -> None:
        kinds = dict(cut_closure.specifiers(FILES["src/a.ts"]))
        self.assertEqual((kinds["./c.js"], kinds["./b"], kinds["./side"], kinds["./f"]), ("type", "value", "side", "dynamic"))
        self.assertEqual(cut_closure.specifiers("import { type A, type B } from './x';"), [("./x", "type")])
        self.assertEqual(cut_closure.specifiers("import { type A, b } from './x';"), [("./x", "value")])

    def test_the_block_gives_the_entries_and_the_cuts(self) -> None:
        self.assertEqual(cut_closure.block("x\n```cut-closure\nentry src/a.ts\ncut src/kits\n\n```\n"), (["src/a.ts"], ["src/kits"]))
        self.assertEqual(cut_closure.block("no block"), ([], []))

    def test_cut_md_has_a_block_with_entries_and_cuts(self) -> None:
        entries, cuts = cut_closure.block((ROOT / "docs" / "CUT.md").read_text())
        self.assertIn("src/project/audit.ts", entries)
        self.assertIn("src/kits", cuts)


if __name__ == "__main__":
    unittest.main()
