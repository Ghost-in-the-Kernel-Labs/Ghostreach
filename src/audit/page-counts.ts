/**
 * How many pages a crawl read, counted once for every place that says it (G-747 (2)): the crawl's summary, the audit,
 * and the grouping's page types (`typedPages`, which `pagesRead` counts). Before, each counted alone: quavo.com's
 * crawl said 121 (every address asked for), its audit 109 (every one that answered, 404s and repeats too) and its
 * build 105 (the pages read).
 */
import type { CrawlReport } from '../leaf/report.js';
import { drawnUnderError, isErrorPage, typedPages } from '../findings/pages.js';

export interface PageCounts {
  /** The pages read, one per address arrived at: what the page types are made from. */
  read: number;
  /** Addresses that answered an error (a 404 behind a broken link): findings, not pages. A page an app drew under an error status is read. */
  errors: number;
  /** The rest of the addresses asked for: a repeat of a page read, a sign-in page, or one that gave no answer. */
  other: number;
}

// Decision: G-747
export function pageCounts(report: CrawlReport): PageCounts {
  // A page that gave no answer has no shape, so the grouping skips it too; said here for a record that has one anyway.
  const read = typedPages(report).filter((t) => t.page.status !== null).length;
  const drawn = drawnUnderError(report);
  const errors = report.pages.filter((p) => !p.duplicateOf && isErrorPage(p) && !drawn.has(p.url)).length;
  return { read, errors, other: Math.max(0, report.pages.length - read - errors) };
}

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The audit's count: "13 pages" and, when there are any, "(and 1 address that answered an error)" after the site. */
export function errorsApart(c: PageCounts): string {
  return c.errors ? ` (and ${n(c.errors, 'address', 'addresses')} that answered an error)` : '';
}
