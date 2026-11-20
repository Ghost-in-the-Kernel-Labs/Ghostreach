"""The launchers at the repository's root (GR-018): typed in a copy of the source, `ghostreach` (Linux, `./ghostreach`) and
`ghostreach.cmd` (Windows) run the built program with the words typed, building it first, with a plain line, when it is not
built. The Linux one is run here, in a copy of its own with a stand-in program and a stand-in npm; the Windows one is read.
Neither is packed: package.json's `files` names `dist/` alone."""
import json
import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

from test.support import ROOT

LINUX = ROOT / "ghostreach"
WINDOWS = ROOT / "ghostreach.cmd"

# A stand-in for the built program: it prints the words it was given, one per line.
ECHO = "for (const word of process.argv.slice(2)) console.log(`word: ${word}`);\n"


def copy_with(folder: Path, built: bool) -> Path:
    """The Linux launcher copied into folder, with the built stand-in when `built`, and node_modules always (no install)."""
    launcher = folder / "ghostreach"
    launcher.write_bytes(LINUX.read_bytes())
    launcher.chmod(0o755)
    (folder / "node_modules").mkdir()
    if built:
        (folder / "dist" / "cli").mkdir(parents=True)
        (folder / "dist" / "cli" / "bin.js").write_text(ECHO)
    return launcher


class LinuxLauncher(unittest.TestCase):
    def test_is_executable_and_runs_the_build_with_the_words_typed(self):
        self.assertTrue(LINUX.stat().st_mode & stat.S_IXUSR)
        with tempfile.TemporaryDirectory() as tmp:
            launcher = copy_with(Path(tmp), built=True)
            done = subprocess.run([str(launcher), "--help", "a b"], capture_output=True, text=True, cwd=tmp)
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertEqual(done.stdout.splitlines(), ["word: --help", "word: a b"])

    def test_builds_first_with_a_plain_line_when_not_built(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            launcher = copy_with(folder, built=False)
            # A stand-in npm on the PATH: `npm run build` writes the stand-in program, as the real build writes dist/.
            tools = folder / "tools"
            tools.mkdir()
            npm = tools / "npm"
            (tools / "bin.js").write_text(ECHO)
            npm.write_text(f'#!/bin/sh\nmkdir -p dist/cli && cp "{tools / "bin.js"}" dist/cli/bin.js\n')
            npm.chmod(0o755)
            env = {**os.environ, "PATH": f"{tools}{os.pathsep}{os.environ['PATH']}"}
            done = subprocess.run([str(launcher), "doctor"], capture_output=True, text=True, cwd=tmp, env=env)
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertEqual(done.stdout.splitlines(), [
                "Ghostreach is not built in this folder yet. Building it once now (this takes a minute)...",
                "word: doctor",
            ])

    def test_a_failed_build_says_so_and_exits_1(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            launcher = copy_with(folder, built=False)
            tools = folder / "tools"
            tools.mkdir()
            (tools / "npm").write_text("#!/bin/sh\nexit 2\n")
            (tools / "npm").chmod(0o755)
            env = {**os.environ, "PATH": f"{tools}{os.pathsep}{os.environ['PATH']}"}
            done = subprocess.run([str(launcher)], capture_output=True, text=True, cwd=tmp, env=env)
            self.assertEqual(done.returncode, 1)
            self.assertIn("Could not build Ghostreach.", done.stdout)


class WindowsLauncher(unittest.TestCase):
    def test_runs_the_build_with_every_word_and_builds_first(self):
        text = WINDOWS.read_text()
        self.assertTrue(text.startswith("@echo off"))
        self.assertIn('node "%HERE%dist\\cli\\bin.js" %*', text)
        self.assertIn("call npm ci", text)
        self.assertIn("call npm run build", text)
        self.assertIn("Ghostreach is not built in this folder yet.", text)
        self.assertIn("exit /b %ERRORLEVEL%", text)

    def test_neither_launcher_is_packed(self):
        files = json.loads((ROOT / "package.json").read_text())["files"]
        # The build, the page's icon (launch fixes 6, J-066) and the shortcut's (launch fixes 10, GR-022), never a launcher.
        self.assertEqual(files, ["dist/", "assets/icon.svg", "assets/icon-32.png", "assets/icon.ico", "assets/icon-256.png"])

    def test_is_written_with_crlf(self):
        attributes = (ROOT / ".gitattributes").read_text().splitlines()
        self.assertIn("*.cmd text eol=crlf", attributes)


if __name__ == "__main__":
    unittest.main()
