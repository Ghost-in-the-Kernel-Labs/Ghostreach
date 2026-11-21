/**
 * The lead finder's keys (TODO 4.4, docs/SOURCES.md's Key cells; GR-023): each keyed source's key comes from one of two places,
 * read at the moment a fetch needs it and handed to that fetch alone, never kept in memory, printed, logged or returned. First the
 * named environment variable (the server deployment's `/etc/ghostreach/env`, or a computer set up by hand): when set, it wins.
 * Else `<data>/keys.json`, which the salesperson fills from the local page's "Lead sources" (`saveKey`, `removeKey`), written
 * whole (a new temporary file, then a rename), mode 0600 on Linux and macOS; on Windows the data folder sits in the user's profile
 * folder, which only that user can read. The page asks only where each key comes from (`keyStates`) and never holds a key; it may
 * show USAJOBS's email address, which is not a secret. A source without its key is skipped with one line saying so (`withKey`).
 * The Muse's `MUSE_API_KEY` is not read: its row is `unverified`, read by nothing (J-034); Adzuna's variables neither: `excluded`.
 */
// Decision: GR-023
import { existsSync, mkdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRecord, readKept } from './kept.js';

/** A keyed source and the variables its key is read from: every one set, or the source is skipped. */
export interface KeyedSource {
  source: string;
  variables: readonly string[];
}

/** The keyed `in` sources of docs/SOURCES.md, its Key cells' variables in order (`test/unit/keys.test.ts` holds them to it). */
export const KEYED_SOURCES: readonly KeyedSource[] = [
  { source: 'Jooble', variables: ['JOOBLE_API_KEY'] },
  // USAJOBS asks the registered email as `User-Agent` beside the key: both, or the source is skipped.
  { source: 'USAJOBS', variables: ['USAJOBS_API_KEY', 'USAJOBS_EMAIL'] },
];

/** Where the variables are read from: the process's own environment, or a test's. */
type Env = Readonly<Record<string, string | undefined>>;

/** A variable that holds an email address, not a key: shown on the page, held to an address's shape. */
const isEmail = (name: string): boolean => name.endsWith('_EMAIL');

const isSet = (value: string | undefined): value is string => (value ?? '').trim() !== '';

export const keysFile = (data: string): string => join(data, 'keys.json');

/** The values saved from the page, by variable name; none yet, none. A file that cannot be read is `Unreadable` (`kept.ts`). */
function readSaved(data: string): Record<string, string> {
  const shape = (read: unknown): Record<string, string> | undefined =>
    isRecord(read) && Object.values(read).every((v) => typeof v === 'string') ? (read as Record<string, string>) : undefined;
  return readKept(keysFile(data), shape) ?? {};
}

/** The saved value of one variable, an own key of what is saved alone. */
const savedOf = (saved: Readonly<Record<string, string>>, name: string): string | undefined => (Object.hasOwn(saved, name) ? saved[name] : undefined);

/** One variable's value: the environment's when set there, else the one saved from the page. */
function envOr(env: Env, name: string, saved: Readonly<Record<string, string>>): string | undefined {
  const set = env[name];
  return isSet(set) ? set : savedOf(saved, name);
}

/** Where a source's key comes from: this computer's settings (every variable set in the environment), the page, or nowhere yet. */
type KeyFrom = 'computer' | 'page' | null;

/** A keyed source as the page shows it: where its key comes from, and USAJOBS's email address, never a key. */
export interface KeyState {
  source: string;
  from: KeyFrom;
  email?: string;
}

/** Each keyed source and where its key comes from: what the local page shows, never a key; USAJOBS's email, which is not one. */
export function keyStates(data: string, env: Env = process.env): KeyState[] {
  const all = (names: readonly string[], has: (name: string) => boolean) => names.every(has);
  return KEYED_SOURCES.map(({ source, variables }) => {
    if (all(variables, (name) => isSet(env[name]))) return { source, from: 'computer' };
    const saved = readSaved(data);
    const value = (name: string) => envOr(env, name, saved);
    if (!all(variables, (name) => isSet(value(name)))) return { source, from: null };
    const email = variables.find(isEmail);
    return email ? { source, from: 'page', email: value(email)?.trim() } : { source, from: 'page' };
  });
}

/** The line a source without its key is skipped with: its name and where a key goes, never a value. */
export function skipLine(keyed: KeyedSource): string {
  return `${keyed.source} skipped: no key yet (save one under Lead sources).`;
}

/**
 * Runs `use` with the source's key, each variable read now, the environment's first, else the one saved from the page in `data`,
 * and handed to `use` alone; without every variable, `use` is not called and the source is skipped with its line. What `use`
 * returns is the caller's: it never holds the key.
 */
export function withKey<T>(keyed: KeyedSource, use: (key: Readonly<Record<string, string>>) => T, env: Env = process.env, data?: string): { ran: T } | { skipped: string } {
  const fromEnv = keyed.variables.every((name) => isSet(env[name]));
  const saved = fromEnv || data === undefined ? {} : readSaved(data);
  const value = (name: string): string => (envOr(env, name, saved) ?? '').trim();
  if (!keyed.variables.every((name) => value(name) !== '')) return { skipped: skipLine(keyed) };
  return { ran: use(Object.fromEntries(keyed.variables.map((name) => [name, value(name)]))) };
}

/** A key as saved: 8 to 200 printable characters, no space, no control character. Held lightly: the provider is the judge. */
const KEY = /^[\x21-\x7e]{8,200}$/;
/** An email address as saved: one `@`, a dot after it, no space or markup character, at most 254 characters. */
const EMAIL = /^[^\s@<>"'\\]{1,64}@[^\s@<>"'\\]+\.[^\s@<>"'\\]+$/;

/** The sentences a save is refused with: none repeats what was typed. */
export const REFUSED = {
  source: 'Not saved: no such lead source.',
  key: 'Not saved: a key is 8 to 200 letters, digits or signs, with no spaces.',
  email: 'Not saved: type the email address you gave when you asked for the key.',
} as const;

/** Writes what is saved whole: a new temporary file beside it, readable by its owner alone, then a rename over it; none left, no file. */
function writeSaved(data: string, saved: Readonly<Record<string, string>>): void {
  const file = keysFile(data);
  if (!Object.keys(saved).length) {
    if (existsSync(file)) unlinkSync(file);
    return;
  }
  mkdirSync(data, { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    // `wx`: a new file, so its mode is the one given here (0600, less any umask), never an old file's.
    writeFileSync(temp, `${JSON.stringify(saved, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    renameSync(temp, file);
  } finally {
    rmSync(temp, { force: true });
  }
}

/**
 * Saves a source's key typed on the page (and USAJOBS's email address), replacing any saved before; a refusal is one of
 * `REFUSED`, never the typed text. Fetches nothing: whether the provider takes the key is seen at the next search.
 */
export function saveKey(data: string, source: string, typed: { key: string; email?: string }): string | undefined {
  const keyed = KEYED_SOURCES.find((k) => k.source === source);
  if (!keyed) return REFUSED.source;
  const key = typed.key.trim();
  const email = (typed.email ?? '').trim();
  if (!KEY.test(key)) return REFUSED.key;
  const needsEmail = keyed.variables.some(isEmail);
  if (needsEmail && (email.length > 254 || !EMAIL.test(email))) return REFUSED.email;
  const saved = readSaved(data);
  for (const name of keyed.variables) saved[name] = isEmail(name) ? email : key;
  writeSaved(data, saved);
  return undefined;
}

/** Removes a source's saved key (and its email address); the file goes when nothing is left in it. */
export function removeKey(data: string, source: string): void {
  const keyed = KEYED_SOURCES.find((k) => k.source === source);
  if (!keyed) return;
  const saved = readSaved(data);
  if (!keyed.variables.some((name) => Object.hasOwn(saved, name))) return;
  writeSaved(data, Object.fromEntries(Object.entries(saved).filter(([name]) => !keyed.variables.includes(name))));
}
