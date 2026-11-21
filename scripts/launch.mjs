// Makes a copy of the source ready to run, for the launchers at the root (`ghostreach`, `ghostreach.cmd`; GR-018, J-070): they
// call this, then run dist/cli/bin.js. The packages are installed (`npm ci --ignore-scripts`, from the lockfile) when
// package-lock.json is newer than npm's own record of the last install (node_modules/.package-lock.json) or there is none. The
// program is built after an install, when dist/cli/bin.js or the build's stamp (build/launch.json; git ignores build/, and it is
// never packed) is missing, or when a file under src/, a tsconfig*.json or package.json is newer than the stamp. So a `git pull`
// that changed the code rebuilds once, and when nothing changed this only reads file times (no tsc). The stamp names the version
// and, where git answers, the commit built from, which `ghostreach --help` prints first.
// Exit 0 when the program is ready; 1, after one plain line, when it could not be made so.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const at = (...parts) => join(here, ...parts);
const mtime = (path) => (existsSync(path) ? statSync(path).mtimeMs : -1);

/** The newest change time of the files the build reads: every file under src/, each tsconfig*.json, package.json. */
function newestSource() {
  let newest = mtime(at('package.json'));
  for (const name of readdirSync(here)) if (/^tsconfig.*\.json$/.test(name)) newest = Math.max(newest, mtime(at(name)));
  const walk = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else newest = Math.max(newest, statSync(path).mtimeMs);
    }
  };
  if (existsSync(at('src'))) walk(at('src'));
  return newest;
}

/** npm with these words in this folder, its output on the terminal; true when it succeeded. Windows runs npm.cmd through a shell. */
function npm(...words) {
  return spawnSync('npm', words, { cwd: here, stdio: 'inherit', shell: process.platform === 'win32' }).status === 0;
}

const stamp = at('build', 'launch.json');
const installRecord = at('node_modules', '.package-lock.json');
const install = !existsSync(installRecord) || mtime(at('package-lock.json')) > mtime(installRecord);
const firstBuild = !existsSync(at('dist', 'cli', 'bin.js'));
const build = install || firstBuild || newestSource() > mtime(stamp);
if (build) {
  console.log(firstBuild
    ? 'Ghostreach is not built in this folder yet. Building it once now (this takes a minute)...'
    : 'Ghostreach was updated; rebuilding it once (about a minute)...');
  if (install && !npm('ci', '--ignore-scripts', '--no-audit', '--no-fund')) {
    console.log("Could not install Ghostreach's packages. It needs Node.js 24 (or 22.18 or later) and npm 11. Copy the message above to Ghost.");
    process.exit(1);
  }
  if (!npm('run', 'build', '--silent') || !existsSync(at('dist', 'cli', 'bin.js'))) {
    console.log('Could not build Ghostreach. Copy the message above to Ghost.');
    process.exit(1);
  }
  const git = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: here, encoding: 'utf8' });
  const commit = git.status === 0 ? git.stdout.trim() : undefined;
  const { version } = JSON.parse(readFileSync(at('package.json'), 'utf8'));
  mkdirSync(dirname(stamp), { recursive: true });
  writeFileSync(stamp, `${JSON.stringify({ version, commit })}\n`);
}
