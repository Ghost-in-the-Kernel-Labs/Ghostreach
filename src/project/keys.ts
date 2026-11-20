/**
 * The lead finder's keys (TODO 4.4, docs/SOURCES.md's Key cells): one named environment variable per keyed source the code
 * may read (an `in` row), read at the moment a fetch needs it and handed to that fetch alone, never kept, printed, logged or
 * written. The local page asks only whether each is set (`keyStates`), so it can say "key present" or "key absent" and never
 * holds a key; a source without its key is skipped with one line saying so (`withKey`). The Muse's `MUSE_API_KEY` is not read:
 * its row is `unverified`, read by nothing (J-034); Adzuna's variables neither: its row is `excluded`.
 */

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

const isSet = (env: Env, name: string): boolean => (env[name] ?? '').trim() !== '';

/** Each keyed source and whether its key is present: what the local page shows, a yes or a no, never a value. */
export function keyStates(env: Env = process.env): { source: string; variables: readonly string[]; present: boolean }[] {
  return KEYED_SOURCES.map(({ source, variables }) => ({ source, variables, present: variables.every((name) => isSet(env, name)) }));
}

/** The line a source without its key is skipped with: its name and the variables to set, never a value. */
export function skipLine(keyed: KeyedSource): string {
  return `${keyed.source} skipped: no key (set ${keyed.variables.join(' and ')}).`;
}

/**
 * Runs `use` with the source's key, each variable by name, read now and handed to `use` alone; without every variable set,
 * `use` is not called and the source is skipped with its line. What `use` returns is the caller's: it never holds the key.
 */
export function withKey<T>(keyed: KeyedSource, use: (key: Readonly<Record<string, string>>) => T, env: Env = process.env): { ran: T } | { skipped: string } {
  if (!keyed.variables.every((name) => isSet(env, name))) return { skipped: skipLine(keyed) };
  return { ran: use(Object.fromEntries(keyed.variables.map((name) => [name, (env[name] ?? '').trim()]))) };
}
