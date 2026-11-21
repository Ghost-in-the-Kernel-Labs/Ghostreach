/**
 * The page's one shutdown (J-073, Ghost's bug of 2026-11-21: "when I close the command prompt after running a crawl, it locks up
 * and has to be force stopped"). Every stop, Ctrl+C, SIGTERM, a closed window (SIGHUP; Windows' CTRL_CLOSE_EVENT) and Ctrl+Break
 * (SIGBREAK), takes the same path: no new review is taken, a running one goes back to `waiting`, the page's connections are cut,
 * the queue's Chromium is closed within a bound, "Stopped." is said, the note removed, and the program ends. Here with fakes; the
 * spawned processes and the real Chromium are `shutdown.int.test.ts`'s.
 */
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser } from 'playwright';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sharedBrowser } from '../../src/project/crawl.js';
import { addSites, queueRunner, readQueue, type ReviewRun } from '../../src/project/queue.js';
import { servePage } from '../../src/project/serve.js';
import { STOP_SIGNALS, pageFile, showPage } from '../../src/project/show.js';

let root: string;
let data: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ghostreach-shutdown-'));
  data = join(root, 'Ghostreach');
  mkdirSync(data);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** A review that runs until the test lets it end, then fails as a crawl whose browser was closed under it fails. */
function hanging(): { run: ReviewRun; started: () => boolean; end: () => void } {
  let started = false;
  let end = () => {};
  const run: ReviewRun = () => {
    started = true;
    return new Promise((_, fail) => (end = () => fail(new Error('Target page, context or browser has been closed'))));
  };
  return { run, started: () => started, end: () => end() };
}

describe('every stop takes the one path', () => {
  it('the signals heard are Ctrl+C, SIGTERM, a closed window (SIGHUP) and Ctrl+Break (SIGBREAK)', () => {
    expect([...STOP_SIGNALS]).toEqual(['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']);
  });

  for (const signal of STOP_SIGNALS) {
    it(`${signal}: "Stopped.", the note removed, and the program told to end`, async () => {
      const lines: string[] = [];
      const signals = new EventEmitter();
      const exit = vi.fn();
      let url = '';
      const running = showPage(data, (line) => void lines.push(line), (u) => void (url = u), { port: 0, signals, exit });
      await vi.waitFor(() => expect(url).not.toBe(''));
      signals.emit(signal);
      await running;
      expect(lines.at(-1)).toBe('Stopped.');
      expect(existsSync(pageFile(data))).toBe(false);
      expect(exit).toHaveBeenCalledWith(0);
      // Nothing of the page is left listening: a second signal finds no listener of its.
      expect(signals.listenerCount(signal)).toBe(0);
    });
  }

  it('a stop that is not a signal (a test closing the page) does not end the program', async () => {
    const exit = vi.fn();
    const signals = new EventEmitter();
    const running = showPage(data, () => {}, (_u, page) => void page?.close(), { port: 0, signals, exit });
    await running;
    expect(exit).not.toHaveBeenCalled();
  });
});

describe('a review running at the stop', () => {
  it('goes back to waiting, and its failure after the stop is not written over it', async () => {
    addSites(data, 'a.example\nb.example\n');
    const review = hanging();
    const page = await servePage(data, review.run);
    await vi.waitFor(() => expect(review.started()).toBe(true));
    // Three at once by default (GR-008): both are running.
    await vi.waitFor(() => expect(readQueue(data).map((e) => e.state)).toEqual(['running', 'running']));
    await page.close();
    review.end();
    await new Promise((r) => setTimeout(r, 20));
    expect(readQueue(data).map((e) => e.state)).toEqual(['waiting', 'waiting']);
  });

  it('the runner, stopped, takes nothing more', async () => {
    addSites(data, 'a.example\nb.example\n');
    const taken: string[] = [];
    let release = () => {};
    const runner = queueRunner(data, (site) => {
      taken.push(site);
      return new Promise((done) => (release = () => done(null)));
    });
    runner.kick();
    await vi.waitFor(() => expect(taken).toEqual(['a.example']));
    runner.stop();
    release();
    await runner.idle();
    expect(taken).toEqual(['a.example']);
    expect(readQueue(data).map((e) => e.state)).toEqual(['waiting', 'waiting']);
  });
});

describe("the queue's Chromium at the stop", () => {
  /** A stand-in for Playwright's Browser: connected, its close counted, settling only when `closes` says so. */
  function fakeBrowser(closes: boolean): { browser: Browser; closed: () => number } {
    let closed = 0;
    const browser = {
      isConnected: () => true,
      close: () => {
        closed += 1;
        return closes ? Promise.resolve() : new Promise<void>(() => {});
      },
    } as unknown as Browser;
    return { browser, closed: () => closed };
  }

  it('is closed', async () => {
    const fake = fakeBrowser(true);
    const shared = sharedBrowser(async () => fake.browser);
    expect(await shared.get()).toBe(fake.browser);
    await shared.close();
    expect(fake.closed()).toBe(1);
  });

  it('one whose close hangs (a busy page) is let go within the bound, for the exit to kill', async () => {
    const fake = fakeBrowser(false);
    const shared = sharedBrowser(async () => fake.browser);
    await shared.get();
    const started = Date.now();
    await shared.close(100);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(fake.closed()).toBe(1);
  });
});
