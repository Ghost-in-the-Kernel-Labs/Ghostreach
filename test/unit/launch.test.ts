/**
 * The launch's messages (launch fixes, item B, points 7 and 8; GR-022): the address said plainly when the browser could not be
 * opened, Ctrl+C saying "Stopped." and taking the page's note with it, a fixed port first so a bookmark keeps working, and the
 * shortcut's tip said once, on the first launch only.
 */
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../src/cli/main.js';
import type { ServedPage } from '../../src/project/serve.js';
import { PAGE_PORT, pageFile, showPage } from '../../src/project/show.js';
import { tipFile } from '../../src/project/shortcut.js';

let root: string;
let data: string;
const held: Server[] = [];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ghostreach-launch-'));
  data = join(root, 'Ghostreach');
  mkdirSync(data);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(held.splice(0).map((s) => new Promise((done) => s.close(done))));
  rmSync(root, { recursive: true, force: true });
});

/** A port on the loopback the system says is free now. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as { port: number };
  await new Promise((done) => server.close(done));
  return port;
}

/** A port another program holds for the rest of the test. */
async function takenPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  held.push(server);
  return (server.address() as { port: number }).port;
}

/** One launch of the page, its lines kept, stopped by the test's own Ctrl+C: what it said, and its address. */
async function launch(port: number, opens: boolean | void = true, platform: NodeJS.Platform = 'linux'): Promise<{ lines: string[]; url: string }> {
  const lines: string[] = [];
  const signals = new EventEmitter();
  let url = '';
  const running = showPage(data, (line) => void lines.push(line), (u) => ((url = u), opens), { port, signals, platform });
  await vi.waitFor(() => expect(existsSync(pageFile(data))).toBe(true));
  await vi.waitFor(() => expect(url).not.toBe(''));
  signals.emit('SIGINT');
  await running;
  return { lines, url };
}

describe('the opener, said honestly (launch fixes 7)', () => {
  it('when the browser could not be opened, the address is said as the way in', async () => {
    const { lines, url } = await launch(await freePort(), false);
    expect(lines).toContain(`Open this address in your browser: ${url}`);
  });

  it('when it opened, no such line', async () => {
    const { lines } = await launch(await freePort(), true);
    expect(lines.some((line) => line.startsWith('Open this address'))).toBe(false);
  });

  it('a second launch that could not open the browser says the address instead of claiming it shows it', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    let first: ServedPage | undefined;
    const running = main([], data, (_url, p) => void (first = p));
    await vi.waitFor(() => expect(first).toBeDefined());
    const lines: string[] = [];
    await showPage(data, (line) => void lines.push(line), () => false);
    expect(lines).toEqual([`Ghostreach is already open (this computer only). Open this address in your browser: ${first!.url}`]);
    await first!.close();
    expect(await running).toBe(0);
  });
});

describe('Ctrl+C (launch fixes 7)', () => {
  it('says "Stopped." and removes the page\'s note', async () => {
    const { lines } = await launch(await freePort());
    expect(lines.at(-1)).toBe('Stopped.');
    expect(existsSync(pageFile(data))).toBe(false);
  });
});

describe('a stable address (launch fixes 8)', () => {
  it('the fixed port is 4747', () => {
    expect(PAGE_PORT).toBe(4747);
  });

  it('two launches in a row, stopped between, are at the same address', async () => {
    const port = await freePort();
    const first = await launch(port);
    const second = await launch(port);
    expect(first.url).toBe(`http://127.0.0.1:${port}/`);
    expect(second.url).toBe(first.url);
    expect(first.lines[0]).toContain(first.url);
    expect(second.lines[0]).toContain(first.url);
  });

  it('a port another program holds is left to it: the page takes a free one', async () => {
    const port = await takenPort();
    const { url } = await launch(port);
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(url).not.toBe(`http://127.0.0.1:${port}/`);
  });
});

describe("the shortcut's tip, once (launch fixes 10; opt-in, Ghost 2026-11-20)", () => {
  it('the first launch says it in one line and remembers it in the data folder; the next says nothing of it', async () => {
    const port = await freePort();
    const first = await launch(port, true, 'win32');
    expect(first.lines.filter((line) => line.includes('ghostreach shortcut'))).toEqual([
      'Tip: type ghostreach shortcut to put Ghostreach, with its icon, on your desktop and in the Start menu.',
    ]);
    expect(existsSync(tipFile(data))).toBe(true);
    const second = await launch(port, true, 'win32');
    expect(second.lines.some((line) => line.includes('ghostreach shortcut'))).toBe(false);
  });

  it('on Linux it names the applications menu; on a Mac, where no shortcut is made, it is not said', async () => {
    const linux = await launch(await freePort(), true, 'linux');
    expect(linux.lines).toContain('Tip: type ghostreach shortcut to put Ghostreach, with its icon, in your applications menu and on your desktop.');
    rmSync(tipFile(data));
    const mac = await launch(await freePort(), true, 'darwin');
    expect(mac.lines.some((line) => line.includes('shortcut'))).toBe(false);
    expect(existsSync(tipFile(data))).toBe(false);
  });

  it("the tip's mark holds the day it was said, nothing else", async () => {
    await launch(await freePort());
    expect(readFileSync(tipFile(data), 'utf8')).toMatch(/^\d{4}-\d{2}-\d{2}\n$/);
  });
});
