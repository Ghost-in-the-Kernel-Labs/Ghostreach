/**
 * For a file written before G-480, what a crawl held before the reading masked it. Kept apart from report-read.ts, which
 * reads a report through it.
 */
import type { CrawlReport } from '../leaf/report.js';
import { scrub } from './report-scrub.js';

/**
 * Each report masked on reading (G-480) that was not as written: the crawl as the file held it, and how many of its texts the
 * masking changed. The file's own hash is what a suite's pages stamp and its crawl history were written against (the second
 * review, 3), so it is still a name of that crawl (crawlHashes), and a difference taken from it applies (crawl/history.ts).
 */
const AS_READ = new WeakMap<CrawlReport, { held: CrawlReport; masked: number }>();

/** A crawl as it is written (scrubbedReport), remembering what it held when that differed: a file from before G-480. */
// Decision: G-480
export function asWritten(held: CrawlReport): CrawlReport {
  const { report, masked } = scrub(held);
  if (masked > 0) AS_READ.set(report, { held, masked });
  return report;
}

