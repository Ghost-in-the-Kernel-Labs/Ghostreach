"""deploy/, the server's setup script and service unit (GR-015, J-058): setup.sh parses, stops at the first error, checks
the checksum of every download, pipes nothing into a shell, holds no secret and deletes only a guarded path; its pure
functions refuse a wrong checksum, a placeholder and a file that is not the package, and `--check` changes nothing; the
unit runs as `ghostreach` and names no address but 127.0.0.1. Nothing here runs systemd, apt, ufw or a download."""
import json
import os
import re
import stat
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path

from scripts.checks import secrets
from test.support import ROOT

DEPLOY = ROOT / "deploy"
SETUP = DEPLOY / "setup.sh"
UNIT = DEPLOY / "ghostreach.service"
README = DEPLOY / "README.md"


def code_lines(text: str) -> list[str]:
    """The script's lines that are not comments, stripped."""
    return [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]


def sourced(snippet: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    """bash with setup.sh sourced (main not run), then the snippet: sourced('verify_sha256 f abc')."""
    return subprocess.run(["bash", "-c", f'source "{SETUP}"; {snippet}'], capture_output=True, text=True,
                          env={**os.environ, **(env or {})})


def package(folder: Path, name: str) -> Path:
    """An npm-pack-shaped tarball whose package/package.json names the package given."""
    manifest = folder / "package.json"
    manifest.write_text(json.dumps({"name": name, "version": "0.1.0"}, indent=2))
    tarball = folder / f"{name}-0.1.0.tgz"
    with tarfile.open(tarball, "w:gz") as archive:
        archive.add(manifest, arcname="package/package.json")
    return tarball


class TheScriptsText(unittest.TestCase):
    text = SETUP.read_text()

    def test_it_parses(self) -> None:
        result = subprocess.run(["bash", "-n", str(SETUP)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_it_stops_at_the_first_error(self) -> None:
        self.assertIn("set -euo pipefail", code_lines(self.text))

    def test_every_download_is_checked_before_use(self) -> None:
        lines = code_lines(self.text)
        self.assertFalse([line for line in lines if re.search(r"\bwget\b", line)])
        downloads = [i for i, line in enumerate(lines) if re.match(r"curl\s", line)]
        self.assertTrue(downloads)
        for i in downloads:
            following = lines[i + 1:i + 4]
            self.assertTrue(any(line.startswith("verify_sha256 ") for line in following), lines[i])

    def test_nothing_is_piped_into_a_shell(self) -> None:
        self.assertFalse([line for line in code_lines(self.text) if re.search(r"\|\s*(sudo\s+)?(ba|z)?sh\b", line)])

    def test_no_file_holds_a_secret(self) -> None:
        for path in (SETUP, UNIT, README):
            self.assertEqual(secrets.scan_text(path.read_text(), str(path)), [], path)

    def test_every_recursive_or_forced_delete_is_guarded(self) -> None:
        lines = code_lines(self.text)
        self.assertFalse([line for line in lines if "-delete" in line or "rmSync" in line])
        for line in (line for line in lines if re.match(r"rm\s", line)):
            targets = [word for word in line.split()[1:] if not word.startswith("-")]
            self.assertTrue(targets and all(re.fullmatch(r'"\$\{\w+:\?[^}]*\}"', t) for t in targets), line)

    def test_its_playwright_is_the_lockfiles(self) -> None:
        lock = json.loads((ROOT / "package-lock.json").read_text())
        pinned = re.search(r'^PLAYWRIGHT_VERSION="([^"]+)"', self.text, re.M)
        self.assertEqual(pinned and pinned.group(1), lock["packages"]["node_modules/playwright"]["version"])

    def test_its_node_is_24_lts_in_the_engines_range(self) -> None:
        version = re.search(r'^NODE_VERSION="(\d+)\.(\d+)\.(\d+)"', self.text, re.M)
        self.assertTrue(version and version.group(1) == "24" and int(version.group(2)) >= 11)


class TheScriptsFunctions(unittest.TestCase):
    def test_a_matching_checksum_passes_and_a_wrong_one_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "node.tar.xz"
            file.write_bytes(b"made-up archive")
            right = subprocess.run(["sha256sum", str(file)], capture_output=True, text=True).stdout.split()[0]
            self.assertEqual(sourced(f'verify_sha256 "{file}" {right}').returncode, 0)
            wrong = sourced(f'verify_sha256 "{file}" {"0" * 64}')
            self.assertEqual(wrong.returncode, 1)
            self.assertIn("checksum mismatch", wrong.stderr)

    def test_a_placeholder_checksum_is_refused(self) -> None:
        self.assertEqual(sourced("node_sha256 amd64").returncode, 0)
        refused = sourced('NODE_SHA256_X64="PLACEHOLDER"; node_sha256 amd64')
        self.assertEqual(refused.returncode, 1)
        self.assertIn("placeholder", refused.stderr)
        self.assertEqual(sourced("node_sha256 riscv64").returncode, 1)

    def test_check_names_the_plan_and_changes_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            result = subprocess.run(["bash", str(SETUP), "--check", str(package(Path(folder), "ghostreach"))],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("--check: nothing changed", result.stdout)
            self.assertIn("ufw: deny incoming but OpenSSH", result.stdout)

    def test_another_package_or_no_tarball_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            other = subprocess.run(["bash", str(SETUP), "--check", str(package(Path(folder), "left-pad"))],
                                   capture_output=True, text=True)
            self.assertIn("is not the ghostreach package", other.stderr)
            missing = subprocess.run(["bash", str(SETUP), "--check", f"{folder}/none.tgz"], capture_output=True, text=True)
            self.assertIn("no tarball", missing.stderr)
            self.assertEqual((other.returncode, missing.returncode), (1, 1))

    @unittest.skipUnless(os.geteuid() == 0, "makes a root-owned file")
    def test_the_env_file_is_made_once_with_no_value_and_mode_0600(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / "etc" / "env"
            self.assertEqual(sourced(f'ENV_FILE="{env}"; make_env_file').returncode, 0)
            self.assertEqual(stat.S_IMODE(env.stat().st_mode), 0o600)
            self.assertTrue(all(line.startswith("#") for line in env.read_text().splitlines()))
            with env.open("a") as kept:
                kept.write("MADE_UP=1\n")
            sourced(f'ENV_FILE="{env}"; make_env_file')
            self.assertIn("MADE_UP=1", env.read_text())


class TheUnit(unittest.TestCase):
    text = UNIT.read_text()

    def setting(self, key: str) -> list[str]:
        """Every value of a key in the unit: setting("User") gives ["ghostreach"]."""
        return re.findall(rf"^{key}=(.*)$", self.text, re.M)

    def test_it_runs_as_ghostreach_with_its_data_folder_alone_writable(self) -> None:
        self.assertEqual((self.setting("User"), self.setting("ProtectSystem")), (["ghostreach"], ["strict"]))
        self.assertEqual(self.setting("ReadWritePaths"), ["/var/lib/ghostreach"])
        self.assertEqual(self.setting("EnvironmentFile"), ["/etc/ghostreach/env"])
        for key in ("NoNewPrivileges", "ProtectHome", "PrivateTmp"):
            self.assertEqual(self.setting(key), ["true"], key)
        self.assertTrue(self.setting("MemoryMax"))

    def test_it_names_no_address_but_loopback(self) -> None:
        self.assertEqual(set(re.findall(r"\b\d{1,3}(?:\.\d{1,3}){3}\b", self.text)), {"127.0.0.1"})
        self.assertNotIn("[::]", self.text)

    def test_its_command_is_the_marked_placeholder_or_listens_on_loopback(self) -> None:
        [command] = self.setting("ExecStart")
        marked = "TODO(API)" in self.text
        self.assertTrue((marked and command == "/usr/bin/false") or (not marked and "127.0.0.1" in command), command)

    def test_the_tunnel_points_at_the_units_port(self) -> None:
        port = re.search(r"127\.0\.0\.1:(\d+)", self.text)
        self.assertIn(f"service: http://127.0.0.1:{port and port.group(1)}", README.read_text())
