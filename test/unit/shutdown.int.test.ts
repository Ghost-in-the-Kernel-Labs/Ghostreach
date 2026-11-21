/**
 * The page's shutdown in a real process (J-073, Ghost's bug of 2026-11-21: "when I close the command prompt after running a crawl,
 * it locks up and has to be force stopped"). The program is built into a folder under build/ and run as a child; the test holds a
 * keep-alive connection to the page open, as the browser tab does, and sends the child the signal. After a review, Playwright has
 * added its own SIGHUP and SIGTERM listeners (it closes its browsers and does not exit), so a process with no SIGHUP listener of its
 * own no longer dies of the signal: the child stands in for that with listeners of its own. With the real Chromium (REAL_BROWSER),
 * a review of a site that never answers is running when the window "closes"; the browser's processes must be gone after it.
 *
 * Windows-specific and untested here: closing a console window sends CTRL_CLOSE_EVENT, which Node surfaces as SIGHUP and Windows
 * follows with a kill some seconds later; Ctrl+Break is SIGBREAK. Neither event can be sent on Linux; SIGHUP sent by `kill` takes the
 * same handler, which is what is tested.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { Agent, createServer, get, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readQueue } from '../../src/project/queue.js';
import { STOP_DEADLINE_MS, pageFile } from '../../src/project/show.js';

const repo = resolve(import.meta.dirname, '../..');
let built: string;
let root: string;
let data: string;
const children: ChildProcess[] = [];
const servers: Server[] = [];

beforeAll(() => {
  mkdirSync(join(repo, 'build'), { recursive: true });
  built = mkdtempSync(join(repo, 'build', 'shutdown-'));
  const tsc = spawnSync(process.execPath, [join(repo, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(repo, 'tsconfig.build.json'), '--outDir', built], { encoding: 'utf8' });
  expect(tsc.status, tsc.stdout + tsc.stderr).toBe(0);
  // The child: the page as `ghostreach` starts it, a site queued first when one is named, Playwright's listeners stood in for.
  writeFileSync(join(built, 'child.mjs'), [
    "import { showPage } from './project/show.js';",
    "import { addSites } from './project/queue.js';",
    'const [data, site, listeners] = process.argv.slice(2);',
    "if (listeners === 'playwright') for (const s of ['SIGHUP', 'SIGTERM']) process.on(s, () => {});",
    "if (site) addSites(data, site);",
    "await showPage(data, (line) => console.log(line), (url) => (console.log('URL ' + url), true), { port: 0 });",
    '',
  ].join('\n'));
});
afterAll(() => {
  if (built?.startsWith(join(repo, 'build', 'shutdown-'))) rmSync(built, { recursive: true, force: true });
});
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ghostreach-shutdown-int-'));
  data = join(root, 'Ghostreach');
  mkdirSync(data);
});
afterEach(async () => {
  for (const child of children.splice(0)) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await Promise.all(servers.splice(0).map((s) => new Promise((done) => (s.closeAllConnections(), s.close(done)))));
  rmSync(root, { recursive: true, force: true });
});

/** The child started: its output so far, its page's address once said, and its exit (code, signal) when it ends. */
async function start(site = '', listeners = 'playwright'): Promise<{ child: ChildProcess; out: () => string; url: string; exited: Promise<number | null> }> {
  const child = spawn(process.execPath, [join(built, 'child.mjs'), data, site, listeners], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let out = '';
  child.stdout!.on('data', (d) => (out += d));
  child.stderr!.on('data', (d) => (out += d));
  const exited = new Promise<number | null>((done) => child.once('exit', (code) => done(code)));
  const url = await new Promise<string>((done, fail) => {
    const timer = setTimeout(() => fail(new Error(`the page did not start:\n${out}`)), 15_000);
    child.stdout!.on('data', () => {
      const m = /URL (\S+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        done(m[1]);
      }
    });
  });
  return { child, out: () => out, url, exited };
}

/** A page read over a keep-alive connection the test leaves open, as a browser tab leaves its own. */
async function holdOpen(url: string): Promise<Agent> {
  const agent = new Agent({ keepAlive: true });
  await new Promise<void>((done, fail) => get(url, { agent }, (res) => (res.resume(), res.on('end', done))).on('error', fail));
  expect(Object.values(agent.freeSockets).flat().length).toBe(1);
  return agent;
}

/** How long the child took to end after the signal, or Infinity when it was still running at `within` ms. */
async function endsWithin(run: { child: ChildProcess; exited: Promise<number | null> }, signal: NodeJS.Signals, within: number): Promise<number> {
  const sent = Date.now();
  run.child.kill(signal);
  const ended = await Promise.race([run.exited.then(() => true), new Promise<false>((done) => setTimeout(() => done(false), within))]);
  return ended ? Date.now() - sent : Infinity;
}

describe('a stop with the page open in a browser tab ends the program within the deadline', () => {
  for (const signal of ['SIGHUP', 'SIGTERM', 'SIGINT'] as const) {
    it(`${signal}, after a review (Playwright's listeners in place)`, async () => {
      const run = await start();
      const agent = await holdOpen(run.url);
      const took = await endsWithin(run, signal, STOP_DEADLINE_MS + 2000);
      agent.destroy();
      expect(took, run.out()).toBeLessThan(STOP_DEADLINE_MS + 500);
      expect(await run.exited).toBe(0);
      expect(run.out().trim().split('\n').at(-1)).toBe('Stopped.');
      expect(existsSync(pageFile(data))).toBe(false);
    }, 20_000);
  }
});

/** The child processes of a process, by /proc (Linux): its pid's children, and theirs. */
function descendants(pid: number): number[] {
  const parents = new Map<number, number[]>();
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
      parents.set(ppid, [...(parents.get(ppid) ?? []), Number(name)]);
    } catch {
      // Gone while read.
    }
  }
  const found: number[] = [];
  const walk = (p: number) => {
    for (const c of parents.get(p) ?? []) {
      found.push(c);
      walk(c);
    }
  };
  walk(pid);
  return found;
}

/** Whether a process is still running: there, and not a zombie waiting to be reaped. */
function runs(pid: number): boolean {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2)[0] !== 'Z';
  } catch {
    return false;
  }
}

describe.runIf(process.env.REAL_BROWSER === '1' && process.platform === 'linux')('a closed window during a review, the real Chromium', () => {
  it("ends within the deadline, takes the queue's Chromium with it, and the review goes back to waiting", async () => {
    // A site that never answers: the review is still running when the window closes.
    const site = createServer(() => {});
    servers.push(site);
    await new Promise<void>((done) => site.listen(0, '127.0.0.1', done));
    const address = `http://127.0.0.1:${(site.address() as { port: number }).port}/`;
    const run = await start(address, 'none');
    const agent = await holdOpen(run.url);
    let browser: number[] = [];
    const seen = Date.now();
    while (Date.now() - seen < 20_000) {
      browser = descendants(run.child.pid!);
      if (browser.length && readQueue(data)[0]?.state === 'running') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(browser.length, run.out()).toBeGreaterThan(0);
    const took = await endsWithin(run, 'SIGHUP', STOP_DEADLINE_MS + 2000);
    agent.destroy();
    expect(took, run.out()).toBeLessThan(STOP_DEADLINE_MS + 500);
    await new Promise((r) => setTimeout(r, 500));
    expect(browser.filter(runs), 'Chromium processes left behind').toEqual([]);
    expect(readQueue(data).map((e) => e.state)).toEqual(['waiting']);
    expect(existsSync(pageFile(data))).toBe(false);
  }, 60_000);
});
