/**
 * Waiting for a page to finish drawing itself before the crawl reads it (hydration).
 *
 * The load event says the HTML and its files have arrived, not that the page is done: a single-page
 * app renders after it, a site builder fills in sections late, a "load more" list only grows when
 * scrolled to. The crawl waits, each step bounded, in this order:
 *
 *   1. the network goes quiet (Playwright's networkidle): data the page asked for has come back;
 *   2. the DOM goes quiet: nothing added, removed or rewritten for half a second, which also
 *      covers rendering that needs no request at all. Attribute changes don't count: a carousel
 *      or an animation changes classes forever and would never let a page count as done;
 *   3. one pass scrolling down the page and back up, for content that loads when it comes into
 *      view, then the DOM goes quiet again.
 *
 * A page that never goes quiet (a ticker, a live feed) is read as it is when the time is up.
 * settlePage() runs the three from the crawl; every other function here runs in the page
 * (self-contained, for page.evaluate).
 * In the page: SELF-CONTAINED: domQuiet and scrollThrough go to page.evaluate() whole, so each uses nothing this file imports or declares beside it.
 */
import type { Page } from 'playwright';
import { H } from '../leaf/heuristics/crawl.js';

/**
 * Waits, each step bounded by `settleMs`, for a loaded page to finish drawing itself (0: not at all).
 * The second look waits the same way, scroll included (G-747): a scroll-reveal section's headings wait to be scrolled to.
 */
export async function settlePage(page: Page, settleMs: number): Promise<Settled | null> {
  if (settleMs <= 0) return null;
  const started = Date.now();
  const networkQuiet = await page.waitForLoadState('networkidle', { timeout: settleMs }).then(() => true, () => false);
  const quiet = await page.evaluate(domQuiet, { quietMs: H.DOM_QUIET_MS, maxMs: settleMs }).catch(() => false);
  // Readiness, as measured (docs/FRAMES-PLAN.md): the waits before the page was first read.
  const settled = { ms: Math.round((Date.now() - started) / 100) * 100, networkQuiet, domQuiet: quiet };
  const scrolled = await page.evaluate(scrollThrough, { maxSteps: H.SCROLL_MAX_SCREENS, pauseMs: H.SCROLL_PAUSE_MS }).catch(() => 0);
  if (scrolled > 0) {
    await page.waitForLoadState('networkidle', { timeout: Math.min(settleMs, H.AFTER_SCROLL_MS) }).catch(() => {});
    await page.evaluate(domQuiet, { quietMs: H.AFTER_SCROLL_QUIET_MS, maxMs: Math.min(settleMs, H.AFTER_SCROLL_MS) }).catch(() => {});
  }
  return settled;
}

/** How a page settled: how long the waits took (to 100 ms), and whether the network and the page went quiet. */
export type Settled = { ms: number; networkQuiet: boolean; domQuiet: boolean };

/**
 * Resolves once nothing has been added, removed or rewritten in the page for `quietMs`, or when
 * `maxMs` has passed. True when it went quiet.
 */
function domQuiet(args: { quietMs: number; maxMs: number }): Promise<boolean> {
  const { quietMs, maxMs } = args;
  return new Promise((resolve) => {
    let timer = 0;
    const done = (quiet: boolean) => {
      observer.disconnect();
      clearTimeout(timer);
      clearTimeout(limit);
      resolve(quiet);
    };
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => done(true), quietMs);
    });
    observer.observe(document, { childList: true, subtree: true, characterData: true });
    timer = window.setTimeout(() => done(true), quietMs);
    const limit = window.setTimeout(() => done(false), maxMs);
  });
}

/**
 * Scrolls down the page a screen at a time (at most `maxSteps` screens: an endless feed stays
 * endless), pausing so content that loads when it comes into view can start, then back to the top.
 * Returns how many screens it scrolled. A page no taller than its window is not scrolled.
 */
async function scrollThrough(args: { maxSteps: number; pauseMs: number }): Promise<number> {
  const { maxSteps, pauseMs } = args;
  const pause = () => new Promise((resolve) => setTimeout(resolve, pauseMs));
  const root = document.scrollingElement ?? document.documentElement;
  let steps = 0;
  while (steps < maxSteps && window.scrollY + window.innerHeight < root.scrollHeight - 2) {
    window.scrollBy(0, Math.max(200, Math.floor(window.innerHeight * 0.9)));
    steps++;
    await pause();
  }
  if (steps > 0) {
    window.scrollTo(0, 0);
    await pause();
  }
  return steps;
}
