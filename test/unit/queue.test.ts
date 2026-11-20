/**
 * The queue (TODO 3.3): sites pasted one per line, kept in `<data>/queue.json` with a state each, reviewed one at a time in
 * pasted order by a fake review; a failure keeps its one error line and does not stop the next; a failed site goes back only
 * by the salesperson's retry; a line that is not a site, or a host already waiting or running, refused and never queued; an
 * entry left `running` by a stop goes back to `waiting`. Concurrency (TODO 3.4, GR-008): up to N at once, N from the settings
 * file (default 3, ceiling 5), and no more; two entries of one host never together.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addSites, queueFile, queueRunner, readQueue, recover, retry, type ReviewRun } from '../../src/project/queue.js';
import { readSettings, settingsFile } from '../../src/project/settings.js';

let data: string;
beforeEach(() => {
  data = join(mkdtempSync(join(tmpdir(), 'ghostreach-queue-')), 'Ghostreach');
});
afterEach(() => rmSync(join(data, '..'), { recursive: true, force: true }));

/** A fake review: records each site it is given, fails the ones named in `fail` with their line. */
function fake(fail: Record<string, string> = {}): { run: ReviewRun; ran: string[] } {
  const ran: string[] = [];
  const run: ReviewRun = async (site) => {
    ran.push(site);
    await new Promise((r) => setTimeout(r, 1));
    if (site in fail) {
      if (fail[site] === 'throw') throw new Error('the browser closed\n    at somewhere');
      return fail[site];
    }
    return null;
  };
  return { run, ran };
}

const states = (): string[] => readQueue(data).map((e) => `${e.site} ${e.state}${e.error ? `: ${e.error}` : ''}`);

describe('the queue (TODO 3.3)', () => {
  it('keeps the pasted order and reviews one site at a time in it', async () => {
    const added = addSites(data, 'c.example\n\n  a.example  \r\nb.example/careers\n');
    expect(added.refused).toEqual([]);
    expect(states()).toEqual(['c.example waiting', 'a.example waiting', 'b.example/careers waiting']);
    let running = 0;
    let most = 0;
    const { run, ran } = fake();
    const runner = queueRunner(data, async (site, alongside) => {
      most = Math.max(most, ++running);
      expect(readQueue(data).find((e) => e.site === site)?.state).toBe('running');
      const r = await run(site, alongside);
      running--;
      return r;
    });
    runner.kick();
    runner.kick();
    await runner.idle();
    expect(ran).toEqual(['c.example', 'a.example', 'b.example/careers']);
    expect(most).toBe(1);
    expect(states()).toEqual(['c.example done', 'a.example done', 'b.example/careers done']);
  });

  it('a failure keeps its one error line and does not stop the next', async () => {
    addSites(data, 'a.example\nb.example\nc.example\nd.example');
    const { run, ran } = fake({ 'b.example': 'No review was written: the start page answered 503.', 'c.example': 'throw' });
    const runner = queueRunner(data, run);
    runner.kick();
    await runner.idle();
    expect(ran).toEqual(['a.example', 'b.example', 'c.example', 'd.example']);
    expect(states()).toEqual([
      'a.example done',
      'b.example failed: No review was written: the start page answered 503.',
      'c.example failed: the browser closed',
      'd.example done',
    ]);
  });

  it('a failed site is retried only by the salesperson', async () => {
    addSites(data, 'a.example\nb.example');
    const failing = fake({ 'a.example': 'the site did not answer' });
    const runner = queueRunner(data, failing.run);
    runner.kick();
    await runner.idle();
    // The runner, kicked again (a new paste, a restart), leaves the failed site failed.
    recover(data);
    addSites(data, 'c.example');
    runner.kick();
    await runner.idle();
    expect(failing.ran).toEqual(['a.example', 'b.example', 'c.example']);
    expect(states()[0]).toBe('a.example failed: the site did not answer');
    const [a, b] = readQueue(data);
    expect(retry(data, b.id)).toBe(false);
    expect(retry(data, 999)).toBe(false);
    expect(retry(data, a.id)).toBe(true);
    expect(states()[0]).toBe('a.example waiting');
    const passing = fake();
    const again = queueRunner(data, passing.run);
    again.kick();
    await again.idle();
    expect(passing.ran).toEqual(['a.example']);
    expect(states()).toEqual(['a.example done', 'b.example done', 'c.example done']);
  });

  it('refuses a line that is not a site, and a host already waiting or running; never queues it', async () => {
    addSites(data, 'a.example');
    const added = addSites(data, 'not a site\nftp://a.example\nhttps://A.example/other\nb.example\nb.example\n<b>x</b>');
    expect(added.queued.map((e) => e.site)).toEqual(['b.example']);
    expect(added.refused).toEqual([
      { line: 'not a site', why: 'not a web address' },
      { line: 'ftp://a.example', why: 'not a web address' },
      { line: 'https://A.example/other', why: 'already in the queue' },
      { line: 'b.example', why: 'already in the queue' },
      { line: '<b>x</b>', why: 'not a web address' },
    ]);
    expect(states()).toEqual(['a.example waiting', 'b.example waiting']);
    // A host reviewed already may be queued again (a re-audit).
    const runner = queueRunner(data, fake().run);
    runner.kick();
    await runner.idle();
    expect(addSites(data, 'a.example').queued).toHaveLength(1);
    expect(addSites(data, '\n  \n')).toEqual({ queued: [], refused: [] });
  });

  it('a restart puts an entry left running back to waiting, and nothing else', () => {
    addSites(data, 'a.example\nb.example\nc.example');
    const sites = readQueue(data);
    sites[0].state = 'done';
    sites[1].state = 'running';
    sites[2].state = 'failed';
    sites[2].error = 'gone';
    writeFileSync(queueFile(data), JSON.stringify({ sites }));
    recover(data);
    expect(states()).toEqual(['a.example done', 'b.example waiting', 'c.example failed: gone']);
  });

  it('writes the file whole: no temporary file left beside it, and a file it cannot read is never overwritten', () => {
    addSites(data, 'a.example');
    expect(readdirSync(data)).toEqual(['queue.json']);
    expect(JSON.parse(readFileSync(queueFile(data), 'utf8')).sites).toHaveLength(1);
    writeFileSync(queueFile(data), '{"sites": [');
    expect(() => addSites(data, 'b.example')).toThrow();
    expect(readFileSync(queueFile(data), 'utf8')).toBe('{"sites": [');
  });
});

/** A fake review that holds each site until the test lets it go, recording how many ran together and which hosts overlapped. */
function held(): { run: ReviewRun; running: string[]; most: () => number; overlaps: string[]; release: (site?: string) => void } {
  const running: string[] = [];
  const waiting = new Map<string, () => void>();
  const overlaps: string[] = [];
  let most = 0;
  const run: ReviewRun = async (site) => {
    const host = new URL(`https://${site}`).hostname;
    if (running.some((s) => new URL(`https://${s}`).hostname === host)) overlaps.push(host);
    running.push(site);
    most = Math.max(most, running.length);
    await new Promise<void>((done) => waiting.set(site, done));
    running.splice(running.indexOf(site), 1);
    return null;
  };
  const release = (site?: string) => {
    for (const [s, done] of [...waiting]) {
      if (site !== undefined && s !== site) continue;
      waiting.delete(s);
      done();
    }
  };
  return { run, running, most: () => most, overlaps, release };
}

/** Lets the runner's promises settle until `ready` holds. */
async function until(ready: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !ready(); i++) await new Promise((r) => setTimeout(r, 1));
  expect(ready()).toBe(true);
}

describe('concurrency (TODO 3.4, GR-008)', () => {
  it('runs N at once and no more, each started in pasted order', async () => {
    addSites(data, 'a.example\nb.example\nc.example\nd.example\ne.example\nf.example\ng.example');
    const fake = held();
    const runner = queueRunner(data, fake.run, 3);
    runner.kick();
    runner.kick();
    await until(() => fake.running.length === 3);
    // Kicked again while full (a new paste), it starts nothing more.
    runner.kick();
    await new Promise((r) => setTimeout(r, 5));
    expect(fake.running).toEqual(['a.example', 'b.example', 'c.example']);
    expect(readQueue(data).filter((e) => e.state === 'running').map((e) => e.site)).toEqual(['a.example', 'b.example', 'c.example']);
    // One finishes: the next waiting takes its place, and still no more than three run.
    fake.release('b.example');
    await until(() => fake.running.includes('d.example'));
    expect(fake.running).toEqual(['a.example', 'c.example', 'd.example']);
    while (readQueue(data).some((e) => e.state !== 'done')) {
      fake.release();
      await new Promise((r) => setTimeout(r, 1));
    }
    await runner.idle();
    expect(fake.most()).toBe(3);
    expect(states()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => `${s}.example done`));
  });

  it('never reviews two entries of one host together: the second waits for the first, the others go past it', async () => {
    // A failed host queued again, and the failed entry retried: two entries of one host waiting at once.
    addSites(data, 'a.example');
    const failing = queueRunner(data, async () => 'the site did not answer', 3);
    failing.kick();
    await failing.idle();
    addSites(data, 'a.example/careers\nb.example\nc.example');
    expect(retry(data, readQueue(data)[0].id)).toBe(true);
    expect(states()).toEqual(['a.example waiting', 'a.example/careers waiting', 'b.example waiting', 'c.example waiting']);
    const fake = held();
    const runner = queueRunner(data, fake.run, 3);
    runner.kick();
    await until(() => fake.running.length === 3);
    expect(fake.running).toEqual(['a.example', 'b.example', 'c.example']);
    expect(states()[1]).toBe('a.example/careers waiting');
    fake.release('b.example');
    await new Promise((r) => setTimeout(r, 5));
    // A slot is free, but the only waiting entry's host is being reviewed: it waits.
    expect(fake.running).toEqual(['a.example', 'c.example']);
    fake.release('a.example');
    await until(() => fake.running.includes('a.example/careers'));
    while (readQueue(data).some((e) => e.state !== 'done')) {
      fake.release();
      await new Promise((r) => setTimeout(r, 1));
    }
    await runner.idle();
    expect(fake.overlaps).toEqual([]);
  });

  it('tells each review whether another ran at any moment of its crawl (GR-014), from its own count, never from the setting', async () => {
    const gates = new Map<string, () => void>();
    const beside: Record<string, boolean> = {};
    // A review whose crawl and then the rest of it each wait for the test to let them go.
    const run: ReviewRun = async (site, alongside) => {
      const ended = alongside();
      await new Promise<void>((done) => gates.set(`${site} crawl`, done));
      beside[site] = ended();
      await new Promise<void>((done) => gates.set(`${site} rest`, done));
      return null;
    };
    const go = async (key: string) => {
      await until(() => gates.has(key));
      gates.get(key)?.();
      gates.delete(key);
    };
    const runner = queueRunner(data, run, 3);
    // Alone though three may run: not beside another.
    addSites(data, 'a.example');
    runner.kick();
    await go('a.example crawl');
    // b starts after a's crawl ended, while the rest of a's review runs: b's crawl ran beside a; a's did not run beside b.
    addSites(data, 'b.example');
    runner.kick();
    await go('b.example crawl');
    await go('a.example rest');
    // c starts during d's crawl (d first, c pasted after d started): both crawls ran beside the other.
    await go('b.example rest');
    await runner.idle();
    addSites(data, 'd.example');
    runner.kick();
    await until(() => gates.has('d.example crawl'));
    addSites(data, 'c.example');
    runner.kick();
    await until(() => gates.has('c.example crawl'));
    for (const key of ['d.example crawl', 'd.example rest', 'c.example crawl', 'c.example rest']) await go(key);
    await runner.idle();
    expect(beside).toEqual({ 'a.example': false, 'b.example': true, 'd.example': true, 'c.example': true });
    // One at a time: never beside another.
    addSites(data, 'e.example\nf.example');
    const serial = queueRunner(data, run, 1);
    serial.kick();
    for (const key of ['e.example crawl', 'e.example rest', 'f.example crawl', 'f.example rest']) await go(key);
    await serial.idle();
    expect([beside['e.example'], beside['f.example']]).toEqual([false, false]);
  });

  it("N comes from the settings file, else this computer's recommendation (launch fixes 9); ceiling 5; a value it cannot run made one it can, with a line saying so", () => {
    // A machine the recommendation reads as 4: 6 GB free, 8 cores.
    const machine = { totalBytes: 16 * 1024 ** 3, freeBytes: 6 * 1024 ** 3, cores: 8 };
    expect(readSettings(data, machine)).toEqual({ reviewsAtOnce: 4, fromFile: false, note: null });
    const asks = (text: string) => {
      mkdirSync(data, { recursive: true });
      writeFileSync(settingsFile(data), text);
      return readSettings(data, machine);
    };
    expect(asks('{"reviewsAtOnce": 5}')).toEqual({ reviewsAtOnce: 5, fromFile: true, note: null });
    expect(asks('{"reviewsAtOnce": 1}')).toEqual({ reviewsAtOnce: 1, fromFile: true, note: null });
    expect(asks('{}')).toEqual({ reviewsAtOnce: 4, fromFile: false, note: null });
    expect(asks('{"reviewsAtOnce": 9}')).toEqual({ reviewsAtOnce: 5, fromFile: true, note: 'settings.json asks for 9 reviews at once; 5 run at once (a whole number from 1 to 5).' });
    expect(asks('{"reviewsAtOnce": 0}')).toEqual({ reviewsAtOnce: 1, fromFile: true, note: 'settings.json asks for 0 reviews at once; 1 run at once (a whole number from 1 to 5).' });
    expect(asks('{"reviewsAtOnce": 2.5}').reviewsAtOnce).toBe(2);
    expect(asks('{"reviewsAtOnce": "4"}')).toEqual({ reviewsAtOnce: 4, fromFile: false, note: "settings.json's reviewsAtOnce is not a number, so 4 reviews run at once, recommended for this computer." });
    expect(asks('{"reviewsAtOnce": 4')).toEqual({ reviewsAtOnce: 4, fromFile: false, note: 'settings.json could not be read, so 4 reviews run at once, recommended for this computer.' });
    expect(asks('null')).toEqual({ reviewsAtOnce: 4, fromFile: false, note: null });
    // A machine that can carry one review runs one when the file says nothing.
    expect(readSettings(join(data, 'none'), { totalBytes: 4 * 1024 ** 3, freeBytes: 0.5 * 1024 ** 3, cores: 2 }).reviewsAtOnce).toBe(1);
  });
});
