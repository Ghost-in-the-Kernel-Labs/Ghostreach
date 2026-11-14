/**
 * The crawl report as it is written (G-480, TODO 92's stage 1a): what stage 0 (G-410) took out of the saved pages, taken
 * out of the report too, since it is committed beside them and every suite file is made from it. Every text of the report,
 * whatever its field (an address in `url`, `finalUrl`, `to`, `href`, a redirect, `notCrawled`, `asPublic`, `signIns`, the
 * site's probes; a locator; a sample of failed requests; a heading), read as the pages are: a key of a known shape, a
 * token-like parameter's value and a name and password in an address are the marker (saved-secrets.ts); what was typed to
 * sign in is the marker; and, on a page read signed in (and a link on one), the person after a greeting is
 * `[personal data removed]` (person-text.ts).
 *
 * The crawler reads the real addresses: only what is written is masked, once the crawl is done (project/crawl.ts), and a
 * report read from a file is masked as it is read (report-read.ts), so one written before this rule gives no token to a
 * suite either. Masking twice is masking once.
 *
 * Two texts that differ only in their secrets must stay two (a page is known by its address: two reset links with two
 * tokens are two pages, or a page and the address left unread): each secret in such a pair is given a marker of its own,
 * numbered in the order met (`secret-removed-1`, `-2`), the same marker wherever the same secret stands, so an edge
 * still leads to its page and an href still resolves to its `to`. Never a hash of the secret: a six-digit code or a
 * short password is found again from any short hash by trying them all. Every other secret is the plain marker, as the
 * saved pages write it.
 */
import { typedToMask, withoutSecrets, withoutTyped } from '../leaf/pages/saved-secrets.js';
import { SECRET_MARKER } from '../leaf/pages/secret-shapes.js';
import { withoutPerson } from '../leaf/pages/person-text.js';
import { roleOf } from '../leaf/pages/url.js';
import type { CrawlReport } from '../leaf/report.js';

/**
 * The fields that name a file the crawl saved (a page's `snapshot`, an API document's `saved`): made masked already (G-410's
 * file names) and read back by their exact name, so never read again: a page named for its token, the marker then `_2.html`, would read
 * as a named secret.
 */
const FILE_NAMES = new Set(['snapshot', 'saved']);

/** Each text of a value, with whether it was read signed in, by `visit`, which returns what stands in its place. */
function mapTexts(value: unknown, signedIn: boolean, visit: (text: string, signedIn: boolean) => string): unknown {
  if (typeof value === 'string') return visit(value, signedIn);
  if (Array.isArray(value)) return value.map((v) => mapTexts(v, signedIn, visit));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, FILE_NAMES.has(k) && typeof v === 'string' ? v : mapTexts(v, signedIn, visit)]));
  return value;
}

/**
 * The report's texts in the order the file holds them, each page's and each link's read as the role it was read by (a
 * page's address says it, G-145); the report's fields keep their order.
 */
function eachText(report: CrawlReport, visit: (text: string, signedIn: boolean) => string): CrawlReport {
  const signedIn = (key: string, item: unknown): boolean => {
    if (key === 'pages') return roleOf((item as CrawlReport['pages'][number]).url) !== null || roleOf((item as CrawlReport['pages'][number]).finalUrl) !== null;
    return key === 'edges' && roleOf((item as CrawlReport['edges'][number]).from) !== null;
  };
  return Object.fromEntries(Object.entries(report).map(([key, value]) => [key, (key === 'pages' || key === 'edges') && Array.isArray(value) ? value.map((item) => mapTexts(item, signedIn(key, item), visit)) : mapTexts(value, false, visit)])) as unknown as CrawlReport;
}

/** A marker standing in a text as a whole word: one the site wrote itself, in a crawl just read (`fresh`). */
const LITERAL_MARKER = /(?<![A-Za-z0-9_-])secret-removed(?:-[1-9][0-9]{0,5})?(?![A-Za-z0-9_])/g;
const HOLDS_MARKER = new RegExp(LITERAL_MARKER.source);

/** What `scrub` gives back: the report as written, and how many of its texts it changed. */
interface Scrubbed {
  report: CrawlReport;
  masked: number;
}

/**
 * The report as written: every secret, typed value and signed-in person masked, and two texts that differ only in their
 * secrets still two. `typed`: what the crawl typed to sign in (typedFor, project/resolve-locators.ts), when known; matched
 * in any letters' case. `fresh`: the crawl was just read from the site, so a marker in its texts is the site's own words
 * (a link to `/reset?token=secret-removed`): it is given a number of its own, never equal to a masked one (the second
 * review, 4b). A report read from a file is not fresh: its markers are the writer's, and masking it again changes nothing.
 */
// Decision: G-480
export function scrub(report: CrawlReport, typed: readonly string[] = [], fresh = false): Scrubbed {
  // Never a value that is a word of the site's own host: the site's name is no account's (the third review, 3).
  const toMask = typedToMask(typed, report.origin);
  // Every mask, each value given its marker by `markerFor`: what was typed, then (signed in) the person, then the secrets.
  const masking = (text: string, signedIn: boolean, markerFor: (value: string) => string) => {
    const plain = withoutTyped(text, toMask, true, markerFor);
    return withoutSecrets(signedIn ? withoutPerson(plain) : plain, markerFor);
  };
  const plainly = () => SECRET_MARKER;
  // Which values (a secret, or what was typed) stand in two texts that the plain marker would make one: those are numbered,
  // each value as the masking itself meets it (a name and password in an address first, whole). A text already holding a
  // marker is in the count too (the third review, 5): in a file from before G-480 it is the site's own, and a token masked
  // beside it must not read as it. The numbers start past every one the report already holds.
  const valuesOf = (text: string, signedIn: boolean) => {
    const found: string[] = [];
    masking(text, signedIn, (value) => {
      found.push(value);
      return SECRET_MARKER;
    });
    return found;
  };
  let held = 0;
  const byMasked = new Map<string, Map<string, boolean>>();
  eachText(report, (text, signedIn) => {
    for (const m of text.matchAll(LITERAL_MARKER)) held = Math.max(held, Number(/-(\d+)$/.exec(m[0])?.[1] ?? 0));
    const masked = masking(text, signedIn, plainly);
    if (masked !== text || HOLDS_MARKER.test(text)) byMasked.set(masked, (byMasked.get(masked) ?? new Map()).set(text, signedIn));
    return text;
  });
  const numbered = new Map<string, string>();
  const next = () => `${SECRET_MARKER}-${held + numbered.size + 1}`;
  for (const texts of byMasked.values()) {
    if (texts.size < 2) continue;
    for (const [text, signedIn] of texts) for (const value of valuesOf(text, signedIn)) if (!numbered.has(value)) numbered.set(value, next());
  }
  // A marker the site wrote, in a crawl just read: numbered after every other.
  const literals = new Map<string, string>();
  const literal = (found: string) => {
    if (!literals.has(found)) literals.set(found, `${SECRET_MARKER}-${held + numbered.size + literals.size + 1}`);
    return literals.get(found) ?? found;
  };
  let masked = 0;
  const written = eachText(report, (text, signedIn) => {
    // The site's own markers first, before any mask of ours stands beside them.
    const out = masking(fresh ? text.replace(LITERAL_MARKER, literal) : text, signedIn, (value) => numbered.get(value) ?? SECRET_MARKER);
    if (out !== text) masked++;
    return out;
  });
  return { report: written, masked };
}

/** The report as written (scrub's): what every writer and reader of a crawl report calls. */
// Decision: G-480
export function scrubbedReport(report: CrawlReport, typed: readonly string[] = [], fresh = false): CrawlReport {
  return scrub(report, typed, fresh).report;
}
