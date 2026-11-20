/**
 * A data file the program keeps in the data folder (`queue.json`, `companies.json`, `discovery.json`, `leads.json`), read back.
 * One that is there but cannot be read, its JSON broken or its shape not the program's, is `Unreadable`: never overwritten (every
 * change reads first, so it meets this before it writes; the salesperson's data is kept for Ghost to look at), and the local
 * page stays up and says so in one line naming it (`unreadableLine`). `settings.json` and `buckets.json` keep their own readers,
 * which already refuse without throwing.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

/** A kept file that is there but cannot be read: `file` is its name in the data folder. */
export class Unreadable extends Error {
  constructor(readonly file: string) {
    super(unreadableLine(file));
  }
}

/** The one line the page shows for a kept file it cannot read. */
export const unreadableLine = (file: string): string => `${file} in the data folder cannot be read, so it is left as it is and nothing is written to it.`;

/**
 * The file's content as `shape` takes it; undefined when there is no file yet. `shape` gives undefined for JSON that is not the
 * file's shape; that, or JSON that does not parse, or a read that fails, throws `Unreadable`.
 */
export function readKept<T>(path: string, shape: (read: unknown) => T | undefined): T | undefined {
  if (!existsSync(path)) return undefined;
  let taken: T | undefined;
  try {
    taken = shape(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    taken = undefined;
  }
  if (taken === undefined) throw new Unreadable(basename(path));
  return taken;
}

/** A JSON object (not null, not an array). */
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
