/**
 * The company lane (TODO 4.6, RF-07): "is this company hiring QA?" for a company the salesperson names. From the name, or the site,
 * typed on the local page, a few candidate board names are derived (`candidateSlugs`, no search engine); each company-lane source of
 * docs/SOURCES.md (`BOARDS`, the `in` ATS rows alone) is asked at its public per-company endpoint through the one fetch function
 * (`fetchSource`), slug by slug, until its first board; a board found lists its open roles whose titles read as QA, test or SDET
 * (`isQaTitle`). Probing is bounded: at most `MAX_SLUGS` names, so at most `MAX_CALLS` calls a company, and a source stops at its
 * first board. No source with a board: "no public board found", and the paste lane offered (4.9).
 *
 * Everything a board answers is data (P-16): a title is kept as plain text, cut to `MAX_TITLE` characters, and written escaped by
 * the page; a posting's address is kept only when it is https, on the default port, and on the source's own domain or the company's
 * (`keptUrl`), else the title stands alone. The lookups are kept in `<data>/companies.json`, written whole, newest first.
 */
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchSource, htmlToText, type Fetched, type Transport } from './fetch.js';
import { readKept } from './kept.js';

/** The most candidate board names tried for one company. */
export const MAX_SLUGS = 3;
/** How long one probe may take: a lookup the salesperson waits on, every source asked at once. */
const PROBE_TIMEOUT_MS = 10_000;
/** The longest title kept; a longer one is cut and ends in an ellipsis. */
const MAX_TITLE = 200;
/** The most QA roles kept from one board. */
const MAX_ROLES = 100;

/** A posting read off a board: its title as given, and the address the board gives for it, if any. */
interface Posting {
  title: string;
  url?: unknown;
}

/**
 * A company-lane source: its row's name, the domain its postings are served from (a posting's address on it is kept), the calls
 * that probe one board name in order (Lever's two instances), and how its documented answer reads: the postings, or null when
 * the answer is not its documented shape.
 */
export interface Board {
  source: string;
  postingDomain: string | null;
  probes: (slug: string) => string[];
  read: (answer: Fetched & { ok: true }) => Posting[] | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const json = (answer: Fetched & { ok: true }): unknown => (answer.kind === 'json' ? answer.json : undefined);

/** A list's items as postings, each item's title and address read by the given keys; an item without a text title is skipped. */
function postings(list: unknown, title: string, url: string | null, keep: (item: Record<string, unknown>) => boolean = () => true): Posting[] | null {
  if (!Array.isArray(list)) return null;
  return list.filter(isObject).filter(keep).filter((item) => typeof item[title] === 'string').map((item) => ({ title: item[title] as string, url: url ? item[url] : undefined }));
}

/** Personio's XML feed: each `<position>`'s own `<name>` (its description blocks' names left out) as a title; no address is given. */
function personioPositions(xml: string): Posting[] | null {
  if (!/<workzag-jobs[\s>]/.test(xml)) return null;
  const found: Posting[] = [];
  let at = 0;
  for (;;) {
    const open = xml.indexOf('<position>', at);
    if (open < 0) break;
    const close = xml.indexOf('</position>', open);
    if (close < 0) break;
    let block = xml.slice(open + '<position>'.length, close);
    at = close + '</position>'.length;
    const descriptions = block.indexOf('<jobDescriptions>');
    if (descriptions >= 0) {
      const end = block.indexOf('</jobDescriptions>', descriptions);
      block = block.slice(0, descriptions) + (end < 0 ? '' : block.slice(end));
    }
    const start = block.indexOf('<name>');
    const stop = start < 0 ? -1 : block.indexOf('</name>', start);
    if (stop < 0) continue;
    const raw = block.slice(start + '<name>'.length, stop).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    found.push({ title: htmlToText(raw) });
  }
  return found;
}

/**
 * The company-lane sources of docs/SOURCES.md with status `in`, in its order (each held to `FETCHED_SOURCES` by
 * test/unit/company.test.ts). Each probe is the row's documented per-company endpoint; optional parameters that only add text the
 * lane does not read (Greenhouse's `content`, Ashby's `includeCompensation`) are left off. SmartRecruiters' `ref` is the posting's
 * API address, not a page, and Personio's feed gives none: their roles are listed without a link.
 */
export const BOARDS: readonly Board[] = [
  {
    source: 'Greenhouse',
    postingDomain: 'greenhouse.io',
    probes: (slug) => [`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`],
    read: (answer) => {
      const body = json(answer);
      return isObject(body) ? postings(body.jobs, 'title', 'absolute_url') : null;
    },
  },
  {
    source: 'Lever',
    postingDomain: 'lever.co',
    probes: (slug) => [`https://api.lever.co/v0/postings/${slug}?mode=json`, `https://api.eu.lever.co/v0/postings/${slug}?mode=json`],
    read: (answer) => postings(json(answer), 'text', 'hostedUrl'),
  },
  {
    source: 'Ashby',
    postingDomain: 'ashbyhq.com',
    probes: (slug) => [`https://api.ashbyhq.com/posting-api/job-board/${slug}`],
    read: (answer) => {
      const body = json(answer);
      // An unlisted job "should only be available via direct link" (Ashby's own page): not listed here either.
      return isObject(body) ? postings(body.jobs, 'title', 'jobUrl', (job) => job.isListed !== false) : null;
    },
  },
  {
    source: 'SmartRecruiters',
    postingDomain: null,
    probes: (slug) => [`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`],
    read: (answer) => {
      const body = json(answer);
      return isObject(body) ? postings(body.content, 'name', null) : null;
    },
  },
  {
    source: 'Recruitee',
    postingDomain: 'recruitee.com',
    probes: (slug) => [`https://${slug}.recruitee.com/api/offers/`],
    read: (answer) => {
      const body = json(answer);
      return isObject(body) ? postings(body.offers, 'title', 'careers_url') : null;
    },
  },
  {
    source: 'Personio',
    postingDomain: null,
    probes: (slug) => [`https://${slug}.jobs.personio.de/xml`],
    read: (answer) => (answer.kind === 'text' ? personioPositions(answer.text) : null),
  },
];

/** The most calls one company's lookup makes: every candidate name at every source, Lever's two instances each. */
export const MAX_CALLS = MAX_SLUGS * BOARDS.reduce((sum, b) => sum + b.probes('x').length, 0);

/** A board name a source's address can carry: one DNS label, lowercase letters, digits and inner hyphens. */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** Words naming a company's legal form, dropped from the end of a name: "Acme Robotics, Inc." is "acme robotics". */
const LEGAL = new Set(['inc', 'incorporated', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company', 'gmbh', 'ag', 'sa', 'sas', 'bv', 'nv', 'plc', 'se', 'oy', 'ab', 'as', 'srl', 'spa', 'pty', 'kg']);
/** Second-level labels under a two-letter country code that a company does not own: `acme.co.uk` is Acme's, `co.uk` is not. */
const SHARED_SECOND = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu', 'ne', 'or']);

/** What a typed company gives the probes: the board names to try, and the company's own domain when a site was typed. */
export interface Candidates {
  slugs: string[];
  companyDomain: string | null;
}

/**
 * A name's words: accents folded, lowercase, split on anything not a letter or digit, its legal form dropped from the end. The
 * discovery lane's company key is these words joined by a space (`discover.ts`).
 */
export function companyWords(name: string): string[] {
  const all = name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  while (all.length > 1 && LEGAL.has(all[all.length - 1])) all.pop();
  return all;
}

/** A typed site's host, lowercase, `www.` dropped; null when the text is not a site (a space in it, no dot, or no host). */
function siteHost(text: string): string | null {
  if (/\s/.test(text) || (!/^https?:\/\//i.test(text) && !/^[^/]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(text))) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname.toLowerCase().replace(/\.$/, '');
    return host.includes('.') ? host.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}

/**
 * The candidate board names for what the salesperson typed (the rule, in order, at most `MAX_SLUGS`, each a valid label, none twice):
 * a site gives its domain's own label (the label before the public suffix: `careers.acme-robotics.co.uk` gives `acme-robotics`, a
 * two-letter country code under `co`, `com`, `org` and their like counted as one suffix), then that label without its hyphens; a
 * name gives its words joined (`Acme Robotics, Inc.` gives `acmerobotics`), then joined by hyphens (`acme-robotics`). The first
 * word alone is never tried: `General Motors` as `general` would find another company's board.
 */
export function candidateSlugs(typed: string): Candidates {
  const text = typed.trim().slice(0, MAX_TITLE);
  const host = siteHost(text);
  let slugs: string[];
  let companyDomain: string | null = null;
  if (host) {
    const labels = host.split('.');
    const two = labels.length >= 3 && labels[labels.length - 1].length === 2 && SHARED_SECOND.has(labels[labels.length - 2]);
    const own = labels.slice(two ? -3 : -2);
    companyDomain = own.join('.');
    slugs = [own[0], own[0].replace(/-/g, '')];
  } else {
    const named = companyWords(text);
    slugs = [named.join(''), named.join('-')];
  }
  return { slugs: [...new Set(slugs)].filter((s) => SLUG.test(s)).slice(0, MAX_SLUGS), companyDomain };
}

/** Words that make a title QA on their own. */
const QA_WORDS = new Set(['qa', 'qe', 'sdet', 'sdets', 'tester', 'testers']);
/** Two-word phrases that make a title QA. */
const QA_PHRASES = new Set(['quality assurance', 'quality engineer', 'quality engineering', 'software quality', 'in test']);
/** Words that make `test` or `testing` beside them a QA title: "Test Automation Engineer", "Manual Testing", "Test Lead". */
const TEST_MATES = new Set(['automation', 'automated', 'engineer', 'engineers', 'engineering', 'analyst', 'lead', 'manager', 'architect', 'specialist', 'software', 'qa', 'manual', 'performance', 'functional', 'regression']);

/**
 * Whether a posting's title is a QA, test or SDET role (the rule): a word `QA`, `QE`, `SDET` or `tester`; or a phrase "quality
 * assurance", "quality engineer(ing)", "software quality" or "in test" (Software Engineer in Test); or `test` or `testing` as a
 * whole word next to a word of the trade (automation, engineer, analyst, lead, manager, manual, performance and their like).
 * Words are whole, case aside: "Test Kitchen Chef", "Contest Manager", "Attestation Analyst" and "Latest Products Lead" are not QA.
 * Known to pass a few that are not software QA: a manufacturing "Quality Engineer", a "Penetration Tester".
 */
export function isQaTitle(title: string): boolean {
  const w = title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return w.some((word, i) => {
    if (QA_WORDS.has(word)) return true;
    if (i > 0 && QA_PHRASES.has(`${w[i - 1]} ${word}`)) return true;
    return (word === 'test' || word === 'testing') && ((i > 0 && TEST_MATES.has(w[i - 1])) || (i + 1 < w.length && TEST_MATES.has(w[i + 1])));
  });
}

/** Whether `host` is `domain` or a host under it. */
const under = (host: string, domain: string): boolean => host === domain || host.endsWith(`.${domain}`);

/**
 * A posting's address as kept (P-16): a string that parses as https, on the default port, with no credentials, whose host is on
 * the source's own posting domain or the company's typed domain; anything else is not kept (undefined), and the title is shown
 * without a link. Never fetched: the salesperson may open it.
 */
export function keptUrl(url: unknown, board: Pick<Board, 'postingDomain'>, companyDomain: string | null): string | undefined {
  if (typeof url !== 'string' || !URL.canParse(url)) return undefined;
  const address = new URL(url);
  if (address.protocol !== 'https:' || address.port !== '' || address.username !== '' || address.password !== '') return undefined;
  const host = address.hostname.toLowerCase();
  const ok = (board.postingDomain !== null && under(host, board.postingDomain)) || (companyDomain !== null && under(host, companyDomain));
  return ok ? address.href : undefined;
}

/** A title as kept: plain text on one line, control characters gone, at most `MAX_TITLE` characters. */
export function cleanTitle(title: string): string {
  const line = title.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return line.length > MAX_TITLE ? `${line.slice(0, MAX_TITLE - 1)}…` : line;
}

/** A QA role on a board: its title, and its address when kept. */
interface Role {
  title: string;
  url?: string;
}

/**
 * A board found: the source, the name it answered under, how many open postings it lists, and the QA roles among them. `named`
 * when the board's own answer names the company (`namesCompany`); absent, the board was found by a guessed name alone and may be
 * another company's (launch fixes 12; a lookup kept before reads so too).
 */
interface FoundBoard {
  source: string;
  slug: string;
  open: number;
  roles: Role[];
  named?: true;
}

/** Every text value of an answer: a JSON answer's strings, at any depth; a text answer as it came. */
function textsOf(answer: Fetched & { ok: true }): string[] {
  if (answer.kind !== 'json') return answer.kind === 'text' ? [answer.text] : [];
  const found: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') found.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (isObject(v)) Object.values(v).forEach(walk);
  };
  walk(answer.json);
  return found;
}

/** Text as words: accents folded, lowercase, one space between, a space at each end (so a phrase is found whole). */
const asWords = (text: string): string => ` ${text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(' ')} `;

/**
 * Whether a board's own answer names the company (launch fixes 12): a typed site's domain anywhere in it (a posting on the
 * company's own site, a mail address there), a whole domain, not one inside another (`notexample.com`, `example.com.evil.net`);
 * a typed name's words, in order, in a text that is not an address. Addresses and host names are left out for a name, since the
 * board's own addresses carry the guessed name itself (`acme-robotics.recruitee.com`). No fetch beyond the probe's own.
 */
function namesCompany(answer: Fetched & { ok: true }, typed: string, companyDomain: string | null): boolean {
  const texts = textsOf(answer);
  if (companyDomain) {
    const domain = new RegExp(`(?:^|[^a-z0-9-])${companyDomain.replace(/[.]/g, '\\.')}(?![a-z0-9-]|\\.[a-z0-9])`, 'i');
    return texts.some((t) => domain.test(t));
  }
  const name = companyWords(typed).join(' ');
  return name !== '' && texts.some((t) => asWords(t.replace(/\S*:\/\/\S*|\S*[a-z0-9]\.[a-z]\S*/gi, ' ')).includes(` ${name} `));
}

/** One lookup: what was typed, when, the names tried, each board found, and each source that could not be asked, with why. */
export interface CompanyLookup {
  asked: string;
  at: string;
  slugs: string[];
  boards: FoundBoard[];
  unanswered: string[];
  /** Why nothing was asked: the typed text gave no board name. */
  refused?: string;
}

export interface LookupOptions {
  /** The data folder (the fetch function's buckets, and where the lookups are kept). */
  data: string;
  transport?: Transport;
  now?: () => Date;
}

/** One source asked: its first board among the names, or none (each name answered 404, a redirect, or no open posting), or why it could not be asked. */
async function probe(board: Board, typed: string, slugs: readonly string[], companyDomain: string | null, options: LookupOptions): Promise<FoundBoard | string | null> {
  for (const slug of slugs) {
    for (const url of board.probes(slug)) {
      const answer = await fetchSource(board.source, url, {}, { data: options.data, transport: options.transport, now: options.now, timeoutMs: PROBE_TIMEOUT_MS });
      if (!answer.ok) {
        // No board under this name here: a 404 or 410, or a redirect (to a page that is not the board).
        if (answer.status !== undefined && (answer.status === 404 || answer.status === 410 || (answer.status >= 300 && answer.status < 400))) continue;
        return answer.why;
      }
      const listed = board.read(answer);
      if (!listed) return `${board.source}: answered in a shape its documentation does not give.`;
      // An empty board reads as no board: a company with no open posting is not hiring, and another name may be its board.
      if (!listed.length) continue;
      const roles = listed
        .map((p) => ({ title: cleanTitle(p.title), url: keptUrl(p.url, board, companyDomain) }))
        .filter((r) => r.title !== '' && isQaTitle(r.title))
        .slice(0, MAX_ROLES)
        .map((r) => (r.url ? r : { title: r.title }));
      return { source: board.source, slug, open: listed.length, roles, ...(namesCompany(answer, typed, companyDomain) ? { named: true as const } : {}) };
    }
  }
  return null;
}

/**
 * Looks a company up: its candidate names, then every company-lane source asked at once, each name in turn until its first board
 * (at most `MAX_CALLS` calls in all). The lookup is returned, not kept: `keepLookup` keeps it.
 */
export async function lookUpCompany(typed: string, options: LookupOptions): Promise<CompanyLookup> {
  const asked = typed.trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE);
  const at = (options.now?.() ?? new Date()).toISOString();
  const { slugs, companyDomain } = candidateSlugs(typed);
  if (!slugs.length) return { asked, at, slugs, boards: [], unanswered: [], refused: 'Type a company name or its site.' };
  const answers = await Promise.all(BOARDS.map((board) => probe(board, typed, slugs, companyDomain, options)));
  return {
    asked,
    at,
    slugs,
    boards: answers.filter((a): a is FoundBoard => typeof a === 'object' && a !== null),
    unanswered: answers.filter((a): a is string => typeof a === 'string'),
  };
}

export const companiesFile = (data: string): string => join(data, 'companies.json');

/** The lookups kept, newest first; none yet, none. A file that cannot be read is `Unreadable`, never overwritten (`kept.ts`). */
export function readLookups(data: string): CompanyLookup[] {
  return readKept(companiesFile(data), (read) => (isObject(read) && Array.isArray(read.lookups) ? (read.lookups as CompanyLookup[]) : undefined)) ?? [];
}

/** Keeps a lookup first, in place of an earlier one of the same company (as typed, case aside); written whole, temporary file and rename. */
export function keepLookup(data: string, lookup: CompanyLookup): void {
  const kept = [lookup, ...readLookups(data).filter((l) => l.asked.toLowerCase() !== lookup.asked.toLowerCase())];
  mkdirSync(data, { recursive: true });
  const file = companiesFile(data);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ lookups: kept }, null, 2)}\n`);
  renameSync(temp, file);
}
