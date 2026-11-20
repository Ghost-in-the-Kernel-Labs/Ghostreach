/**
 * The audit's items of the softer findings (G-749 slice 5; docs/AUDIT-TESTS-PLAN.md part 1a), and SITE-23's: what the crawl saw,
 * kept so an audit test can ask again. A page's own markup (its title, description, viewport, copyright year) keyed by its path,
 * with the shared words after it where the line is about them; a request, an image or another site's link by its address; an
 * error message or a plain-http address as a sample (markupKey). Only what a re-check can tell: a request the browser refused with
 * no status, a sample cut short or said in the browser's words, an error with no message keep none (a pass there would say
 * nothing of the defect: never a false FIXED).
 */
import type { CrawledPage } from '../leaf/report.js';
import { roleOf } from '../leaf/pages/url.js';
import type { ComponentItem } from './by-component.js';
import type { ItemEvidence, MarkupRead } from './item-evidence.js';
import { answered, sampleItem } from './markup-items.js';

const pathOf = (url: string) => new URL(url).pathname;

/** The first five pages, as paths, and how many more: the pages that showed or linked to it. */
const fromOf = (urls: string[]) => ({ from: [...new Set(urls.map(pathOf))].slice(0, 5), more: Math.max(0, new Set(urls.map(pathOf)).size - 5) });

/**
 * A page's own item of a softer markup finding (G-749 slice 5): the page, by its path, with `said` (the shared words, keyed after
 * the path) or `value` (what the crawl read); none for a role's page or one that did not answer 2xx.
 */
// Decision: G-749
export function pageReadItem(p: CrawledPage, read: MarkupRead, path: string, said: string | null = null, value?: string): { item?: ItemEvidence } {
  if (roleOf(p.finalUrl) !== null || !answered(p)) return {};
  return { item: { at: 'markup', key: said === null ? path : `${path}: ${said}`, read, said, pages: [p.finalUrl], ...(value === undefined ? {} : { value }) } };
}

/**
 * SITE-20's item: a request of the site's own that answered a status (`/js/app.js (404)`), by its path; one the browser refused or
 * gave up on (`(ERR_FAILED)`, `(csp)`) is not asked again by HTTP, and one cut short (`…`) cannot be asked whole.
 */
// Decision: G-749
export const failedItem = (origin: string): ComponentItem => (raw, urls) => {
  const m = /^(\/\S*) \((\d{3})\)$/.exec(raw);
  if (!m || raw.includes('…')) return undefined;
  return { at: 'address', key: m[1], url: `${origin}${m[1]}`, status: Number(m[2]), ...fromOf(urls) };
};

/** SITE-23's item: an address asked over plain http, whole as the crawl said it (not the browser's words, not cut at 100). */
// Decision: G-749
export const insecureItem = (readable: (url: string) => boolean): ComponentItem => {
  const sample = sampleItem('insecure', readable);
  return (raw, urls) => (/^http:\/\/\S+$/.test(raw) && raw.length < 100 ? sample(raw, urls) : undefined);
};

/** SITE-21's item: the message thrown, as a sample of the pages that threw it; none with no message (the browser's "undefined" too). */
// Decision: G-749
export const errorItem = (readable: (url: string) => boolean): ComponentItem => {
  const sample = sampleItem('errors', readable);
  return (raw, urls) => (raw === '' || raw === 'undefined' ? undefined : sample(raw, urls));
};

/** SITE-30's item: the image, by its path (another host's whole), what it answered, and the page that shows it. */
export const imageItem = (url: string, status: number | null, page: string, origin: string): ItemEvidence => ({
  at: 'address', key: new URL(url).origin === origin ? `${new URL(url).pathname}${new URL(url).search}` : url, url, status, ...fromOf([page]),
});

/** SITE-12's item: the page, by its path, and the canonical address it names. */
export const canonicalItem = (p: CrawledPage, path: string): { item?: ItemEvidence } =>
  roleOf(p.finalUrl) === null && p.canonical ? { item: { at: 'file', key: path, url: p.finalUrl, status: p.status, canonical: p.canonical } } : {};
