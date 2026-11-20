/**
 * The package (TODO 5.1): the salesperson's install, run as the salesperson runs it. The program is built (`npm run build`) and
 * packed (`npm pack`); the tarball holds `package.json`, the README, the built `dist/` and the page's icon alone, each built file the build of a
 * source under `src/` (no test, fixture, document, key, data folder or .env). In a fresh folder under the system's temporary
 * folder (TMPDIR), nowhere near this repository's node_modules, `npm install -g --prefix <folder>/prefix <tarball> --ignore-scripts`
 * (npm 11) installs it, and the installed `ghostreach` alone, on a PATH holding only it, Node and the system, answers `--help`,
 * says in `doctor` whether Node.js and Chromium are ready (and the command that fixes a missing Chromium), and reviews the parent's
 * fixture site into `~/Ghostreach/<host>-<date>/` with its PDF. No shipped file names where its code came from (J-053). Chromium is the machine's (PLAYWRIGHT_BROWSERS_PATH, as the crawl
 * specs use it); the salesperson runs `npx playwright@<version> install chromium` instead, which `doctor` names.
 *
 * On Windows (TODO 5.2, `.github/workflows/windows.yml`) the same steps run as npm lays them out there: `npm.cmd` and the installed
 * `ghostreach.cmd` (each through the shell, as Node runs a `.cmd`), the command in the prefix itself and the package under
 * `<prefix>/node_modules`, the home folder `USERPROFILE`, and the system folders the system's own variables name.
 */
import { test, expect } from 'playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startFixtureSite, type FixtureSite } from '../fixture-site/server.js';
import { pdfPages, squeezed } from '../support/pdf-text.js';
import { ADDRESS } from '../../src/leaf/words.js';
import { leaks, unused } from '../support/lineage.js';

const REPO = process.cwd();
const NODE_BIN = dirname(process.execPath);
const WINDOWS = process.platform === 'win32';
const NPM = WINDOWS ? join(NODE_BIN, 'npm.cmd') : existsSync(join(NODE_BIN, 'npm')) ? join(NODE_BIN, 'npm') : 'npm';

/** Windows runs a `.cmd` only through the shell, so there each word is quoted: `C:\a b\npm.cmd` gives `"C:\a b\npm.cmd"`. */
function launch(command: string, args: string[]): [string, string[], { shell: boolean }] {
  return WINDOWS ? [`"${command}"`, args.map((a) => (/[\s"]/.test(a) ? `"${a}"` : a)), { shell: true }] : [command, args, { shell: false }];
}

/** A command run to its end, its output kept; the test fails on a non-zero exit with the command's own output. */
function ran(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  const [file, words, shell] = launch(command, args);
  const done = spawnSync(file, words, { cwd, env, encoding: 'utf8', ...shell });
  expect(done.status, `${command} ${args.join(' ')}\n${done.stdout}\n${done.stderr}`).toBe(0);
  return done.stdout;
}

/** The installed command, run without blocking this process (the fixture site answers from it): its exit code and its lines. */
function installed(bin: string, args: string[], env: NodeJS.ProcessEnv, cwd: string): Promise<{ code: number | null; lines: string[] }> {
  return new Promise((resolve, reject) => {
    const [file, words, shell] = launch(bin, args);
    const child = spawn(file, words, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], ...shell });
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
  // What runs, the README for the salesperson and the icon; every built file the build of a source under src/ (nothing stale, nothing else).
  const source = (p: string) => /^dist\/.+\.js$/.test(p) && existsSync(join(REPO, p.replace(/^dist\//, 'src/').replace(/\.js$/, '.ts')));
  // The page's icon (launch fixes 6), served as its favicon from the installed package.
  const icon = (p: string) => p === 'assets/icon.svg' || p === 'assets/icon-32.png';
  expect(shipped.filter((p) => p !== 'README.md' && p !== 'package.json' && !source(p) && !icon(p))).toEqual([]);
  expect(shipped.filter(icon)).toEqual(['assets/icon-32.png', 'assets/icon.svg']);
  expect(shipped.filter((p) => /(^|\/)(\.env|test|docs|Ghostreach)(\/|$)|\.(pem|key|json)$/.test(p) && p !== 'package.json')).toEqual([]);

  // The salesperson's one command, in a folder of its own: npm 11, no install script run.
  const prefix = join(scratch, 'prefix');
  const home = join(scratch, 'home');
  mkdirSync(home);
  ran(NPM, ['install', '-g', '--prefix', prefix, tarball, '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund'], scratch);
  const bin = WINDOWS ? join(prefix, 'ghostreach.cmd') : join(prefix, 'bin', 'ghostreach');
  const system = process.env.SystemRoot ?? 'C:\\Windows';
  const env: NodeJS.ProcessEnv = {
    PATH: [WINDOWS ? prefix : join(prefix, 'bin'), NODE_BIN, ...(WINDOWS ? [join(system, 'System32'), system] : ['/usr/bin', '/bin'])].join(delimiter),
    HOME: home,
    // Windows: the home folder Node reads, and the system's own variables its programs need (cmd.exe, the network, Chromium's temporary profile).
    ...(WINDOWS ? { USERPROFILE: home, SystemRoot: system, ComSpec: process.env.ComSpec ?? join(system, 'System32', 'cmd.exe'), PATHEXT: '.COM;.EXE;.BAT;.CMD', TEMP: tmpdir(), TMP: tmpdir() } : {}),
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {}),
  };
  // The installed copy holds nothing of this repository's but what was packed.
  const copy = WINDOWS ? join(prefix, 'node_modules', 'ghostreach') : join(prefix, 'lib', 'node_modules', 'ghostreach');
  expect(filesUnder(copy).filter((p) => !p.startsWith('node_modules/')).sort()).toEqual(shipped);
  // Nothing shipped says where the code came from but the brand's own strings (J-053, test/support/lineage.ts).
  const texts = shipped.map((path) => ({ path, text: readFileSync(join(copy, path), 'utf8') }));
  expect(leaks(texts)).toEqual([]);
  expect(unused(texts)).toEqual([]);

  const help = await installed(bin, ['--help'], env, scratch);
  expect(help.code).toBe(0);
  expect(help.lines.filter((line) => /^ {2}ghostreach/.test(line)).length).toBe(5);
  expect(help.lines).toContain(`Reviews are saved in ${join(home, 'Ghostreach')}`);

  // The page's favicon, served from the installed package's own assets (launch fixes 6).
  const served = (await import(pathToFileURL(join(copy, 'dist', 'project', 'serve.js')).href)) as typeof import('../../src/project/serve.js');
  const shown = await served.servePage(join(scratch, 'page-data'), async () => null);
  try {
    const svg = await fetch(new URL('/favicon.svg', shown.url));
    expect(svg.headers.get('content-type')).toBe('image/svg+xml');
    expect(await svg.text()).toContain('<svg');
    expect((await fetch(new URL('/favicon-32.png', shown.url))).headers.get('content-type')).toBe('image/png');
  } finally {
    await shown.close();
  }

  const doctor = await installed(bin, ['doctor'], env, scratch);
  expect(doctor.code).toBe(0);
  expect(doctor.lines[0]).toBe(`Node.js ${process.versions.node}: new enough.`);
  expect(doctor.lines[1]).toBe('Chromium, the browser the review drives: installed.');
  const version = (JSON.parse(readFileSync(join(copy, 'node_modules', 'playwright', 'package.json'), 'utf8')) as { version: string }).version;
  const bare = await installed(bin, ['doctor'], { ...env, PLAYWRIGHT_BROWSERS_PATH: join(scratch, 'no-browsers') }, scratch);
  expect(bare.lines[1]).toBe(`Chromium, the browser the review drives: not installed. Run: npx playwright@${version} install ${process.platform === 'linux' ? '--with-deps ' : ''}chromium`);

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
