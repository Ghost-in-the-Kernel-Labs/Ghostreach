/**
 * The discovery lane (TODO 4.7, RF-08): "who is hiring QA that I have not heard of?". One saved search (the titles to look for, and a
 * location or "remote"), kept in `<data>/discovery.json`, run on request as one batch across every discovery-lane `in` source of
 * docs/SOURCES.md (`DISCOVERY`): a keyed source only with its key (`withKey`), the keyless ones always, each through the one fetch
 * function (`fetchSource`) and so within its cap. Each source asks its first page alone; Jooble and USAJOBS search one phrase a
 * request, so they are asked once per saved title (at most `MAX_SEARCH_TITLES`), Remotive (4 calls a day) and Arbeitnow (no search
 * parameter) once. A source over its cap, without its key, or failing is skipped and named at once, never waited on.
 *
 * The postings are filtered by the company lane's title rule (`isQaTitle`), then deduped by company: the key is the company's
 * name as `companyWords` reads it (accents folded, lowercase, a trailing legal form dropped), so "Acme Robotics, Inc." and "ACME
 * Robotics" are one company; the newest posting stands for it and the rest are counted. Everything a source answers is data
 * (P-16): titles and names kept as plain text, written escaped by the page; a posting's address kept only by `keptUrl` (https on
 * the source's own domain). None of the four sources gives a company's website (docs/SOURCES.md, its Website cells), so a row
 * carries none until 4.8 lets the salesperson type it.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanTitle, companyWords, isQaTitle, keptUrl } from './company.js';
import { fetchSource, type Fetched, type SourceRequest, type Transport } from './fetch.js';
import { KEYED_SOURCES, withKey } from './keys.js';

/** The saved search: the titles asked for, and where (a place, or "remote"). */
export interface SavedSearch {
  titles: string[];
  location: string;
}

/** The search before the salesperson edits it: the roadmap's four titles, remote. */
export const DEFAULT_SEARCH: SavedSearch = { titles: ['QA engineer', 'test automation', 'SDET', 'QA analyst'], location: 'remote' };
/** The most titles a search holds: each is a call to Jooble and to USAJOBS. */
export const MAX_SEARCH_TITLES = 5;
/** The longest title or location kept. */
const MAX_FIELD = 100;
/** How long one call may take: the salesperson waits on the run, every source asked at once. */
const CALL_TIMEOUT_MS = 15_000;

/** A posting as a source gives it: the company's name, the title, the address, and when it was posted (ISO, or '' unknown). */
interface Found {
  company: unknown;
  title: unknown;
  url: unknown;
  at: string;
}

/** One call: its address (Jooble's key rides in it, so it is never kept or shown) and its request. */
interface Call {
  url: string;
  request: SourceRequest;
}

/** A discovery-lane source: its row's name, the domain its postings are served from, its calls for a search, and how its documented answer reads. */
interface DiscoverySource {
  source: string;
  postingDomain: string;
  calls: (search: SavedSearch, key: Readonly<Record<string, string>>) => Call[];
  read: (answer: Fetched & { ok: true }, search: SavedSearch) => Found[] | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const body = (answer: Fetched & { ok: true }): unknown => (answer.kind === 'json' ? answer.json : undefined);
const remote = (search: SavedSearch): boolean => search.location.trim().toLowerCase() === 'remote';

/** A posting's day as ISO: a number is Unix seconds (Arbeitnow); a text date with no zone is read as UTC; anything else ''. */
export function stamp(value: unknown): string {
  let ms = Number.NaN;
  if (typeof value === 'number') ms = value * 1000;
  else if (typeof value === 'string') ms = Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/i.test(value) || !value.includes('T') ? value : `${value}Z`);
  return Number.isFinite(ms) && Math.abs(ms) <= 8.64e15 ? new Date(ms).toISOString() : '';
}

/** A list's objects read by a mapping; null when the list is not a list (not the documented shape). */
const each = (list: unknown, map: (item: Record<string, unknown>) => Found | null): Found[] | null =>
  Array.isArray(list) ? list.filter(isObject).map(map).filter((f): f is Found => f !== null) : null;

/**
 * The discovery-lane sources of docs/SOURCES.md with status `in`, in its order (held to it by test/unit/discover.test.ts). Each
 * call is its row's documented endpoint, first page only.
 */
export const DISCOVERY: readonly DiscoverySource[] = [
  {
    // POST /api/{key}: keywords and location in a JSON body ("location" required; a remote search sends none and says remote in the words).
    source: 'Jooble',
    postingDomain: 'jooble.org',
    calls: (search, key) => search.titles.map((title) => ({
      url: `https://jooble.org/api/${encodeURIComponent(key.JOOBLE_API_KEY)}`,
      request: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: remote(search) ? `${title} remote` : title, location: remote(search) ? '' : search.location, page: 1 }),
      },
    })),
    read: (answer) => {
      const b = body(answer);
      return isObject(b) ? each(b.jobs, (j) => ({ company: j.company, title: j.title, url: j.link, at: stamp(j.updated) })) : null;
    },
  },
  {
    // GET /api/job-board-api: its newest hundred postings, no search parameter; the location matched here, `remote` by its flag.
    source: 'Arbeitnow',
    postingDomain: 'arbeitnow.com',
    calls: () => [{ url: 'https://www.arbeitnow.com/api/job-board-api', request: {} }],
    read: (answer, search) => {
      const b = body(answer);
      if (!isObject(b)) return null;
      const place = search.location.trim().toLowerCase();
      return each(b.data, (j) => {
        const here = remote(search) ? j.remote === true : typeof j.location === 'string' && j.location.toLowerCase().includes(place);
        return here ? { company: j.company_name, title: j.title, url: j.url, at: stamp(j.created_at) } : null;
      });
    },
  },
  {
    // GET /api/remote-jobs in its Quality Assurance category (slug `qa`), at most a hundred: every posting is remote.
    source: 'Remotive',
    postingDomain: 'remotive.com',
    calls: () => [{ url: 'https://remotive.com/api/remote-jobs?category=qa&limit=100', request: {} }],
    read: (answer) => {
      const b = body(answer);
      return isObject(b) ? each(b.jobs, (j) => ({ company: j.company_name, title: j.title, url: j.url, at: stamp(j.publication_date) })) : null;
    },
  },
  {
    // GET /api/search by PositionTitle, a hundred rows; the registered email as User-Agent and the key as Authorization-Key.
    source: 'USAJOBS',
    postingDomain: 'usajobs.gov',
    calls: (search, key) => search.titles.map((title) => ({
      url: `https://data.usajobs.gov/api/search?${new URLSearchParams({ PositionTitle: title, ResultsPerPage: '100', ...(remote(search) ? { RemoteIndicator: 'True' } : { LocationName: search.location }) })}`,
      request: { headers: { 'User-Agent': key.USAJOBS_EMAIL, 'Authorization-Key': key.USAJOBS_API_KEY } },
    })),
    read: (answer) => {
      const b = body(answer);
      const result = isObject(b) && isObject(b.SearchResult) ? b.SearchResult : null;
      return result ? each(result.SearchResultItems, (item) => {
        const job = isObject(item.MatchedObjectDescriptor) ? item.MatchedObjectDescriptor : {};
        return { company: job.OrganizationName, title: job.PositionTitle, url: job.PositionURI, at: stamp(job.PublicationStartDate) };
      }) : null;
    },
  },
];

/** A company found: its newest QA posting (title, address when kept, source, day) and how many more were found for it. */
export interface DiscoveryRow {
  company: string;
  title: string;
  url?: string;
  source: string;
  at: string;
  others: number;
}

/** One run: when, the search it ran, one row per company newest first, and each source skipped with why. */
export interface DiscoveryRun {
  at: string;
  search: SavedSearch;
  rows: DiscoveryRow[];
  skipped: string[];
}

export interface DiscoverOptions {
  /** The data folder (the fetch function's buckets, and where the search and its last run are kept). */
  data: string;
  transport?: Transport;
  now?: () => Date;
  /** Where the keys are read from: the process's own environment, or a test's. */
  env?: Readonly<Record<string, string | undefined>>;
}

/** One source asked: its calls in turn, its postings; why it stopped, when it did (rows before the stop are kept). */
async function ask(source: DiscoverySource, search: SavedSearch, options: DiscoverOptions): Promise<{ found: (Found & { source: DiscoverySource })[]; why?: string }> {
  const keyed = KEYED_SOURCES.find((k) => k.source === source.source);
  let calls: Call[];
  if (keyed) {
    const got = withKey(keyed, (key) => source.calls(search, key), options.env);
    if ('skipped' in got) return { found: [], why: got.skipped };
    calls = got.ran;
  } else calls = source.calls(search, {});
  const found: (Found & { source: DiscoverySource })[] = [];
  for (const call of calls) {
    const answer = await fetchSource(source.source, call.url, call.request, { data: options.data, transport: options.transport, now: options.now, timeoutMs: CALL_TIMEOUT_MS });
    if (!answer.ok) return { found, why: answer.why };
    const read = source.read(answer, search);
    if (!read) return { found, why: `${source.source}: answered in a shape its documentation does not give.` };
    found.push(...read.map((f) => ({ ...f, source })));
  }
  return { found };
}

/** Whether `key` is new to `seen`, adding it. */
const once = (seen: Set<string>, key: string): boolean => !seen.has(key) && seen.add(key) !== undefined;

/** A company's name as kept: plain text on one line, as a title is. */
const cleanName = (name: unknown): string => (typeof name === 'string' ? cleanTitle(name) : '');

/**
 * Runs the search: every discovery source at once, its postings filtered to QA, test and SDET titles, then one row per company
 * (the newest posting, the rest counted), newest first. Returned, not kept: `keepRun` keeps it.
 */
export async function discover(search: SavedSearch, options: DiscoverOptions): Promise<DiscoveryRun> {
  const at = (options.now?.() ?? new Date()).toISOString();
  const answers = await Promise.all(DISCOVERY.map((source) => ask(source, search, options)));
  const seen = new Set<string>();
  const postings = answers.flatMap((a) => a.found)
    .map((f) => ({ company: cleanName(f.company), title: typeof f.title === 'string' ? cleanTitle(f.title) : '', url: keptUrl(f.url, f.source, null), source: f.source.source, at: f.at }))
    .filter((p) => p.company !== '' && p.title !== '' && isQaTitle(p.title))
    // One posting found under two titles (Jooble, USAJOBS) is one posting: by its source and address, or its company and title.
    .filter((p) => once(seen, `${p.source}\n${p.url ?? `${p.company}\n${p.title}`}`));
  // Newest first; a posting with no day last; a tie keeps the sources' order.
  postings.sort((a, b) => b.at.localeCompare(a.at));
  const byCompany = new Map<string, DiscoveryRow>();
  for (const p of postings) {
    const key = companyWords(p.company).join(' ');
    if (!key) continue;
    const held = byCompany.get(key);
    if (held) held.others++;
    else {
      const { url, ...rest } = p;
      byCompany.set(key, { ...rest, ...(url ? { url } : {}), others: 0 });
    }
  }
  return { at, search, rows: [...byCompany.values()], skipped: answers.flatMap((a) => (a.why ? [a.why] : [])) };
}

/** Text from the page's form as a search: titles one a line (none twice, at most `MAX_SEARCH_TITLES`), and a location; or why not. */
export function parseSearch(titles: string, location: string): { search: SavedSearch } | { refused: string } {
  const seen = new Set<string>();
  const list = titles.split(/\r?\n/).map((t) => cleanTitle(t).slice(0, MAX_FIELD)).filter((t) => t !== '' && once(seen, t.toLowerCase()));
  const place = cleanTitle(location).slice(0, MAX_FIELD);
  if (!list.length) return { refused: 'Type at least one title.' };
  if (list.length > MAX_SEARCH_TITLES) return { refused: `At most ${MAX_SEARCH_TITLES} titles.` };
  if (!place) return { refused: 'Type a location, or remote.' };
  return { search: { titles: list, location: place } };
}

export const discoveryFile = (data: string): string => join(data, 'discovery.json');

/** What the data folder keeps: the saved search, and the last run. */
interface Kept {
  search: SavedSearch;
  run?: DiscoveryRun;
}

/** The saved search and the last run; none saved yet, the default search. A file that cannot be read stops the page rather than be overwritten. */
export function readDiscovery(data: string): Kept {
  const file = discoveryFile(data);
  if (!existsSync(file)) return { search: DEFAULT_SEARCH };
  const read = JSON.parse(readFileSync(file, 'utf8')) as Partial<Kept>;
  if (!isObject(read.search) || !Array.isArray(read.search.titles)) throw new Error(`${file} is not a saved search.`);
  return { search: read.search, ...(read.run ? { run: read.run } : {}) };
}

function write(data: string, kept: Kept): void {
  mkdirSync(data, { recursive: true });
  const file = discoveryFile(data);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(kept, null, 2)}\n`);
  renameSync(temp, file);
}

/** Saves the search, the last run kept beside it; written whole, temporary file and rename. */
export function saveSearch(data: string, search: SavedSearch): void {
  write(data, { ...readDiscovery(data), search });
}

/** Keeps a run as the last one, in place of the one before. */
export function keepRun(data: string, run: DiscoveryRun): void {
  write(data, { ...readDiscovery(data), run });
}
