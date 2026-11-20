/**
 * The program's settings file (GR-008, P-15): `<data>/settings.json`, beside the queue, read once when the local page starts. It
 * holds the one setting that must vary between machines, how many reviews the queue runs at once, never a flag on the command
 * line. Its shape: `{ "reviewsAtOnce": 3 }`. No file, or no number in it, means this computer's recommendation (`recommended`,
 * GR-022); a value that is not a whole number from 1 to 5 is taken as the nearest that is (a number clamped to 1..5, anything else
 * the recommendation) and the page says so in one line.
 */
// Decision: GR-008, GR-022
import { existsSync, readFileSync } from 'node:fs';
import { availableParallelism, freemem, totalmem } from 'node:os';
import { join } from 'node:path';

/** The most reviews that ever run at once, whatever the file says (GR-008). */
const MOST_AT_ONCE = 5;

export const settingsFile = (data: string): string => join(data, 'settings.json');

/** What the settings file asks for: the reviews run at once, whether the file chose it, and, when the file asked for something else, the one line that says so. */
export interface Settings {
  reviewsAtOnce: number;
  fromFile: boolean;
  note: string | null;
}

const clamp = (n: number): number => Math.min(MOST_AT_ONCE, Math.max(1, Math.floor(n)));

/** The settings as the file asks, each value made one the program can run (1..5), else this machine's recommendation; the file itself is never rewritten. */
// Decision: GR-022
export function readSettings(data: string, machine: Machine = thisMachine()): Settings {
  const fallback = recommended(machine);
  const said = (why: string): Settings => ({ reviewsAtOnce: fallback, fromFile: false, note: `${why}, so ${fallback === 1 ? '1 review runs' : `${fallback} reviews run`} at once, recommended for this computer.` });
  const file = settingsFile(data);
  if (!existsSync(file)) return { reviewsAtOnce: fallback, fromFile: false, note: null };
  let asked: unknown;
  try {
    asked = (JSON.parse(readFileSync(file, 'utf8')) as { reviewsAtOnce?: unknown } | null)?.reviewsAtOnce;
  } catch {
    return said('settings.json could not be read');
  }
  if (asked === undefined) return { reviewsAtOnce: fallback, fromFile: false, note: null };
  if (typeof asked !== 'number' || !Number.isFinite(asked)) return said("settings.json's reviewsAtOnce is not a number");
  const n = clamp(asked);
  if (n === asked) return { reviewsAtOnce: n, fromFile: true, note: null };
  return { reviewsAtOnce: n, fromFile: true, note: `settings.json asks for ${asked} reviews at once; ${n} run at once (a whole number from 1 to ${MOST_AT_ONCE}).` };
}

/** What `ghostreach doctor` reads of the machine: its memory, in bytes, and its processor cores. */
export interface Machine {
  totalBytes: number;
  freeBytes: number;
  cores: number;
}

export const thisMachine = (): Machine => ({ totalBytes: totalmem(), freeBytes: freemem(), cores: availableParallelism() });

const GB = 1024 ** 3;

/**
 * The reviews at once a machine can carry: one for each 1 GB of free memory and one for each 2 cores, whichever allows fewer,
 * from 1 to 5. A review's crawl is a Chromium context and its pages (a few hundred MB at most) and a share of the processor; the
 * margin leaves the salesperson's own browser room.
 */
// Decision: GR-008
export function recommended(machine: Machine): number {
  return clamp(Math.min(machine.freeBytes / GB, machine.cores / 2));
}

/** The doctor's report, in plain words: the machine, then the reviews at once it uses and why (the settings file, else the recommendation). */
// Decision: GR-022
export function doctorLines(data: string, machine: Machine): string[] {
  const gb = (bytes: number) => (bytes / GB).toFixed(1);
  const n = recommended(machine);
  const set = readSettings(data, machine);
  const uses = set.fromFile
    ? `Reviews at once: ${set.reviewsAtOnce}, as ${settingsFile(data)} asks (${n} is recommended for this computer).`
    : `Reviews at once: ${n}, recommended for this computer (one for each 1 GB free and each 2 cores, whichever is fewer, from 1 to ${MOST_AT_ONCE}).`;
  return [
    `This computer has ${gb(machine.totalBytes)} GB of memory, ${gb(machine.freeBytes)} GB of it free now, and ${machine.cores} processor core${machine.cores === 1 ? '' : 's'}.`,
    `${uses}${set.note ? ` ${set.note}` : ''}`,
  ];
}
