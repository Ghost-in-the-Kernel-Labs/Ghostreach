/**
 * The queue (TODO 3.3): the sites the salesperson pasted on the local page, one per line, kept in `<data>/queue.json` with a
 * state each (`waiting`, `running`, `done`, `failed`), and the runner that reviews them in the order they were pasted. A failed
 * site keeps its one error line and stays failed: only the salesperson puts it back (`retry`), never the runner. The file is
 * written whole to a temporary file and renamed over the old one, so a crash leaves the old queue or the new, never half of
 * one. Every change is read, made and written synchronously, so the page's requests and the runner, in one process, never
 * interleave inside one change.
 */
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser } from 'playwright';
import { review, startUrl, type Alongside } from './review.js';
import { isRecord, readKept, Unreadable } from './kept.js';

type QueueState = 'waiting' | 'running' | 'done' | 'failed';

/** One pasted site. */
export interface QueueEntry {
  /** The entry's number, unique in the queue: what the page's retry names. */
  id: number;
  /** The site as pasted, trimmed. */
  site: string;
  /** The host the review will name its folder by: one host is never waiting or running twice. */
  host: string;
  state: QueueState;
  /** A failed review's one line saying why. */
  error?: string;
  /** Why it was queued, when from the lead finder (4.10): the lead's source and its posting's address. Absent in a queue written before. */
  reason?: Reason;
}

/** A lead's source (a source's name, or the lane it came by) and the posting's address when one is kept. */
export interface Reason {
  source: string;
  url?: string;
}

/** What a paste did: the sites queued, and each line refused with why. */
export interface Added {
  queued: QueueEntry[];
  refused: { line: string; why: string }[];
}

/**
 * Reviews one site: null when the review was written, else one line saying why it was not. The page runs `reviewLine`; a test its
 * own. `alongside` is the runner's: what the review asks to know whether its crawl ran beside another review.
 */
export type ReviewRun = (site: string, alongside: Alongside) => Promise<string | null>;

export const queueFile = (data: string): string => join(data, 'queue.json');

/** The queue as written; empty when there is none yet. A file that cannot be read is `Unreadable`, never overwritten (`kept.ts`). */
export function readQueue(data: string): QueueEntry[] {
  return readKept(queueFile(data), (read) => (isRecord(read) && Array.isArray(read.sites) ? (read.sites as QueueEntry[]) : undefined)) ?? [];
}

/** Writes the queue whole: a temporary file beside it, then a rename over it (atomic on one file system). */
function writeQueue(data: string, sites: readonly QueueEntry[]): void {
  mkdirSync(data, { recursive: true });
  const file = queueFile(data);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ sites }, null, 2)}\n`);
  renameSync(temp, file);
}

/** One change to the queue: read, changed by `change`, written; synchronous, so nothing else changes it in between. */
function update<T>(data: string, change: (sites: QueueEntry[]) => T): T {
  const sites = readQueue(data);
  const result = change(sites);
  writeQueue(data, sites);
  return result;
}

/**
 * Queues the pasted text, one site per line, in its order; a blank line is skipped. A line that is not a web address
 * (`startUrl`, the review's own test), or whose host is already waiting or running, is refused and never queued. A site queued
 * from the lead finder carries its `reason` (4.10).
 */
export function addSites(data: string, text: string, reason?: Reason): Added {
  const added: Added = { queued: [], refused: [] };
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return added;
  update(data, (sites) => {
    let id = sites.reduce((max, e) => Math.max(max, e.id), 0);
    for (const line of lines) {
      const url = startUrl(line);
      if (!url) {
        added.refused.push({ line, why: 'not a web address' });
        continue;
      }
      const host = new URL(url).hostname;
      if (sites.some((e) => e.host === host && (e.state === 'waiting' || e.state === 'running'))) {
        added.refused.push({ line, why: 'already in the queue' });
        continue;
      }
      const entry: QueueEntry = { id: ++id, site: line, host, state: 'waiting', ...(reason ? { reason } : {}) };
      sites.push(entry);
      added.queued.push(entry);
    }
  });
  return added;
}

/** The salesperson's retry: a failed entry back to waiting, its error line cleared; false for any other entry. */
export function retry(data: string, id: number): boolean {
  return update(data, (sites) => {
    const entry = sites.find((e) => e.id === id && e.state === 'failed');
    if (!entry) return false;
    entry.state = 'waiting';
    delete entry.error;
    return true;
  });
}

/**
 * At start, before the runner: an entry still `running` was being reviewed when the program last stopped (a crash, or the
 * terminal closed), and nothing is reviewing it now, so it goes back to `waiting` to be reviewed again from the start.
 */
export function recover(data: string): void {
  if (!whileReadable(() => readQueue(data).some((e) => e.state === 'running'), false)) return;
  update(data, (sites) => {
    for (const e of sites) if (e.state === 'running') e.state = 'waiting';
  });
}

/** `read`'s answer, or `none` while the queue file cannot be read: the runner and the start leave it as it is, and go on. */
function whileReadable<T>(read: () => T, none: T): T {
  try {
    return read();
  } catch (e) {
    if (e instanceof Unreadable) return none;
    throw e;
  }
}

/**
 * Takes the first waiting entry, in pasted order, whose host is not being reviewed now, and marks it running; null when none
 * such waits. Never two reviews of one host together (GR-008): one site is not asked for twice its pages at once.
 */
// Decision: GR-008
function take(data: string): QueueEntry | null {
  return update(data, (sites) => {
    const busy = new Set(sites.filter((e) => e.state === 'running').map((e) => e.host));
    const next = sites.find((e) => e.state === 'waiting' && !busy.has(e.host));
    if (next) next.state = 'running';
    return next ?? null;
  });
}

/** Marks a running entry done, or failed with its one error line. */
function finish(data: string, id: number, error: string | null): void {
  update(data, (sites) => {
    const entry = sites.find((e) => e.id === id);
    if (!entry) return;
    entry.state = error === null ? 'done' : 'failed';
    if (error !== null) entry.error = error.split('\n')[0].trim() || 'the review stopped';
  });
}

/** The runner: `kick` starts it when something may be waiting; `idle` settles when nothing is running. */
export interface QueueRunner {
  kick: () => void;
  idle: () => Promise<void>;
}

/**
 * Reviews the waiting entries, up to `atOnce` at a time (GR-008; the settings file's number, 1 by default), each started in pasted
 * order, until none waits; a failure is written to its entry and the next goes on. Each of up to `atOnce` loops takes from the
 * same queue; a loop that finds nothing it may take stops, and each finished review kicks the runner again, so a site held back
 * because its host was being reviewed is taken once that review ends.
 */
// Decision: GR-008, GR-014
export function queueRunner(data: string, run: ReviewRun, atOnce = 1): QueueRunner {
  const working = new Set<Promise<void>>();
  // GR-014: the reviews running now, and the crawls being watched, each marked once another review runs at any moment of it.
  let running = 0;
  const crawling = new Set<{ beside: boolean }>();
  const alongside: Alongside = () => {
    const crawl = { beside: running > 1 };
    crawling.add(crawl);
    return () => {
      crawling.delete(crawl);
      return crawl.beside;
    };
  };
  const work = async (): Promise<void> => {
    // A queue file that cannot be read stops the runner, not the program: nothing more is taken, nothing written.
    const next = (): QueueEntry | null => whileReadable(() => take(data), null);
    for (let entry = next(); entry; entry = next()) {
      running += 1;
      for (const crawl of crawling) crawl.beside = true;
      let error: string | null;
      try {
        error = await run(entry.site, alongside);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      } finally {
        running -= 1;
      }
      whileReadable(() => finish(data, entry.id, error), undefined);
      kick();
    }
  };
  const kick = (): void => {
    while (working.size < atOnce) {
      const loop: Promise<void> = work().finally(() => working.delete(loop));
      working.add(loop);
    }
  };
  return {
    kick,
    idle: async () => {
      while (working.size) await Promise.all(working);
    },
  };
}

/**
 * The page's review of a site: the command's own review, its lines printed at the terminal, each after the site it is of (the
 * reviews run together); a failure's last line is its error. `browser` hands each review the queue's one Chromium (RF-09); the
 * runner's `alongside` goes to the review, which withholds SITE-22 when its crawl ran beside another review (GR-014).
 */
export function reviewLine(data: string, browser?: () => Promise<Browser | undefined>): ReviewRun {
  return async (site, alongside) => {
    let last = '';
    const say = (line: string) => {
      last = line;
      console.log(`${site}: ${line}`);
    };
    const { code } = await review({ site, data, say, browser: await browser?.(), alongside });
    return code === 0 ? null : last || `the review stopped (${code})`;
  };
}
