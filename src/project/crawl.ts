/**
 * Crawling a site into a file: the crawl, then its report written. On a new machine Playwright's browser is downloaded
 * first; a bare domain that https:// cannot reach is tried on http://. What it does along the way is said through `say`;
 * the command line prints it.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { crawl } from '../crawl/crawler.js';
import type { CrawlReport } from '../leaf/report.js';
import { readCrawlReport } from '../crawl/report-read.js';
import { scrubbedReport } from '../crawl/report-scrub.js';
import { readText } from './text-file.js';
import { withoutSecrets } from '../leaf/pages/saved-secrets.js';

export interface CrawlRequest {
  /** The address as typed (a bare domain, or one with its scheme), and the start address made of it. */
  typed: string;
  url: string;
  /** The report's file. */
  out: string;
  /** Each page as the crawl goes; the steps around it (a download, a second address). */
  log: (line: string) => void;
  say: (line: string) => void;
  /** The queue's one Chromium, launched as the crawl launches its own (`sharedBrowser`); none: the crawl launches its own. */
  browser?: Browser;
}

/** Downloads Playwright's Chromium (what "npx playwright install chromium" does). */
// Decision: G-004
function installBrowser(): boolean {
  const cli = join(dirname(createRequire(import.meta.url).resolve('playwright/package.json')), 'cli.js');
  // Without PLAYWRIGHT_SKIP_BROWSER_GC it deletes browsers it thinks unused, the generated Java suites' among them.
  return spawnSync(process.execPath, [cli, 'install', 'chromium'], { stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_GC: '1' } }).status === 0;
}

/** The crawl; or, when the browser could not be downloaded, null. The first run on a new machine downloads it, then crawls. */
async function crawlSite(request: CrawlRequest): Promise<CrawlReport | null> {
  // What the crawl prints as it goes names each address read: its token masked, as the report writes them (G-480).
  const log = (line: string) => request.log(withoutSecrets(line));
  const crawlOnce = (startUrl = request.url) => crawl({ startUrl, log, ...(request.browser ? { browser: request.browser, browserPlain: true } : {}) });
  let report: CrawlReport;
  try {
    report = await crawlOnce();
  } catch (error) {
    // The first run on a new machine: Playwright's browser is not downloaded yet. Fetch it and go on.
    if (!(error instanceof Error) || !/Executable doesn't exist|playwright install/i.test(error.message)) throw error;
    request.say('Downloading the browser the crawler uses (once; a minute or so)...');
    if (!installBrowser()) return null;
    report = await crawlOnce();
  }
  // A bare domain means https://, but some sites answer only on http:// (uitestingplayground.com: its
  // certificate is its host's, *.azurewebsites.net). When https:// can't be reached at all and no
  // scheme was typed, try http:// and say so.
  const typedScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(request.typed);
  if (!typedScheme && report.pages.length === 0 && report.robots.error && request.url.startsWith('https://')) {
    const plain = `http://${request.url.slice('https://'.length)}`;
    request.say(`\n${new URL(request.url).origin} could not be reached (${report.robots.error.split('\n')[0].slice(0, 120)}).`);
    request.say(`Trying ${new URL(plain).origin} instead.\n`);
    report = await crawlOnce(plain);
  }
  return report;
}

/** Crawls a site and writes its report; the report and where it was written, or null when the browser could not be downloaded. */
// Decision: G-004
export async function crawlToFile(request: CrawlRequest): Promise<{ report: CrawlReport; out: string } | null> {
  const crawled = await crawlSite(request);
  if (!crawled) return null;
  // The one place a crawl's report is written (G-480): its tokens and keys masked; the crawler read the real addresses, and
  // everything after the crawl reads this.
  const report = scrubbedReport(crawled, [], true);
  writeFileSync(request.out, `${JSON.stringify(report, null, 2)}\n`);
  return { report, out: request.out };
}

/** A crawl file's report. */
export function auditedCrawl(crawlFile: string): CrawlReport {
  return readCrawlReport(() => readText(crawlFile), crawlFile);
}

/**
 * The queue's one Chromium (RF-09, GR-008): launched as the crawl launches its own (no proxy, no option), at the first review that
 * asks, and again when it has gone (a crash); every review running at once is a context of it, so N reviews cost one browser.
 * `get` gives undefined when it cannot launch (a new machine, the browser not yet downloaded): that review launches its own,
 * which downloads it first. `close` closes it; the page's stop calls it.
 */
// Decision: GR-008
export function sharedBrowser(): { get: () => Promise<Browser | undefined>; close: () => Promise<void> } {
  let launched: Promise<Browser | undefined> | null = null;
  const get = async (): Promise<Browser | undefined> => {
    // One launch however many reviews ask at once: each awaits the same promise.
    const asked = (launched ??= chromium.launch().catch(() => undefined));
    const open = await asked;
    if (open?.isConnected()) return open;
    // Gone, or never launched: the next ask launches again; a review whose browser had gone asks once more now.
    if (launched === asked) launched = null;
    return open ? get() : undefined;
  };
  return {
    get,
    close: async () => {
      const was = launched;
      launched = null;
      await (await was)?.close().catch(() => undefined);
    },
  };
}
