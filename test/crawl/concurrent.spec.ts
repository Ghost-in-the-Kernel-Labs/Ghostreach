/**
 * Concurrency (TODO 3.4, GR-008) and SITE-22 under load (TODO 3.5, GR-014), in real Chromium: three fixture sites, each on a host
 * of its own, reviewed one after another as the command reviews a site (its own Chromium each), then together by the queue as
 * `ghostreach serve` runs it (three at once, one Chromium shared as a context per review, RF-09). Each fixture's /about answers
 * after 3 s, a slow first byte (SITE-22), so the guard is exercised: each review alone reports SITE-22 and its PDF does not say it
 * ran alongside others; each review of the queue's, whose crawl ran beside the other two, reports no SITE-22, its PDF says why
 * (`ALONGSIDE`) and lists the check as not timed; every other finding the same, code for code and word for word. 3.5's check
 * ("the concurrent spec's SITE-22 result equals the serial run's"), read under GR-014: the concurrent run reports no SITE-22 the
 * serial run lacks, its PDF carries the sentence, and the serial PDF does not.
 *
 * The three hosts: 127.0.0.1, `localhost` and 127.0.0.2 (a forwarder to a third fixture server, since the fixture server listens
 * on 127.0.0.1 alone): the queue never reviews one host twice at once, so three sites on one host would run one after another.
 * 127.0.0.2 answers on Linux and Windows, where every 127.x address is the machine's own; macOS has 127.0.0.1 alone, so the spec
 * is skipped there.
 */
import { test, expect } from 'playwright/test';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, connect, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser } from 'playwright';
import { startFixtureSite, type FixtureSite } from '../fixture-site/server.js';
import { review } from '../../src/project/review.js';
import { addSites, queueRunner, readQueue, reviewLine } from '../../src/project/queue.js';
import { sharedBrowser } from '../../src/project/crawl.js';
import { pdfName } from '../../src/project/review.js';
import { ALONGSIDE } from '../../src/leaf/words.js';
import { pdfPages, squeezed } from '../support/pdf-text.js';

/** The finding that is a timing (GR-014). */
const TIMED = 'SITE-22';

/** The fixture's /about, answered after 3 s: a slow first byte (`H.SLOW_FIRST_BYTE_MS`, 2 s), so a review alone finds SITE-22. */
const ABOUT = readFileSync(new URL('../fixture-site/pages/about.html', import.meta.url), 'utf8');
const slowAbout = (_req: IncomingMessage, res: ServerResponse, path: string): boolean => {
  if (path !== '/about') return false;
  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(ABOUT) });
    res.end(ABOUT);
  }, 3000);
  return true;
};

/** A TCP forwarder from `address` (a free port) to 127.0.0.1:`port`: a second loopback host for one fixture server. */
async function forward(address: string, port: number): Promise<{ origin: string; server: Server }> {
  const server = createServer((inbound) => {
    const outbound = connect(port, '127.0.0.1');
    inbound.pipe(outbound).pipe(inbound);
    const drop = () => { inbound.destroy(); outbound.destroy(); };
    inbound.on('error', drop);
    outbound.on('error', drop);
  });
  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(0, address, () => done());
  });
  const { port: bound } = server.address() as { port: number };
  return { origin: `http://${address}:${bound}`, server };
}

/** The one review folder under `data` named for `host`. */
function folderOf(data: string, host: string): string {
  const folders = readdirSync(data).filter((f) => f.startsWith(`${host}-`));
  expect(folders).toHaveLength(1);
  return join(data, folders[0]);
}

/** A review's findings, read back. */
const findingsOf = (data: string, host: string): { code: string; title: string }[] => JSON.parse(readFileSync(join(folderOf(data, host), 'findings.json'), 'utf8'));

/** A review's PDF as one line of text. */
const pdfTextOf = (data: string, host: string): string => squeezed(pdfPages(readFileSync(join(folderOf(data, host), pdfName(host)))).map((p) => p.text).join('\n'));

const sites: FixtureSite[] = [];
let forwarder: Server | undefined;
const made: string[] = [];
test.afterEach(async () => {
  await Promise.all(sites.splice(0).map((s) => s.close()));
  await new Promise<void>((done) => (forwarder ? forwarder.close(() => done()) : done()));
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test('three fixture sites reviewed together give the same findings as one after another, SITE-22 withheld and said', async () => {
  test.skip(process.platform === 'darwin', 'macOS answers on 127.0.0.1 alone, and the third host is 127.0.0.2');
  test.setTimeout(600_000);
  for (let i = 0; i < 3; i++) sites.push(await startFixtureSite({ override: slowAbout }));
  const third = await forward('127.0.0.2', sites[2].port);
  forwarder = third.server;
  const origins = [sites[0].origin, `http://localhost:${sites[1].port}`, third.origin];
  const hosts = origins.map((o) => new URL(o).hostname);
  expect(new Set(hosts).size).toBe(3);

  const log = console.log;
  console.log = () => {};
  try {
    // One after another, as `ghostreach <site>` reviews each: its own Chromium, nothing else running.
    const serial = mkdtempSync(join(tmpdir(), 'ghostreach-serial-'));
    made.push(serial);
    for (const origin of origins) expect((await review({ site: `${origin}/`, data: serial, say: () => {} })).code).toBe(0);

    // Together, as the local page's queue runs them: three at once, one Chromium.
    const together = mkdtempSync(join(tmpdir(), 'ghostreach-together-'));
    made.push(together);
    addSites(together, origins.map((o) => `${o}/`).join('\n'));
    const shared = sharedBrowser();
    const browsers = new Set<Browser>();
    let contexts = 0;
    let poll: ReturnType<typeof setInterval> | undefined;
    const get = async () => {
      const browser = await shared.get();
      if (browser) {
        browsers.add(browser);
        poll ??= setInterval(() => (contexts = Math.max(contexts, browser.contexts().length)), 50);
      }
      return browser;
    };
    const run = reviewLine(together, get);
    let running = 0;
    let most = 0;
    const runner = queueRunner(together, async (site, alongside) => {
      most = Math.max(most, ++running);
      try {
        return await run(site, alongside);
      } finally {
        running--;
      }
    }, 3);
    try {
      runner.kick();
      await runner.idle();
    } finally {
      clearInterval(poll);
      await shared.close();
    }
    expect(readQueue(together).map((e) => e.state)).toEqual(['done', 'done', 'done']);
    expect(most).toBe(3);
    // One Chromium for the three, each review's crawl a context of it.
    expect(browsers.size).toBe(1);
    expect(contexts).toBeGreaterThanOrEqual(3);

    for (const host of hosts) {
      const alone = findingsOf(serial, host);
      const queued = findingsOf(together, host);
      // The fixture's own findings are there in both (the parent's: test/golden/fixture-site.findings.json).
      expect(alone.map((f) => f.code)).toEqual(expect.arrayContaining(['SITE-02', 'SITE-11', 'SITE-17', 'SITE-03', 'SITE-28', 'SITE-29']));
      // GR-014: alone, the slow page is found; beside the other two, it is not timed, and nothing else changes.
      expect(alone.map((f) => f.code), host).toContain(TIMED);
      expect(queued.map((f) => f.code), host).not.toContain(TIMED);
      const [a, q] = [alone, queued].map((f) => JSON.stringify(f.filter((x) => x.code !== TIMED), null, 2));
      expect(q).toBe(a);
      // The PDF says so before its findings, and lists the check as not timed; the review alone says neither.
      const [serialPdf, queuedPdf] = [pdfTextOf(serial, host), pdfTextOf(together, host)];
      expect(serialPdf).not.toContain(ALONGSIDE);
      expect(serialPdf).not.toContain('not timed');
      expect(queuedPdf).toContain(ALONGSIDE);
      const titles = queued.map((f) => queuedPdf.indexOf(squeezed(f.title))).filter((at) => at >= 0);
      expect(titles.length, host).toBeGreaterThan(0);
      expect(queuedPdf.indexOf(ALONGSIDE)).toBeLessThan(Math.min(...titles));
      expect(queuedPdf).toContain('Pages slow to answer or to load: not timed');
    }
  } finally {
    console.log = log;
  }
});
