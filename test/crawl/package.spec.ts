/**
 * The package (TODO 5.1): the salesperson's install, run as the salesperson runs it. The program is built (`npm run build`) and
 * packed (`npm pack`); the tarball holds `package.json`, the README and the built `dist/` alone, each built file the build of a
 * source under `src/` (no test, fixture, document, key, data folder or .env). In a fresh folder under the system's temporary
 * folder (TMPDIR), nowhere near this repository's node_modules, `npm install -g --prefix <folder>/prefix <tarball> --ignore-scripts`
 * (npm 11) installs it, and the installed `ghostreach` alone, on a PATH holding only it, Node and the system, answers `--help`,
 * says in `doctor` whether Node.js and Chromium are ready (and the command that fixes a missing Chromium), and reviews the parent's
 * fixture site into `~/Ghostreach/<host>-<date>/` with its PDF. Chromium is the machine's (PLAYWRIGHT_BROWSERS_PATH, as the crawl
 * specs use it); the salesperson runs `npx playwright@<version> install chromium` instead, which `doctor` names.
 */
import { test, expect } from 'playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { startFixtureSite, type FixtureSite } from '../fixture-site/server.js';
import { pdfPages, squeezed } from '../support/pdf-text.js';
import { ADDRESS } from '../../src/leaf/words.js';

const REPO = process.cwd();
const NODE_BIN = dirname(process.execPath);
const NPM = existsSync(join(NODE_BIN, 'npm')) ? join(NODE_BIN, 'npm') : 'npm';

/** A command run to its end, its output kept; the test fails on a non-zero exit with the command's own output. */
function ran(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  const done = spawnSync(command, args, { cwd, env, encoding: 'utf8' });
  expect(done.status, `${command} ${args.join(' ')}\n${done.stdout}\n${done.stderr}`).toBe(0);
  return done.stdout;
}

/** The installed command, run without blocking this process (the fixture site answers from it): its exit code and its lines. */
function installed(bin: string, args: string[], env: NodeJS.ProcessEnv, cwd: string): Promise<{ code: number | null; lines: string[] }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, lines: out.split('\n').filter((line) => line.trim()) }));
  });
}

/** Every file under a folder, as paths from it with `/`. */
function filesUnder(root: string, at = ''): string[] {
  return readdirSync(join(root, at), { withFileTypes: true }).flatMap((entry) => {
    const path = at ? `${at}/${entry.name}` : entry.name;
    return entry.isDirectory() ? filesUnder(root, path) : [path];
  });
}

let site: FixtureSite | undefined;
let scratch: string | undefined;
test.afterEach(async () => {
  await site?.close();
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

test('the tarball installs with one command and the installed ghostreach reviews the fixture site into a PDF', async () => {
  test.setTimeout(300_000);
  expect(Number(ran(NPM, ['--version'], REPO).trim().split('.')[0])).toBeGreaterThanOrEqual(11);
  scratch = mkdtempSync(join(tmpdir(), 'ghostreach-package-'));

  ran(NPM, ['run', 'build', '--silent'], REPO);
  const [packed] = JSON.parse(ran(NPM, ['pack', '--pack-destination', scratch, '--json', '--silent'], REPO)) as { filename: string; files: { path: string }[] }[];
  const tarball = join(scratch, packed.filename);
  const shipped = packed.files.map((f) => f.path).sort();
  // What runs, and the README for the salesperson; every built file the build of a source under src/ (nothing stale, nothing else).
  const source = (p: string) => /^dist\/.+\.js$/.test(p) && existsSync(join(REPO, p.replace(/^dist\//, 'src/').replace(/\.js$/, '.ts')));
  expect(shipped.filter((p) => p !== 'README.md' && p !== 'package.json' && !source(p))).toEqual([]);
  expect(shipped.filter((p) => /(^|\/)(\.env|test|docs|Ghostreach)(\/|$)|\.(pem|key|json)$/.test(p) && p !== 'package.json')).toEqual([]);

  // The salesperson's one command, in a folder of its own: npm 11, no install script run.
  const prefix = join(scratch, 'prefix');
  const home = join(scratch, 'home');
  mkdirSync(home);
  ran(NPM, ['install', '-g', '--prefix', prefix, tarball, '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund'], scratch);
  const bin = join(prefix, 'bin', 'ghostreach');
  const env: NodeJS.ProcessEnv = {
    PATH: [join(prefix, 'bin'), NODE_BIN, '/usr/bin', '/bin'].join(delimiter),
    HOME: home,
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {}),
  };
  // The installed copy holds nothing of this repository's but what was packed.
  const copy = join(prefix, 'lib', 'node_modules', 'ghostreach');
  expect(filesUnder(copy).filter((p) => !p.startsWith('node_modules/')).sort()).toEqual(shipped);

  const help = await installed(bin, ['--help'], env, scratch);
  expect(help.code).toBe(0);
  expect(help.lines[0]).toMatch(/^ghostreach <site>: /);

  const doctor = await installed(bin, ['doctor'], env, scratch);
  expect(doctor.code).toBe(0);
  expect(doctor.lines[0]).toBe(`Node.js ${process.versions.node}: new enough.`);
  expect(doctor.lines[1]).toBe('Chromium, the browser the review drives: installed.');
  const version = (JSON.parse(readFileSync(join(copy, 'node_modules', 'playwright', 'package.json'), 'utf8')) as { version: string }).version;
  const bare = await installed(bin, ['doctor'], { ...env, PLAYWRIGHT_BROWSERS_PATH: join(scratch, 'no-browsers') }, scratch);
  expect(bare.lines[1]).toBe(`Chromium, the browser the review drives: not installed. Run: npx playwright@${version} install chromium`);

  site = await startFixtureSite();
  const reviewed = await installed(bin, [`${site.origin}/`], env, scratch);
  expect(reviewed.code, reviewed.lines.join('\n')).toBe(0);
  const data = join(home, 'Ghostreach');
  const [folder] = readdirSync(data).filter((name) => name.startsWith('127.0.0.1-'));
  expect(folder).toMatch(/^127\.0\.0\.1-\d{4}-\d{2}-\d{2}$/);
  const pdf = join(data, folder, '127.0.0.1 site review.pdf');
  expect(reviewed.lines.at(-1)?.endsWith(pdf)).toBe(true);
  const bytes = readFileSync(pdf);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  // The prospect sees Suite Builder's name and Ghost's address, never Ghostreach's.
  expect(bytes.includes('Ghostreach')).toBe(false);
  const pages = pdfPages(bytes);
  expect(pages.length).toBeGreaterThan(1);
  expect(pages.every((page) => squeezed(page.text).includes(ADDRESS))).toBe(true);
  expect(pages.some((page) => /ghostreach/i.test(page.text))).toBe(false);
});
