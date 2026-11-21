/**
 * The page's launch (GR-018, split out of `serve.ts`): one page per data folder, its note `<data>/page.json` naming its address
 * and process, a second `ghostreach` opening the running page instead of starting another, and the platform's opener. Since the
 * launch fixes (GR-022): a fixed port first (`PAGE_PORT`), the address said as the way in when the browser could not be opened,
 * Ctrl+C saying "Stopped." and taking the note with it, and the shortcut's tip said on the first launch alone. Since J-073, every
 * stop (Ctrl+C, SIGTERM, a closed window, Ctrl+Break) takes one path that ends the program within a deadline.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { servePage, type ServedPage } from './serve.js';
import { PAGE_TITLE } from './page.js';
import { isRecord } from './kept.js';
import { markTip, tipFile, tipLine } from './shortcut.js';

/** The page's port, tried first so its address, and a bookmark of it, stays the same from one launch to the next (GR-022). */
export const PAGE_PORT = 4747;

/** The platform's own opener for a web address, as a program and a fixed argument list: no shell reads the address. */
export function opener(platform: NodeJS.Platform, url: string): { command: string; args: string[] } {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'win32') return { command: 'explorer.exe', args: [url] };
  return { command: 'xdg-open', args: [url] };
}

/**
 * Whether a program opened what it was given: false when it could not start, or (but on Windows, whose explorer.exe exits 1 when
 * it opens) when it exits with a failure, as xdg-open does finding no browser; true when it is still running after `wait` ms.
 */
export function launched(command: string, args: string[], platform: NodeJS.Platform, wait = 3000): Promise<boolean> {
  return new Promise((done) => {
    const child = spawn(command, args, { shell: false, stdio: 'ignore', detached: true });
    const timer = setTimeout(() => done(true), wait);
    const settle = (opened: boolean) => {
      clearTimeout(timer);
      done(opened);
    };
    child.once('error', () => settle(false));
    child.once('exit', (code) => settle(platform === 'win32' || code === 0));
    child.unref();
  });
}

/** Opens the page in the salesperson's browser: whether it did. When it did not, the address is said as the way in. */
export const openInBrowser = (url: string): Promise<boolean> => {
  const { command, args } = opener(process.platform, url);
  return launched(command, args, process.platform);
};

/** An opener: given the address (and the page, a test's to stop), whether the browser opened; only `false` says it did not. */
export type Open = (url: string, page?: ServedPage) => Promise<boolean> | boolean | void;

/** The running page's note in the data folder: its address and its process, so a second `ghostreach` opens it instead (GR-018). */
export const pageFile = (data: string): string => join(data, 'page.json');

/** The only address a note may name: this program's own, on the loopback. A note naming anything else is not believed. */
const OWN_ADDRESS = /^http:\/\/127\.0\.0\.1:\d{1,5}\/$/;

/** Whether a process is alive: a signal 0 reaches it, or it exists and belongs to someone else. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * The address of the page already serving this data folder, or null. The note is believed only when its process is alive and its
 * address answers with this page within two seconds; a note left by a page that stopped (Ctrl+C, a closed window), or whose port
 * another program now holds, is stale, and the next page writes its own over it.
 */
// Decision: GR-018
async function runningPage(data: string): Promise<string | null> {
  let note: unknown;
  try {
    note = JSON.parse(readFileSync(pageFile(data), 'utf8'));
  } catch {
    return null;
  }
  if (!isRecord(note) || typeof note.url !== 'string' || !OWN_ADDRESS.test(note.url) || !Number.isInteger(note.pid) || !alive(note.pid as number)) return null;
  try {
    const res = await fetch(note.url, { signal: AbortSignal.timeout(2000) });
    return res.ok && (await res.text()).includes(PAGE_TITLE) ? note.url : null;
  } catch {
    return null;
  }
}

/**
 * The signals that stop the page, each taking the one path (J-073): Ctrl+C, SIGTERM, a closed window (SIGHUP: on Windows, closing
 * the console window sends CTRL_CLOSE_EVENT, which Node hears as SIGHUP, and Windows kills the process some seconds later), and
 * Ctrl+Break (SIGBREAK, Windows alone). SIGHUP matters most: after a review Playwright listens for it itself (it closes its
 * browsers and does not exit), so the signal no longer ends the process, and a page that did not hear it kept the window open.
 */
export const STOP_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const;
type StopSignal = (typeof STOP_SIGNALS)[number];

/** The most a stop by signal may take before the program ends regardless: nothing it waits on can keep the window open (J-073). */
export const STOP_DEADLINE_MS = 3000;

/** What a launch may be given beyond the data folder: the port tried first, where the stop is heard, the system and its exit (a test's). */
export interface Launch {
  port?: number;
  signals?: { on(event: StopSignal, listener: () => void): unknown; off(event: StopSignal, listener: () => void): unknown };
  platform?: NodeJS.Platform;
  exit?: (code: number) => void;
}

/**
 * `ghostreach` alone (and `ghostreach serve`): one page per data folder. When one already runs, the browser opens it and this
 * returns; else the page starts on `PAGE_PORT` (a free port when that one is taken), its note is written, the shortcut's tip is
 * said if it never was, the browser opens it, and this returns when it stops (a test's close), or the program ends when a signal
 * stops it (`STOP_SIGNALS`): the page closed (`ServedPage.close`), its note removed, "Stopped." said, then the exit, at
 * `STOP_DEADLINE_MS` at the latest whatever is still closing. `open` is handed the address, and the page this call serves (a
 * test's opener stops it); when it says the browser did not open, the address is said as the way in.
 */
// Decision: GR-018, GR-022
export async function showPage(data: string, say: (line: string) => void, open: Open, launch: Launch = {}): Promise<void> {
  const { port = PAGE_PORT, signals = process, platform = process.platform, exit = (code: number) => process.exit(code) } = launch;
  const running = await runningPage(data);
  if (running) {
    if ((await open(running)) === false) say(`Ghostreach is already open (this computer only). Open this address in your browser: ${running}`);
    else say(`Ghostreach is already open at ${running} (this computer only); your browser shows it again.`);
    return;
  }
  const page = await servePage(data, undefined, undefined, undefined, port);
  let stopping: Promise<void> | null = null;
  let deadline: NodeJS.Timeout | undefined;
  let finished = false;
  // Said once, whichever comes first: the stop's own end, or the deadline's.
  const finish = () => {
    if (finished) return;
    finished = true;
    for (const signal of STOP_SIGNALS) signals.off(signal, stop);
    try {
      // Only this page's own note is removed; another's written since is left.
      if (readFileSync(pageFile(data), 'utf8').includes(`"${page.url}"`)) unlinkSync(pageFile(data));
    } catch {
      // Gone already: nothing to remove.
    }
    try {
      say('Stopped.');
    } catch {
      // A closed window has nowhere to say it.
    }
  };
  // Decision: GR-022
  function stop(): void {
    if (stopping) return;
    deadline = setTimeout(() => {
      finish();
      exit(0);
    }, STOP_DEADLINE_MS);
    deadline.unref();
    stopping = page.close();
  }
  for (const signal of STOP_SIGNALS) signals.on(signal, stop);
  mkdirSync(data, { recursive: true });
  writeFileSync(pageFile(data), `${JSON.stringify({ url: page.url, pid: process.pid })}\n`);
  say(`The reviews are at ${page.url} (this computer only). Ctrl+C stops the page.`);
  if (page.settings.note) say(page.settings.note);
  const tip = tipLine(platform);
  if (tip && !existsSync(tipFile(data))) {
    say(tip);
    markTip(data);
  }
  if ((await open(page.url, page)) === false) say(`Open this address in your browser: ${page.url}`);
  await page.closed;
  // The server is closed: "Stopped." now, while the queue's Chromium closes within its bound.
  finish();
  if (!stopping) return;
  await stopping;
  clearTimeout(deadline);
  exit(0);
}
