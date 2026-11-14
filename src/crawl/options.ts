/**
 * What a crawl is asked to do (crawl(), crawler.ts): where it starts, how far and how politely it goes,
 * and what it hands back as it goes. Its own module so the crawler stays the small entry point it is
 * (SRC-09).
 */
import type { Browser } from 'playwright';
import type { CrawlReport } from '../leaf/report.js';
import type { RobotsPolicy } from './robots.js';

export interface CrawlOptions {
  startUrl: string;
  /** Most pages to load, counting error pages and redirects. Default H.MAX_PAGES. */
  maxPages?: number;
  /** Wait between page loads, in milliseconds. Default 1000. */
  delayMs?: number;
  /**
   * The address asked when another site's address fails to resolve or connect, to tell a site gone from a
   * computer that reaches no other site (G-241). Default example.com; a test gives its own local server.
   */
  externalControl?: string;
  /** Ask no host but the site under test (--offline, G-333): no link to another site, no control, no www twin. Default off. */
  offline?: boolean;
  userAgent?: string;
  /** Stop after this many failed requests in a row (network errors and 5xx). Default 3. */
  maxConsecutiveErrors?: number;
  /** The first wait before robots.txt is asked again after a server error, doubled each time. Default H.ROBOTS_RETRY_WAIT_MS (tests: a few ms). */
  robotsRetryWaitMs?: number;
  /** How long a loaded page's reading may take before its tab is given up (G-268). Default H.READ_DEADLINE_MS (tests: a few seconds). */
  readDeadlineMs?: number;
  /** Per-page navigation timeout, in milliseconds. Default 30000. */
  navigationTimeoutMs?: number;
  /**
   * After the load event, wait up to this long for the network to go quiet, so content that
   * JavaScript renders (links in a React app, say) is there when the page is read. Default 3000.
   */
  settleMs?: number;
  /** Only follow links under these paths (e.g. /careers). The start page is always read. */
  include?: string[];
  /**
   * Stop after this many pages in a row taught nothing new (src/crawl/discovery.ts); 0 never stops
   * early (--long). Default H.SATURATION_PAGES.
   */
  saturationPages?: number;
  /** Never follow links under these paths (e.g. /forum). Wins over include. */
  exclude?: string[];
  /**
   * Crawl every language of a multilingual site. By default the crawl stays in the start page's
   * language: /fr/ and /de/ are the same page types again, and their menus differ.
   */
  allLanguages?: boolean;
  /**
   * Read the page's own guards as well (--sec, item 107; G-733 (2): only when the flag is given): each field's limits, pattern,
   * autocomplete and input mode, and each form's action, method and hidden fields' names. Default off.
   */
  sec?: boolean;
  /**
   * After the crawl, load pages once more, in a fresh browser, and record what reads differently
   * (second-look.ts). Default off; suite build turns it on, --quick off.
   */
  secondLook?: boolean;
  /** A signed-in session: the crawl and its second look carry it (context.ts, G-146). Omitted: anonymous. */
  session?: import('./context.js').CrawlSession;
  /** Reuse a browser (tests do). If omitted, Chromium is launched and closed by crawl(). */
  browser?: Browser;
  /** Progress messages, one line each. */
  log?: (message: string) => void;
  lookup?: import('./addresses.js').Lookup; // how the site's name is looked up (G-139); tests give a fake one
  hostLookup?: (host: string) => Promise<unknown>; // how failed third-party hosts' names are looked up (G-380); tests fake it
  /** How a name a request outside the browser goes to is looked up, to keep it from reaching further in than the site (G-243); tests give a fake one. */
  resolve?: import('./destination.js').Resolve;
  /** Asked after each page with the report so far: true stops the crawl there, as found-enough (suite audit --short, G-142). */
  stopWhen?: (report: CrawlReport) => boolean;
  /** Receives robots.txt as the crawl read it, when it ends: a second look after a signed-in crawl keeps to it (its frames too). */
  onRobots?: (policy: RobotsPolicy) => void;
  /**
   * The crawl this one follows, for a suite crawled again (docs/CRAWL-HISTORY-PLAN.md): its pages are
   * read first, and each is said against its previous reading (checklist.ts).
   */
  previous?: CrawlReport;
}
