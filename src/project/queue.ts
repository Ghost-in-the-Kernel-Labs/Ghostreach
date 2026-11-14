/**
 * The queue (TODO 3.3): the sites the salesperson pasted on the local page, one per line, kept in `<data>/queue.json` with a
 * state each (`waiting`, `running`, `done`, `failed`), and the runner that reviews them in the order they were pasted. A failed
 * site keeps its one error line and stays failed: only the salesperson puts it back (`retry`), never the runner. The file is
 * written whole to a temporary file and renamed over the old one, so a crash leaves the old queue or the new, never half of
 * one. Every change is read, made and written synchronously, so the page's requests and the runner, in one process, never
 * interleave inside one change.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { review, startUrl } from './review.js';

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
}

/** What a paste did: the sites queued, and each line refused with why. */
export interface Added {
  queued: QueueEntry[];
  refused: { line: string; why: string }[];
}

/** Reviews one site: null when the review was written, else one line saying why it was not. The page runs `reviewLine`; a test its own. */
export type ReviewRun = (site: string) => Promise<string | null>;

export const queueFile = (data: string): string => join(data, 'queue.json');

/** The queue as written; empty when there is none yet. A file that cannot be read stops the program rather than be overwritten. */
export function readQueue(data: string): QueueEntry[] {
  const file = queueFile(data);
  if (!existsSync(file)) return [];
  const read = JSON.parse(readFileSync(file, 'utf8')) as { sites?: QueueEntry[] };
  if (!Array.isArray(read.sites)) throw new Error(`${file} is not a queue: it has no list of sites.`);
  return read.sites;
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
 * (`startUrl`, the review's own test), or whose host is already waiting or running, is refused and never queued.
 */
export function addSites(data: string, text: string): Added {
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
      const entry: QueueEntry = { id: ++id, site: line, host, state: 'waiting' };
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
  if (!readQueue(data).some((e) => e.state === 'running')) return;
  update(data, (sites) => {
    for (const e of sites) if (e.state === 'running') e.state = 'waiting';
  });
}

/** Takes the first waiting entry, in pasted order, and marks it running; null when none waits. */
function take(data: string): QueueEntry | null {
  return update(data, (sites) => {
    const next = sites.find((e) => e.state === 'waiting');
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
 * Reviews the waiting entries one at a time, in pasted order, until none waits; a failure is written to its entry and the next
 * goes on. One worker loop: 3.4 runs up to N of these loops, each taking from the same queue.
 */
export function queueRunner(data: string, run: ReviewRun): QueueRunner {
  let working: Promise<void> | null = null;
  const work = async (): Promise<void> => {
    for (let entry = take(data); entry; entry = take(data)) {
      let error: string | null;
      try {
        error = await run(entry.site);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      finish(data, entry.id, error);
    }
  };
  return {
    kick: () => {
      working ??= work().finally(() => (working = null));
    },
    idle: async () => {
      while (working) await working;
    },
  };
}

/** The page's review of a site: the command's own review, its lines printed at the terminal; a failure's last line is its error. */
export function reviewLine(data: string): ReviewRun {
  return async (site) => {
    let last = '';
    const { code } = await review({ site, data, say: (line) => { last = line; console.log(line); } });
    return code === 0 ? null : last || `the review stopped (${code})`;
  };
}
