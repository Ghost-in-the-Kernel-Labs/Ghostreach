/**
 * What the salesperson keeps about a company row of the lead finder (TODO 4.8): the company's website, typed on the local page,
 * since no source gives one (docs/SOURCES.md, its Website cells). Never looked up: no search engine, no fetch (GR-005); the typed
 * text is held to the test a review holds a site to (`startUrl`), and kept in `<data>/leads.json`, written whole (temporary file
 * and rename). A row is one company by the company lane's words (`companyWords`), so the discovery lane's "ACME Robotics" and the
 * company lane's "Acme Robotics, Inc." share what is kept.
 *
 * The paste lane (TODO 4.9, RF-06): a posting the salesperson saw on a closed site (LinkedIn, Indeed, Glassdoor, ZipRecruiter;
 * docs/SOURCES.md's `paste only` rows) is kept on its company's row as a note, its address alone, and never fetched: nothing here
 * imports the fetch function, and the page shows the address as text in a link the salesperson may open.
 *
 * "Queue this site" (TODO 4.10): a row with a website goes into the queue (3.3) with the lead as its reason (`leadOf`), read here
 * from what the data folder keeps of that row, never from the form beyond the company's name and its lane.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { candidateSlugs, cleanTitle, companyWords, readLookups } from './company.js';
import { readDiscovery } from './discover.js';
import type { Reason } from './queue.js';
import { startUrl } from './review.js';

/** The longest website kept. */
const MAX_SITE = 300;

/** The closed sites' domains, one per `paste only` row of docs/SOURCES.md (RF-06): a posting on one is a note, never a fetch. */
export const CLOSED_SITES: readonly string[] = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com'];
/** The longest posting address kept, and the most kept for one company (the newest). */
const MAX_POSTING = 2000;
const MAX_POSTINGS = 20;

/** A closed site's posting the salesperson pasted: its address, and the day it was pasted. */
interface Pasted {
  url: string;
  at: string;
}

/** What is kept for one company: its name as last shown, its website when typed (4.8), and the postings pasted (4.9). */
export interface CompanyNotes {
  name: string;
  website?: string;
  postings?: Pasted[];
}

/** A company's key: its words, accents folded, lowercase, a trailing legal form dropped, joined by a space; '' when it has none. */
export const companyKey = (name: string): string => companyWords(name).join(' ');

const leadsFile = (data: string): string => join(data, 'leads.json');

/** What is kept, by company key; none yet, none. A file that cannot be read stops the page rather than be overwritten. */
export function readNotes(data: string): Record<string, CompanyNotes> {
  const file = leadsFile(data);
  if (!existsSync(file)) return {};
  const read = JSON.parse(readFileSync(file, 'utf8')) as { companies?: unknown };
  if (typeof read.companies !== 'object' || read.companies === null || Array.isArray(read.companies)) throw new Error(`${file} is not a list of companies.`);
  return read.companies as Record<string, CompanyNotes>;
}

/** One company's notes by its key, an own key of what is kept alone. */
const noteOf = (companies: Readonly<Record<string, CompanyNotes>>, key: string): CompanyNotes | undefined => (Object.hasOwn(companies, key) ? companies[key] : undefined);

/** Changes one company's notes: read, changed, written whole; synchronous, so nothing else changes them in between. */
function change(data: string, name: string, edit: (notes: CompanyNotes) => void): void {
  const companies = readNotes(data);
  const key = companyKey(name);
  // Own keys alone: a company named "Constructor" is not the object's own constructor.
  const notes = noteOf(companies, key) ?? { name };
  notes.name = name;
  edit(notes);
  companies[key] = notes;
  mkdirSync(data, { recursive: true });
  const file = leadsFile(data);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ companies }, null, 2)}\n`);
  renameSync(temp, file);
}

/** A company's name from the page's form: plain text on one line, as a title is; '' when it gives no key. */
const named = (company: string): string => {
  const name = cleanTitle(company);
  return companyKey(name) ? name : '';
};

/**
 * Keeps the website the salesperson typed for a company: a web address as a review takes one (`startUrl`), kept as that address;
 * blank, the website kept before is forgotten. Null when kept, else why not. Nothing is fetched.
 */
export function keepWebsite(data: string, company: string, typed: string): string | null {
  const name = named(company);
  if (!name) return 'That row names no company.';
  const text = typed.trim();
  const site = text ? startUrl(text) : null;
  if (text && (!site || site.length > MAX_SITE)) return `Not a web address: ${text.slice(0, MAX_SITE)}`;
  change(data, name, (notes) => {
    if (site) notes.website = site;
    else delete notes.website;
  });
  return null;
}

/** The website of a company row: the one typed for it, else, for a company lane lookup typed as a site, that site; else none. */
export function websiteOf(notes: Readonly<Record<string, CompanyNotes>>, name: string, typedAsSite = false): string | undefined {
  const kept = noteOf(notes, companyKey(name))?.website;
  if (kept) return kept;
  return typedAsSite && candidateSlugs(name).companyDomain ? (startUrl(name.trim()) ?? undefined) : undefined;
}

/** A pasted address as kept: https on the default port, no credentials, on a closed site's domain; else undefined. */
function closedPosting(text: string): string | undefined {
  const url = startUrl(text);
  if (!url || url.length > MAX_POSTING || !URL.canParse(url)) return undefined;
  const address = new URL(url);
  const host = address.hostname.toLowerCase();
  if (address.protocol !== 'https:' || address.port !== '' || address.username !== '' || address.password !== '') return undefined;
  return CLOSED_SITES.some((d) => host === d || host.endsWith(`.${d}`)) ? address.href : undefined;
}

/**
 * Keeps a closed site's posting the salesperson pasted on a company's row (4.9), newest first, none twice, at most
 * `MAX_POSTINGS`: null when kept, else why not. Never fetched.
 */
export function keepPosting(data: string, company: string, pasted: string, now: Date = new Date()): string | null {
  const name = named(company);
  if (!name) return 'That row names no company.';
  const url = closedPosting(pasted.trim());
  if (!url) return 'Not a posting on LinkedIn, Indeed, Glassdoor or ZipRecruiter (an https address).';
  change(data, name, (notes) => {
    notes.postings = [{ url, at: now.toISOString() }, ...(notes.postings ?? []).filter((p) => p.url !== url)].slice(0, MAX_POSTINGS);
  });
  return null;
}

/** The postings pasted for a company row, newest first. */
export const postingsOf = (notes: Readonly<Record<string, CompanyNotes>>, name: string): readonly Pasted[] => noteOf(notes, companyKey(name))?.postings ?? [];

/** The lane a company row is on: the discovery lane's last run, or the company lane's lookups. */
export type Lane = 'discovery' | 'company';

/**
 * A company row's lead, read from the data folder (4.10): its website, and the reason it goes into the queue, the row's source
 * and posting (the discovery row's own; a lookup's first board with a QA role's address kept, and that address, else its first board; else the newest posting
 * pasted). Null when the row is not kept or has no website.
 */
export function leadOf(data: string, company: string, lane: Lane): { website: string; reason: Reason } | null {
  const key = companyKey(company);
  if (!key) return null;
  const notes = readNotes(data);
  const pasted = noteOf(notes, key)?.postings?.[0];
  let reason: Reason | undefined;
  let name: string | undefined;
  let typedAsSite = false;
  if (lane === 'discovery') {
    const row = readDiscovery(data).run?.rows.find((r) => companyKey(r.company) === key);
    if (row) [name, reason] = [row.company, { source: row.source, ...(row.url ? { url: row.url } : {}) }];
  } else {
    const lookup = readLookups(data).find((l) => companyKey(l.asked) === key);
    const linked = lookup?.boards.find((b) => b.roles.some((r) => r.url));
    const board = linked ?? lookup?.boards[0];
    const url = linked?.roles.find((r) => r.url)?.url;
    if (lookup) [name, typedAsSite] = [lookup.asked, true];
    if (board) reason = { source: board.source, ...(url ? { url } : {}) };
    else if (lookup) reason = pasted ? { source: 'pasted', url: pasted.url } : { source: 'company lane' };
  }
  const website = name ? websiteOf(notes, name, typedAsSite) : undefined;
  return website && reason ? { website, reason } : null;
}
