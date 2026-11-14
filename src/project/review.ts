/**
 * One review, from a site to its folder (REV-06): the crawl written as the parent's crawler wrote it, read back as the parent's
 * audit reads a crawl file, then AUDIT.html, the findings as data (`findings.json`), the summary the ranking reads
 * (`summary.json`) and the PDF the salesperson hands over (`pdfName`), all in `<data>/<host>-<date>/` and nowhere else. The parent's `suite audit <site>` without its dock, its
 * suite, its terminal summary or a flag (GR-003): one command, one review.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CrawlReport } from '../leaf/report.js';
import { startUrlFromArg } from '../leaf/pages/url.js';
import { auditCounts, writeAudit } from '../audit/audit.js';
import type { SiteFinding } from '../findings/types.js';
import { printPdf } from '../pdf/pdf.js';
import { auditedCrawl, crawlToFile } from './crawl.js';

/** Where the reviews are kept on the salesperson's machine when nothing else is named: a folder in the home folder, never the program's own. */
export const dataDir = (): string => join(homedir(), 'Ghostreach');

/** What summary.json holds: what the ranking reads of a review without opening its findings. */
export interface ReviewSummary {
  host: string;
  /** The day of the crawl, as AUDIT.html says it (YYYY-MM-DD). */
  date: string;
  pagesRead: number;
  bySeverity: Record<SiteFinding['severity'], number>;
  /** Each finding code with its count, in the findings' order. */
  byCode: Record<string, number>;
}

/** The summary of a review's findings. */
export function reviewSummary(report: CrawlReport, findings: SiteFinding[], date: string): ReviewSummary {
  const { host, read } = auditCounts(report, findings);
  const bySeverity = { major: 0, minor: 0, info: 0 };
  const byCode: Record<string, number> = {};
  for (const f of findings) {
    bySeverity[f.severity] += 1;
    byCode[f.code] = (byCode[f.code] ?? 0) + 1;
  }
  return { host, date, pagesRead: read, bySeverity, byCode };
}

/** The PDF's file name: the site it reviews, as the page's heading names it, and what it is; the prospect reads it, so no word of ours but the page's own. */
export const pdfName = (host: string): string => `${host} site review.pdf`;

/** The review's folder: `<data>/<host>-<date>`; a second review of the host that day gets `-2`, `-3`, ..., so no review's crawl is overwritten (REV-06). */
// Invariant: REV-06
export function reviewFolder(data: string, host: string, date: string): string {
  const base = join(data, `${host}-${date}`);
  let dir = base;
  for (let n = 2; existsSync(dir); n++) dir = `${base}-${n}`;
  return dir;
}

/**
 * Why no audit is written of a crawl, or null when one is: the crawl failed as a whole, or its start page did not answer (the
 * parent's refusedCrawl and startAnswered, G-200, G-633): an audit of what was not read would describe a site it did not see.
 */
function refused(report: CrawlReport): { code: number; why: string } | null {
  if (report.failed) return { code: 1, why: `the crawl failed (${report.failed}); the site, or the network to it, did not answer` };
  const start = report.pages[0];
  if (!start) return { code: 2, why: report.robots.error ? `the site could not be reached (${report.robots.error.split('\n')[0]})` : `nothing was read: robots.txt answered ${report.robots.status ?? 'nothing'}` };
  if (start.status === null || start.status >= 400) return { code: 2, why: `the start page ${start.status !== null ? `answered ${start.status}` : `failed: ${(start.error ?? '').replace(/\.+$/, '')}`}` };
  return null;
}

export interface ReviewRequest {
  /** The site as typed. */
  site: string;
  /** The data folder the review's folder goes in. */
  data: string;
  say: (line: string) => void;
}

/**
 * Reviews a site: 0 and the folder when the review was written; 1 or 2 when it was not (not an address, a failed crawl, a start
 * page that did not answer), the crawl kept in the folder for a look all the same.
 */
// Invariant: REV-06
export async function review(request: ReviewRequest): Promise<{ code: number; folder?: string }> {
  const url = startUrlFromArg(request.site);
  if (!/^https?:\/\/[^/?#\s]/i.test(url) || !URL.canParse(url)) {
    request.say(`"${request.site}" is not a web address. Name a site like www.example.com.`);
    return { code: 1 };
  }
  // The folder is named by the host typed and the day the crawl starts, the day AUDIT.html says.
  const started = new Date();
  const day = started.toISOString().slice(0, 10);
  const host = new URL(url).hostname;
  const folder = reviewFolder(request.data, host, day);
  mkdirSync(folder, { recursive: true });
  const out = join(folder, `${host}.crawl.json`);
  const crawled = await crawlToFile({ typed: request.site, url, out, log: request.say, say: request.say });
  if (!crawled) {
    request.say('The browser the crawler uses could not be downloaded: see the messages above.');
    return { code: 1, folder };
  }
  // The audit reads the crawl as written, as the parent's audit reads a crawl file (REV-07).
  const report = auditedCrawl(out);
  const no = refused(report);
  if (no) {
    request.say(`No review was written: ${no.why}. The crawl is kept: ${out}`);
    return { code: no.code, folder };
  }
  const { file, findings } = writeAudit(report, folder, started);
  writeFileSync(join(folder, 'findings.json'), `${JSON.stringify(findings, null, 2)}\n`);
  const summary = reviewSummary(report, findings, day);
  writeFileSync(join(folder, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await printPdf(file, join(folder, pdfName(summary.host)), { site: summary.host, date: day });
  const { major, minor } = summary.bySeverity;
  request.say(`The review of ${summary.host}: ${findings.length} finding${findings.length === 1 ? '' : 's'} (${major} major, ${minor} minor), ${summary.pagesRead} page${summary.pagesRead === 1 ? '' : 's'} read. ${folder}`);
  return { code: 0, folder };
}
