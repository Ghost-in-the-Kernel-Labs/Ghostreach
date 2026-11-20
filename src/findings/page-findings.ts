// The findings read from each page's own observations: its markup, its load and the site's probes (G-194, G-201, G-202).
import type { CrawlReport } from '../leaf/report.js';
import { loadFindings } from './load-findings.js';
import { markupFindings } from './markup-findings.js';
import { probeFindings } from './probe-findings.js';
import type { SiteFinding } from './types.js';

/** Every finding the pages' own observations make, in the order the findings report adds them. */
export function pageFindings(report: CrawlReport): SiteFinding[] {
  return [...markupFindings(report), ...loadFindings(report), ...probeFindings(report)];
}
