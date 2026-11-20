/**
 * The page's launch (GR-018, split out of `serve.ts`): one page per data folder, its note `<data>/page.json` naming its address
 * and process, a second `ghostreach` opening the running page instead of starting another, and the platform's opener.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { servePage, type ServedPage } from './serve.js';
import { PAGE_TITLE } from './page.js';
import { isRecord } from './kept.js';

/** The platform's own opener for a web address, as a program and a fixed argument list: no shell reads the address. */
export function opener(platform: NodeJS.Platform, url: string): { command: string; args: string[] } {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'win32') return { command: 'explorer.exe', args: [url] };
  return { command: 'xdg-open', args: [url] };
}

/** Opens the page in the salesperson's browser; when no opener answers, the address printed beside it is the way in. */
export function openInBrowser(url: string): void {
  const { command, args } = opener(process.platform, url);
  const child = spawn(command, args, { shell: false, stdio: 'ignore', detached: true });
  child.on('error', () => {});
  child.unref();
}

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
 * `ghostreach` alone (and `ghostreach serve`): one page per data folder. When one already runs, the browser opens it and this
 * returns; else the page starts, its note is written, the browser opens it, and this returns when it stops (its note removed).
 * `open` is handed the address, and the page this call serves (a test's opener stops it).
 */
// Decision: GR-018
export async function showPage(data: string, say: (line: string) => void, open: (url: string, page?: ServedPage) => void): Promise<void> {
  const running = await runningPage(data);
  if (running) {
    say(`Ghostreach is already open at ${running} (this computer only); your browser shows it again.`);
    return open(running);
  }
  const page = await servePage(data);
  mkdirSync(data, { recursive: true });
  writeFileSync(pageFile(data), `${JSON.stringify({ url: page.url, pid: process.pid })}\n`);
  say(`The reviews are at ${page.url} (this computer only). Ctrl+C stops the page.`);
  if (page.settings.note) say(page.settings.note);
  open(page.url, page);
  await page.closed;
  try {
    // Only this page's own note is removed; another's written since is left.
    if (readFileSync(pageFile(data), 'utf8').includes(`"${page.url}"`)) unlinkSync(pageFile(data));
  } catch {
    // Gone already: nothing to remove.
  }
}
