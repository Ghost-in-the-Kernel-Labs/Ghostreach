/**
 * Which crawled pages the grouping reads (one per final address, error pages and sign-in pages
 * left out), which it skips and why, and the broken links among them.
 */
import { looksLikeSignIn, roleOf, signInKind } from '../leaf/pages/url.js';
import type { CrawlReport, CrawledPage } from '../leaf/report.js';
import { seenHeadings } from '../crawl/report-read.js';
import type { PageSample } from '../leaf/pages/similarity.js';
import { appPagesUnderError } from './findings.js';

/**
 * The pages that become page types: read (they have a shape), one per final URL, in crawl order. Not `visitorPages`
 * (markup-findings.ts), the pages the findings read, which keep sign-in pages and drop a page an app drew under an error status.
 */
export function typedPages(report: CrawlReport): { page: CrawledPage; sample: PageSample }[] {
  const out: { page: CrawledPage; sample: PageSample }[] = [];
  const seen = new Set<string>();
  const drawn = drawnUnderError(report);
  for (const page of report.pages) {
    // An error page (a 404 behind a broken link) is a finding, not a page type; a page an app drew
    // under an error status is a page type, its status a known defect (SITE-01, G-133).
    // A sign-in page read by an older crawl (before the crawl left them out) isn't a page type either.
    if (!page.fingerprint || page.duplicateOf || seen.has(page.finalUrl) || (isErrorPage(page) && !drawn.has(page.url)) || notAPageType(page.finalUrl)) continue;
    seen.add(page.finalUrl);
    const headings = seenHeadings(page);
    out.push({ page, sample: { url: page.finalUrl, fingerprint: page.fingerprint, headings, formLabels: formLabelsOf(page, headings ?? []) } });
  }
  return out;
}

/**
 * The headings that are one of a field's own words (a control of any kind but a button or a menu item): its form's
 * labels. Two forms each asking for a "Name" are no more one kind of page for it (G-246).
 */
function formLabelsOf(page: CrawledPage, headings: string[]): string[] {
  const words = new Set((page.controls ?? []).filter((c) => c.kind !== 'button' && c.kind !== 'menuitem').flatMap((c) => c.words.map((w) => w.trim())));
  // A heading is already trimmed (readers/headings.ts); a field's words may not be.
  return headings.filter((h) => words.has(h));
}

/**
 * A sign-in address is no page type: its sign-in page, a logout. An account or admin area read as a role
 * is: it is what the crawl signed in to read (G-158).
 */
function notAPageType(url: string): boolean {
  return looksLikeSignIn(url) && !(roleOf(url) !== null && signInKind(url) === 'admin');
}

/** The addresses (as requested and as arrived at) of the pages an app drew under an error status (SITE-01). */
export function drawnUnderError(report: CrawlReport): Set<string> {
  return new Set(appPagesUnderError(report).flatMap((p) => [p.url, p.finalUrl]));
}

export function isErrorPage(page: CrawledPage): boolean {
  return page.status !== null && page.status >= 400;
}
