/**
 * The audit's items of the markup findings (G-748, G-749 slice 4; docs/AUDIT-TESTS-PLAN.md part 1a): what the crawler's markup
 * reader named, kept so an audit test can run the same reader again (src/pages/reader-page.ts). A sample's item is keyed by
 * markupKey (what a deploy changes masked); a page's own markup (its language, its main headings) by its path. Only the pages a
 * visitor opens that answered 2xx (`readable`): a role's page needs a sign-in no audit test makes, and a page drawn under a 3xx
 * (the-internet.herokuapp.com's /status_codes/301) is one the test's guard reads as no page, so a sample seen only there makes no item.
 */
import type { CrawledPage } from '../leaf/report.js';
import { markupKey } from '../leaf/pages/markup-key.js';
import { roleOf } from '../leaf/pages/url.js';
import type { ComponentItem } from './by-component.js';
import type { ItemEvidence, MarkupRead } from './item-evidence.js';

/** A page an audit test can read: it answered 2xx at its own address. */
export const answered = (p: CrawledPage): boolean => p.status !== null && p.status >= 200 && p.status < 300;

/** A sample's item: the sample as said, its key, and the visitor's pages that show it. */
// Decision: G-749
export const sampleItem = (read: MarkupRead, readable: (url: string) => boolean): ComponentItem => (raw, urls) => {
  const pages = urls.filter((u) => roleOf(u) === null && readable(u));
  return pages.length ? { at: 'markup', key: markupKey(raw), read, said: raw, pages } : undefined;
};

/** A page's own item (SITE-14's language, SITE-15's main headings and how many with words), keyed by the path `key` names; none for a role's page. */
export const pageItem = (p: CrawledPage, read: MarkupRead, key: string, headings = 0): { item?: ItemEvidence } =>
  roleOf(p.finalUrl) === null && answered(p) ? { item: { at: 'markup', key, read, said: null, pages: [p.finalUrl], ...(headings ? { headings } : {}) } } : {};
