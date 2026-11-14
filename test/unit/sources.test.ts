import { describe, expect, it } from 'vitest';
import { COLUMNS, header, hostsOf, keysOf, parseSources, section, sourcesText, type Row } from '../support/sources.js';

// docs/SOURCES.md held (TODO 4.3, docs/ROADMAP.md §5, RF-06 to RF-08): one row per source the roadmap names, each cell
// filled, the closed sites paste only, an excluded source with its reason, each `unverified` cell's source a question,
// the keyed sources' variables named for 4.4. "Every source in code has a row" is red by design until 4.6 writes the first
// source: it is `it.fails`, which passes while `src/leads/sources.ts` is missing and fails the day it exports its first
// source, so 4.6 must turn it into `it` (as 1.1 held cut.test.ts until 1.2).

const text = sourcesText();
const rows = parseSources(text);
const byName = new Map(rows.map((r) => [r.source, r]));

/** The sources docs/ROADMAP.md §6 step 4.3 names, by lane. */
const NAMED: Record<string, string[]> = {
  company: ['Greenhouse', 'Lever', 'Ashby', 'SmartRecruiters', 'Workable', 'Recruitee', 'Personio', 'Rippling', 'Teamtailor', 'Breezy'],
  discovery: ['Adzuna', 'Jooble', 'The Muse', 'Arbeitnow', 'Remotive', 'USAJOBS'],
  closed: ['LinkedIn', 'Indeed', 'Glassdoor', 'ZipRecruiter'],
};
/** The four keyed sources whose variables 4.1's check reads here. */
const KEYED = ['Adzuna', 'Jooble', 'The Muse', 'USAJOBS'];
const STATUSES = ['in', 'excluded', 'unverified', 'paste only'];

/**
 * The sources the code reads, from `SOURCES` of `src/leads/sources.ts` (4.6 writes it: `{ name, host }` each, the name
 * a row's Source); none while the file is missing.
 */
async function sourcesInCode(): Promise<{ name: string; host: string }[]> {
  const url = new URL('../../src/leads/sources.ts', import.meta.url).href;
  const module = (await import(/* @vite-ignore */ url).catch(() => ({}))) as { SOURCES?: { name: string; host: string }[] };
  return module.SOURCES ?? [];
}

describe('docs/SOURCES.md (TODO 4.3)', () => {
  it('has the columns 4.3 asks, in order', () => {
    expect(header(text)).toEqual([...COLUMNS]);
  });
  it('has one row per source the roadmap names, in its lane, and no other', () => {
    const named = Object.entries(NAMED).flatMap(([lane, names]) => names.map((name) => `${name} ${lane}`));
    expect(rows.map((r) => `${r.source} ${r.lane}`).sort()).toEqual(named.sort());
  });
  it('fills every cell of every row, a status from the four', () => {
    expect(rows.filter((r) => r.cells.length !== COLUMNS.length || r.cells.some((c) => c.trim() === '')).map((r) => r.source)).toEqual([]);
    expect(rows.filter((r) => !STATUSES.includes(r.status)).map((r) => r.source)).toEqual([]);
    expect(rows.filter((r) => !['yes', 'no', 'unverified'].includes(r.linkBack.split(' ')[0])).map((r) => r.source)).toEqual([]);
  });
  it('gives each closed site a paste-only row, no host, its reason RF-06 (RF-06)', () => {
    const closed = rows.filter((r) => r.lane === 'closed');
    expect(closed.map((r) => r.source)).toEqual(NAMED.closed);
    expect(closed.filter((r) => r.status !== 'paste only' || r.host !== 'none' || !r.terms.startsWith('Paste only (RF-06)')).map((r) => r.source)).toEqual([]);
    expect(rows.filter((r) => r.status === 'paste only' && r.lane !== 'closed').map((r) => r.source)).toEqual([]);
  });
  it('says why each excluded source is excluded, citing its terms page', () => {
    const excluded = rows.filter((r) => r.status === 'excluded');
    expect(excluded.filter((r) => !/^Excluded: .+https:\/\/\S+/.test(r.terms)).map((r) => r.source)).toEqual([]);
  });
  it('gives each source it may read an exact host and its terms page', () => {
    const open = rows.filter((r) => r.status === 'in');
    expect(open.filter((r) => hostsOf(r.host).length === 0 || !/https:\/\/\S+/.test(r.terms)).map((r) => r.source)).toEqual([]);
  });
  it('names the environment variable of each keyed source 4.1 lists (4.4 reads it)', () => {
    const named = (row: Row | undefined): string[] => keysOf(row?.key ?? '');
    expect(KEYED.filter((name) => named(byName.get(name)).length === 0)).toEqual([]);
    expect(named(byName.get('Jooble'))).toEqual(['JOOBLE_API_KEY']);
    expect(rows.filter((r) => r.key.startsWith('free:') !== (named(r).length > 0 && !r.key.startsWith('unverified'))).map((r) => r.source)).toEqual([]);
  });
  it('names every source with an unverified cell under Questions', () => {
    const questions = section(text, 'Questions').join('\n');
    expect(rows.filter((r) => r.cells.some((c) => c.includes('unverified')) && !questions.includes(r.source)).map((r) => r.source)).toEqual([]);
  });
  it.fails('has a row, its status in and its host, for every source in code (passes at 4.6)', async () => {
    const code = await sourcesInCode();
    expect(code.length).toBeGreaterThan(0);
    expect(code.filter((s) => byName.get(s.name)?.status !== 'in' || !hostsOf(byName.get(s.name)?.host ?? '').includes(s.host)).map((s) => s.name)).toEqual([]);
  });
});
