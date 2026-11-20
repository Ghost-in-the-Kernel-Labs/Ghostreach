/**
 * What a crawl is asked to do (crawl(), crawler.ts): where it starts, and the seams a test fills. How far and how politely
 * it goes is fixed, never asked (GR-003: no flag): the page limit, the delay, the settle, the user agent, the second look
 * on, the start page's language only. Its own module so the crawler stays the small entry point it is (SRC-09).
 */
import type { Browser } from 'playwright';

export interface CrawlOptions {
  startUrl: string;
  /**
   * The address asked when another site's address fails to resolve or connect, to tell a site gone from a
   * computer that reaches no other site (G-241). Default example.com; a test gives its own local server.
   */
  externalControl?: string;
  /** Stop after this many failed requests in a row (network errors and 5xx). Default 3. */
  maxConsecutiveErrors?: number;
  /** The first wait before robots.txt is asked again after a server error, doubled each time. Default H.ROBOTS_RETRY_WAIT_MS (tests: a few ms). */
  robotsRetryWaitMs?: number;
  /** How long a loaded page's reading may take before its tab is given up (G-268). Default H.READ_DEADLINE_MS (tests: a few seconds). */
  readDeadlineMs?: number;
  /** Per-page navigation timeout, in milliseconds. Default 30000. */
  navigationTimeoutMs?: number;
  /** Reuse a browser (tests do). If omitted, Chromium is launched and closed by crawl(). */
  browser?: Browser;
  /**
   * The given browser was launched as crawl() launches its own, with no proxy (Ghostreach's queue, RF-09): the relaxed read of
   * robots.txt stays open to it, as to a crawl's own browser.
   */
  browserPlain?: boolean;
  /** Progress messages, one line each. */
  log?: (message: string) => void;
  lookup?: import('./addresses.js').Lookup; // how the site's name is looked up (G-139); tests give a fake one
  hostLookup?: (host: string) => Promise<unknown>; // how failed third-party hosts' names are looked up (G-380); tests fake it
  /** How a name a request outside the browser goes to is looked up, to keep it from reaching further in than the site (G-243); tests give a fake one. */
  resolve?: import('./destination.js').Resolve;
}
