/**
 * The crawl loop and what it needs (lifted out of crawler.ts, which opens and closes the browser):
 * a crawl's options resolved, the site's robots.txt (robots-fetch.ts), and the loop that reads one page after another
 * until a stop reason holds (read-pages.ts).
 */
import { afterCrawl } from './after-crawl.js';
import { guardedRequests } from './destination.js';
import { openRelaxed } from './relaxed-chain.js';
import { fetchRobots } from './robots-fetch.js';
import { PRODUCT_TOKEN } from '../leaf/report.js';
import { LoadWatch } from './load-watch.js';
import type { Browser, BrowserContext, Page } from 'playwright';
import { Checklist } from './checklist.js';
import type { CrawlOptions } from './options.js';
import { Frontier } from './frontier.js';
import type { CrawlRun } from './page-step.js';
import { readPages } from './read-pages.js';
import { refusalOf } from './refusals.js';
import type { CrawlReport, NotCrawledReason } from '../leaf/report.js';
import { isAllowed } from './robots.js';
import { probeAddresses } from './addresses.js';
import type { CrawlState } from './state.js';
import { normalizeUrl, robotsPath, underPath } from '../leaf/pages/url.js';
import { H as crawlH } from '../leaf/heuristics/crawl.js';

/** The user agent a crawl names itself by, unless told otherwise (--user-agent). */
export const DEFAULT_USER_AGENT = `Mozilla/5.0 (compatible; ${PRODUCT_TOKEN}/1.0; +https://github.com/Ghost-in-the-Kernel-Labs/Ghost-in-the-Kernel-Labs-suite-builder-docs)`;
/** Pages a crawl reads unless told otherwise (--max-pages). A small site is read whole well before. */
const DEFAULT_MAX_PAGES = crawlH.MAX_PAGES;

/** Share of the page budget one section of the site may take while others have pages waiting. */
const SECTION_SHARE = crawlH.SECTION_SHARE;
/** ...but never fewer pages than this: on a small budget, a quarter is too few to be useful. */
const SECTION_MIN = crawlH.SECTION_MIN;


/** A crawl's options, resolved: each one given or its default, the scope as a test. */
export interface CrawlSettings {
  options: CrawlOptions;
  startUrl: string;
  maxPages: number;
  delayMs: number;
  userAgent: string;
  maxConsecutiveErrors: number;
  timeout: number;
  settleMs: number;
  include: string[];
  exclude: string[];
  inScope: (url: string) => boolean;
  log: (line: string) => void;
}

/** The CrawlSettings of a crawl's options; refuses an address that is not http(s), and a page limit under 1. */
export function crawlSettings(options: CrawlOptions): CrawlSettings {
  const startUrl = normalizeUrl(options.startUrl);
  if (!startUrl) throw new Error(`Not an http(s) URL: ${options.startUrl}`);
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const delayMs = options.delayMs ?? crawlH.DELAY_MS;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const maxConsecutiveErrors = options.maxConsecutiveErrors ?? crawlH.MAX_CONSECUTIVE_ERRORS;
  const timeout = options.navigationTimeoutMs ?? crawlH.NAVIGATION_TIMEOUT_MS;
  const settleMs = options.settleMs ?? crawlH.SETTLE_MS;
  const include = options.include ?? [];
  const exclude = options.exclude ?? [];
  const inScope = (url: string) =>
    !exclude.some((p) => underPath(url, p)) && (include.length === 0 || include.some((p) => underPath(url, p)));
  const log = options.log ?? (() => {});
  if (maxPages < 1) throw new Error('maxPages must be at least 1');
  return { options, startUrl, maxPages, delayMs, userAgent, maxConsecutiveErrors, timeout, settleMs, include, exclude, inScope, log };
}

/** The options a crawl's report says it was made with (CrawlReport.options): the flags only when they were given. */
function reportOptions(settings: CrawlSettings): CrawlReport['options'] {
  return { maxPages: Number.isFinite(settings.maxPages) ? settings.maxPages : null, delayMs: settings.delayMs, userAgent: settings.userAgent, maxConsecutiveErrors: settings.maxConsecutiveErrors, include: settings.include, exclude: settings.exclude, ...(settings.options.allLanguages ? { allLanguages: true } : {}), ...(settings.options.offline ? { offline: true as const } : {}), ...(settings.options.sec ? { sec: true as const } : {}) };
}

/**
 * The crawl: started (robots.txt and the site's addresses; null when the site cannot be reached), its
 * pages read one after another, then finished (what was left, the not-found probe, the second look).
 * A signed-in crawl (docs/LOGIN-PLAN.md) signs in between the start and the pages.
 */
export async function crawlLoop(page: Page, context: BrowserContext, browser: Browser, state: CrawlState, settings: CrawlSettings): Promise<CrawlReport> {
  const finish = () => {
    settings.options.onRobots?.(state.robots.policy);
    return state.report(settings.startUrl, reportOptions(settings));
  };
  const run = await startCrawl(page, context, state, settings);
  if (!run) return finish();
  await readPages(run, settings, finish);
  await afterCrawl(run, context, browser, settings);
  return finish();
}

/**
 * robots.txt and every address the site's name points to, tried at once (G-139); then the frontier,
 * the start page first. Null when the site could not be reached at all (DNS, connection, timeout):
 * nothing to read, and nothing robots.txt disallowed, since it was never read. A previous crawl's
 * pages are not "robots" (Ghost's run, 2026-10-03).
 */
async function startCrawl(page: Page, context: BrowserContext, state: CrawlState, settings: CrawlSettings): Promise<CrawlRun | null> {
  const { options, startUrl, maxPages, timeout, settleMs, maxConsecutiveErrors, inScope, log } = settings;
  const [robots, addresses] = await Promise.all([fetchRobots(await guardedRequests(context, state.origin, options.resolve), state.origin, timeout, log, options.robotsRetryWaitMs, openRelaxed(settings.userAgent, state.origin, options.resolve, options.browser !== undefined)), probeAddresses(state.origin, options.lookup)]);
  state.readRobots(robots);
  state.noteAddresses(addresses);
  if (state.robots.error !== undefined) return null;
  const skip = (url: string, reason: NotCrawledReason) => state.skip(url, reason);
  const role = options.session?.role;
  // A previous page passes the rules a link does: a recrawl never opens what the crawl would not follow (G-178).
  const refusal = (url: string) => refusalOf({ state, inScope, ...(role ? { role } : {}) }, url);
  const frontier = new Checklist(new Frontier(crawlH.SAMPLES_TO_SETTLE, Math.max(SECTION_MIN, Math.ceil(maxPages * SECTION_SHARE)), Number.isFinite(maxPages) ? crawlH.MENU_FIRST_PAGES : 0), { previous: options.previous, log, seen: (key) => state.markSeen(key), skip, refusal, origin: state.origin, role: role ?? null }); // its pages first (checklist.ts)
  if (isAllowed(state.robots.policy, robotsPath(startUrl))) frontier.add({ url: startUrl, depth: 0 });
  else skip(startUrl, 'robots');
  return {
    page,
    watch: new LoadWatch(page),
    readDeadlineMs: options.readDeadlineMs ?? crawlH.READ_DEADLINE_MS,
    state,
    frontier,
    inScope,
    robotsFor: async (site: string) => fetchRobots(await guardedRequests(context, site, options.resolve), site, timeout, log, options.robotsRetryWaitMs, openRelaxed(settings.userAgent, site, options.resolve, options.browser !== undefined)),
    log,
    timeout,
    settleMs,
    maxConsecutiveErrors,
    allLanguages: options.allLanguages,
    ...(options.session ? { role: options.session.role, signInPage: options.session.signInPage } : {}),
  };
}
