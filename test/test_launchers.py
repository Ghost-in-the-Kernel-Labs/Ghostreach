"""The launchers at the repository's root (GR-018): typed in a copy of the source, `ghostreach` (Linux, `./ghostreach`) and
`ghostreach.cmd` (Windows) run scripts/launch.mjs, which installs and builds when the copy is new or was updated (J-070: after a
`git pull` the old launchers ran the old build), then the built program with the words typed. The Linux one is run here, in a
copy of its own with a stand-in program and a stand-in npm; the Windows one is read. Neither is packed: package.json's `files`
names `dist/` and the icons alone."""
import json
import os
import stat
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

from test.support import ROOT

LINUX = ROOT / "ghostreach"
WINDOWS = ROOT / "ghostreach.cmd"
LAUNCH = ROOT / "scripts" / "launch.mjs"

# A stand-in for the built program: it prints the words it was given, one per line.
ECHO = "for (const word of process.argv.slice(2)) console.log(`word: ${word}`);\n"
FIRST = "Ghostreach is not built in this folder yet. Building it once now (this takes a minute)..."
UPDATED = "Ghostreach was updated; rebuilding it once (about a minute)..."


def age(path: Path, seconds_ago: float) -> None:
    """Sets a file's change time to that many seconds ago."""
    then = time.time() - seconds_ago
    os.utime(path, (then, then))


def copy_with(folder: Path, built: bool) -> Path:
    """A copy of the source in folder, every file of it an hour old: the Linux launcher and scripts/launch.mjs, a source file,
    package.json, a tsconfig, the lockfile and npm's record of installing it; the built stand-in and the launch stamp when `built`.
    A stand-in npm in folder/tools logs each call's words to folder/npm.log: `ci` writes the install record, `run build` the
    program. The launcher runs with tools first on the PATH (`run`)."""
    launcher = folder / "ghostreach"
    launcher.write_bytes(LINUX.read_bytes())
    launcher.chmod(0o755)
    (folder / "scripts").mkdir()
    (folder / "scripts" / "launch.mjs").write_bytes(LAUNCH.read_bytes())
    (folder / "src" / "cli").mkdir(parents=True)
    (folder / "src" / "cli" / "main.ts").write_text("export {};\n")
    (folder / "package.json").write_text('{"name": "ghostreach", "version": "9.8.7"}\n')
    (folder / "tsconfig.json").write_text("{}\n")
    (folder / "package-lock.json").write_text("{}\n")
    (folder / "node_modules").mkdir()
    (folder / "node_modules" / ".package-lock.json").write_text("{}\n")
    tools = folder / "tools"
    tools.mkdir()
    (tools / "bin.js").write_text(ECHO)
    npm = tools / "npm"
    npm.write_text(
        '#!/bin/sh\n'
        f'echo "$*" >> "{folder / "npm.log"}"\n'
        f'if [ "$1" = ci ]; then echo "{{}}" > node_modules/.package-lock.json; fi\n'
        f'if [ "$1" = run ]; then mkdir -p dist/cli && cp "{tools / "bin.js"}" dist/cli/bin.js; fi\n')
    npm.chmod(0o755)
    if built:
        (folder / "dist" / "cli").mkdir(parents=True)
        (folder / "dist" / "cli" / "bin.js").write_text(ECHO)
        (folder / "build").mkdir()
        (folder / "build" / "launch.json").write_text('{"version": "9.8.7"}\n')
    for path in folder.rglob("*"):
        if path.is_file() and path.parent != tools:
            age(path, 3600)
    if built:
        age(folder / "build" / "launch.json", 1800)  # the stamp written after the build, half an hour ago
    return launcher


def run(launcher: Path, *words: str) -> subprocess.CompletedProcess:
    folder = launcher.parent
    env = {**os.environ, "PATH": f"{folder / 'tools'}{os.pathsep}{os.environ['PATH']}"}
    return subprocess.run([str(launcher), *words], capture_output=True, text=True, cwd=folder, env=env)


def npm_calls(folder: Path) -> list[str]:
    log = folder / "npm.log"
    return log.read_text().splitlines() if log.exists() else []


class LinuxLauncher(unittest.TestCase):
    def test_is_executable_and_runs_the_build_with_the_words_typed(self):
        self.assertTrue(LINUX.stat().st_mode & stat.S_IXUSR)
        with tempfile.TemporaryDirectory() as tmp:
            launcher = copy_with(Path(tmp), built=True)
            done = run(launcher, "--help", "a b")
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertEqual(done.stdout.splitlines(), ["word: --help", "word: a b"])
            # Nothing changed since the build: no install, no build, the stamp untouched.
            self.assertEqual(npm_calls(Path(tmp)), [])

    def test_builds_first_with_a_plain_line_when_not_built(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            launcher = copy_with(folder, built=False)
            done = run(launcher, "doctor")
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertEqual(done.stdout.splitlines(), [FIRST, "word: doctor"])
            self.assertEqual(npm_calls(folder), ["run build --silent"])
            # The stamp names the version; no commit, this copy being no git clone.
            self.assertEqual(json.loads((folder / "build" / "launch.json").read_text()), {"version": "9.8.7"})

    def test_rebuilds_once_when_a_source_file_is_newer_than_the_build(self):
        # J-070, Ghost's bug: after a `git pull` the old launcher ran the build it found, so the new code never ran.
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            launcher = copy_with(folder, built=True)
            (folder / "src" / "cli" / "main.ts").write_text("export const changed = 1;\n")
            done = run(launcher, "doctor")
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertEqual(done.stdout.splitlines(), [UPDATED, "word: doctor"])
            self.assertEqual(npm_calls(folder), ["run build --silent"])
            # Once: the next launch finds the build current.
            again = run(launcher)
            self.assertEqual(again.stdout.splitlines(), [])
            self.assertEqual(npm_calls(folder), ["run build --silent"])

    def test_rebuilds_when_a_tsconfig_or_package_json_changed_or_the_stamp_is_missing(self):
        for change in ("tsconfig.build.json", "package.json", "no stamp"):
            with self.subTest(change), tempfile.TemporaryDirectory() as tmp:
                folder = Path(tmp)
                launcher = copy_with(folder, built=True)
                if change == "no stamp":
                    (folder / "build" / "launch.json").unlink()  # a copy built by the launchers before J-070
                else:
                    (folder / change).write_text('{"version": "9.8.7"}\n')
                done = run(launcher)
                self.assertEqual(done.returncode, 0, done.stderr)
                self.assertEqual(done.stdout.splitlines(), [UPDATED])
                self.assertEqual(npm_calls(folder), ["run build --silent"])

    def test_installs_from_the_lockfile_then_builds_when_the_lockfile_changed(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            launcher = copy_with(folder, built=True)
            (folder / "package-lock.json").write_text('{"changed": true}\n')
            done = run(launcher, "x")
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertEqual(done.stdout.splitlines(), [UPDATED, "word: x"])
            self.assertEqual(npm_calls(folder), ["ci --ignore-scripts --no-audit --no-fund", "run build --silent"])

    def test_installs_when_node_modules_has_no_record_of_an_install(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            launcher = copy_with(folder, built=False)
            (folder / "node_modules" / ".package-lock.json").unlink()
            done = run(launcher)
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertEqual(done.stdout.splitlines(), [FIRST])
            self.assertEqual(npm_calls(folder), ["ci --ignore-scripts --no-audit --no-fund", "run build --silent"])

    def test_a_failed_build_or_install_says_so_and_exits_1(self):
        for fails, said in (("run", "Could not build Ghostreach."), ("ci", "Could not install Ghostreach's packages.")):
            with self.subTest(fails), tempfile.TemporaryDirectory() as tmp:
                folder = Path(tmp)
                launcher = copy_with(folder, built=True)
                (folder / "package-lock.json").write_text('{"changed": true}\n')
                (folder / "tools" / "npm").write_text(f'#!/bin/sh\nif [ "$1" = {fails} ]; then exit 2; fi\n')
                done = run(launcher, "x")
                self.assertEqual(done.returncode, 1)
                self.assertIn(said, done.stdout)
                self.assertNotIn("word: x", done.stdout)


class WindowsLauncher(unittest.TestCase):
    def test_runs_the_build_with_every_word_and_builds_first(self):
        text = WINDOWS.read_text()
        self.assertTrue(text.startswith("@echo off"))
        # The same Node script as the Linux launcher decides and does the install and the build (J-070); it failing ends the launch.
        self.assertIn('node "%HERE%scripts\\launch.mjs"\nif errorlevel 1 exit /b 1\nnode "%HERE%dist\\cli\\bin.js" %*', text)
        self.assertIn("exit /b %ERRORLEVEL%", text)
        self.assertNotIn("npm", text.replace("npm link", ""))

    def test_neither_launcher_is_packed(self):
        files = json.loads((ROOT / "package.json").read_text())["files"]
        # The build, the page's icon (launch fixes 6, J-066) and the shortcut's (launch fixes 10, GR-022), never a launcher.
        self.assertEqual(files, ["dist/", "assets/icon.svg", "assets/icon-32.png", "assets/icon.ico", "assets/icon-256.png"])

    def test_is_written_with_crlf(self):
        attributes = (ROOT / ".gitattributes").read_text().splitlines()
        self.assertIn("*.cmd text eol=crlf", attributes)


if __name__ == "__main__":
    unittest.main()
