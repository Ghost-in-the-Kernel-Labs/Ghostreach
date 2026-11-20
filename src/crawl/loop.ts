/**
 * The crawl loop and what it needs (lifted out of crawler.ts, which opens and closes the browser):
 * a crawl's options resolved, the site's robots.txt (robots-fetch.ts), and the loop that reads one page after another
 * until a stop reason holds (read-pages.ts).
 */
import { afterCrawl } from './after-crawl.js';
import { guardedRequests } from './destination.js';
import { openRelaxed } from './relaxed-chain.js';
import { fetchRobots } from './robots-fetch.js';
import { DEFAULT_USER_AGENT } from '../leaf/report.js';
import { LoadWatch } from './load-watch.js';
import type { Browser, BrowserContext, Page } from 'playwright';
import { Checklist } from './checklist.js';
import type { CrawlOptions } from './options.js';
import { Frontier } from './frontier.js';
import type { CrawlRun } from './page-step.js';
import { readPages } from './read-pages.js';
import type { CrawlReport } from '../leaf/report.js';
import { isAllowed } from './robots.js';
import { probeAddresses } from './addresses.js';
import type { CrawlState } from './state.js';
import { normalizeUrl, robotsPath } from '../leaf/pages/url.js';
import { H as crawlH } from '../leaf/heuristics/crawl.js';

/** Pages a crawl reads at most. A small site is read whole well before. */
const DEFAULT_MAX_PAGES = crawlH.MAX_PAGES;

/** Share of the page budget one section of the site may take while others have pages waiting. */
const SECTION_SHARE = crawlH.SECTION_SHARE;
/** ...but never fewer pages than this: on a small budget, a quarter is too few to be useful. */
const SECTION_MIN = crawlH.SECTION_MIN;


/** A crawl's settings: its options' seams resolved, and how far and how politely it goes, fixed (GR-003: no flag). */
export interface CrawlSettings {
  options: CrawlOptions;
  startUrl: string;
  maxPages: number;
  delayMs: number;
  maxConsecutiveErrors: number;
  timeout: number;
  settleMs: number;
  log: (line: string) => void;
}

/** The CrawlSettings of a crawl's options; refuses an address that is not http(s). */
// Decision: GR-003
export function crawlSettings(options: CrawlOptions): CrawlSettings {
  const startUrl = normalizeUrl(options.startUrl);
  if (!startUrl) throw new Error(`Not an http(s) URL: ${options.startUrl}`);
  const maxConsecutiveErrors = options.maxConsecutiveErrors ?? crawlH.MAX_CONSECUTIVE_ERRORS;
  const timeout = options.navigationTimeoutMs ?? crawlH.NAVIGATION_TIMEOUT_MS;
  const log = options.log ?? (() => {});
  return { options, startUrl, maxPages: DEFAULT_MAX_PAGES, delayMs: crawlH.DELAY_MS, maxConsecutiveErrors, timeout, settleMs: crawlH.SETTLE_MS, log };
}

/** The settings a crawl's report says it was made with (CrawlReport.options). */
function reportOptions(settings: CrawlSettings): CrawlReport['options'] {
  return { maxPages: settings.maxPages, delayMs: settings.delayMs, userAgent: DEFAULT_USER_AGENT, maxConsecutiveErrors: settings.maxConsecutiveErrors };
}

/**
 * The crawl: started (robots.txt and the site's addresses; null when the site cannot be reached), its
 * pages read one after another, then finished (what was left, the not-found probe, the second look).
 */
export async function crawlLoop(page: Page, context: BrowserContext, browser: Browser, state: CrawlState, settings: CrawlSettings): Promise<CrawlReport> {
  const finish = () => state.report(settings.startUrl, reportOptions(settings));
  const run = await startCrawl(page, context, state, settings);
  if (!run) return finish();
  await readPages(run, settings);
  await afterCrawl(run, context, browser, settings);
  return finish();
}

/**
 * robots.txt and every address the site's name points to, tried at once (G-139); then the frontier,
 * the start page first. Null when the site could not be reached at all (DNS, connection, timeout):
 * nothing to read, and nothing robots.txt disallowed, since it was never read.
 */
async function startCrawl(page: Page, context: BrowserContext, state: CrawlState, settings: CrawlSettings): Promise<CrawlRun | null> {
  const { options, startUrl, maxPages, timeout, settleMs, maxConsecutiveErrors, log } = settings;
  const [robots, addresses] = await Promise.all([fetchRobots(await guardedRequests(context, state.origin, options.resolve), state.origin, timeout, log, options.robotsRetryWaitMs, openRelaxed(DEFAULT_USER_AGENT, state.origin, options.resolve, options.browser !== undefined && !options.browserPlain)), probeAddresses(state.origin, options.lookup)]);
  state.readRobots(robots);
  state.noteAddresses(addresses);
  if (state.robots.error !== undefined) return null;
  const frontier = new Checklist(new Frontier(crawlH.SAMPLES_TO_SETTLE, Math.max(SECTION_MIN, Math.ceil(maxPages * SECTION_SHARE)), crawlH.MENU_FIRST_PAGES));
  if (isAllowed(state.robots.policy, robotsPath(startUrl))) frontier.add({ url: startUrl, depth: 0 });
  else state.skip(startUrl, 'robots');
  return {
    page,
    watch: new LoadWatch(page),
    readDeadlineMs: options.readDeadlineMs ?? crawlH.READ_DEADLINE_MS,
    state,
    frontier,
    robotsFor: async (site: string) => fetchRobots(await guardedRequests(context, site, options.resolve), site, timeout, log, options.robotsRetryWaitMs, openRelaxed(DEFAULT_USER_AGENT, site, options.resolve, options.browser !== undefined && !options.browserPlain)),
    log,
    timeout,
    settleMs,
    maxConsecutiveErrors,
  };
}
