/**
 * SITE-04, a page's title (G-132): different pages that share one, and pages with none; each line keeps its audit item (G-749
 * slice 5: the page, re-checked by the crawler's reader, a shared title by its words). Split out of findings.ts, which lists it,
 * so its working set stays under SRC-17.
 */
import type { CrawledPage, CrawlReport } from '../leaf/report.js';
import { seenHeadings } from '../crawl/report-read.js';
import { siteText } from '../leaf/pages/site-text.js';
import { keyOf } from './address-key.js';
import { pageReadItem } from './softer-items.js';
import type { SiteFinding } from './types.js';

/** A page's main heading: its first h1, else its first heading the crawl kept. */
export function mainHeading(page: CrawledPage): string | null {
  return page.structure?.h1?.[0]?.trim() || seenHeadings(page)?.[0]?.trim() || null;
}

/** SITE-04: different pages that share a title, and pages with none. */
// Decision: G-132, G-749
export function titleFinding(report: CrawlReport, appUrls: Set<string>): SiteFinding[] {
  const out: SiteFinding[] = [];
  // Titles: pages with different main headings sharing one title, or with none.
  const shown = report.pages.filter((p) => p.fingerprint && !p.duplicateOf && !p.offSite && ((p.status !== null && p.status < 400) || appUrls.has(p.url)));
  const byTitle = new Map<string, CrawledPage[]>();
  for (const p of shown) byTitle.set((p.title ?? '').trim(), [...(byTitle.get((p.title ?? '').trim()) ?? []), p]);
  const shared = [...byTitle].filter(([title, ps]) => title && new Set(ps.map(mainHeading)).size > 1);
  const untitled = byTitle.get('') ?? [];
  if (shared.length || untitled.length) {
    const sharing = shared.reduce((n, [, ps]) => n + ps.length, 0);
    out.push({
      code: 'SITE-04', severity: 'minor',
      title: [sharing ? `${sharing} different pages share ${shared.length === 1 ? 'one title' : `${shared.length} titles`}` : '', untitled.length ? `${untitled.length} page${untitled.length === 1 ? ' has' : 's have'} no title` : ''].filter(Boolean).join('; '),
      where: [
        ...shared.flatMap(([title, ps]) => ps.map((p) => ({ url: p.finalUrl, says: `titled ${siteText(title)}, shows ${siteText(mainHeading(p) ?? '')}`, ...pageReadItem(p, 'title', keyOf(p.finalUrl, report.origin), title) }))),
        ...untitled.map((p) => ({ url: p.finalUrl, says: 'no title', ...pageReadItem(p, 'untitled', keyOf(p.finalUrl, report.origin)) })),
      ],
      why: "Search results, bookmarks and browser tabs show the title: pages that share one can't be told apart, and a page without one shows its address.",
      fix: "Give each page a title of its own that names what it shows (in a single-page app, set it on each route).",
    });
  }
  return out;
}
