/**
 * The queue (TODO 3.3): sites pasted one per line, kept in `<data>/queue.json` with a state each, reviewed one at a time in
 * pasted order by a fake review; a failure keeps its one error line and does not stop the next; a failed site goes back only
 * by the salesperson's retry; a line that is not a site, or a host already waiting or running, refused and never queued; an
 * entry left `running` by a stop goes back to `waiting`.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addSites, queueFile, queueRunner, readQueue, recover, retry, type ReviewRun } from '../../src/project/queue.js';

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
    const runner = queueRunner(data, async (site) => {
      most = Math.max(most, ++running);
      expect(readQueue(data).find((e) => e.site === site)?.state).toBe('running');
      const r = await run(site);
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
