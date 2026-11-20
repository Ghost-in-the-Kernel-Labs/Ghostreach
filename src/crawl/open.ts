import type { Page, Response } from 'playwright';
import { H } from '../leaf/heuristics/crawl.js';
import { routeOf } from '../leaf/pages/url.js';

/** What opening a page tells the load watch (load-watch.ts): the load event had not fired within the cap. */
export interface LoadNote {
  loadNotFinished(afterMs: number): void;
}

/**
 * Opens an address in a browser page. A route (`/#/about`) differs from the page the browser is on, or from the one
 * before it, by its fragment alone, and a browser then only moves within its document: no request, no answer, and a
 * script that read its route once never reads it again. The page is emptied first, so the route is opened as a load
 * of its own (G-306). A second try of an address is opened the same way.
 */
// Decision: G-306
// A second try (`again`, G-200) is emptied first too: a newer browser keeps the load that timed out in flight, and the page's
// answer to it, arriving later, cancels the second try (`net::ERR_ABORTED`, Chromium 153 with Playwright 1.63, 2026-11-01).
//
// The wait is for the document, then at most H.LOAD_WAIT_MS for the load event (G-615): one resource that never finishes (a hanging
// third-party script) holds the load event of every page that asks for it, and the crawl paid the whole wait on each page (Mercury
// Insurance, 2026-11-06: about 15 s, 253 pages). A load that does not fire in time is said to `note`, the page is read as it stands,
// and what it answered is kept. Aborting the requests still pending is NOT done here: what a crawl may refuse to fetch is a security
// decision of Ghost's (src/crawl/router.ts), not a side effect of a wait.
// Decision: G-615
export async function openPage(page: Page, url: string, timeout: number, again = false, note?: LoadNote): Promise<Response | null> {
  if (again || routeOf(url) !== null) await page.goto('about:blank');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  const wait = Math.min(H.LOAD_WAIT_MS, timeout);
  try {
    await page.waitForLoadState('load', { timeout: wait });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
    note?.loadNotFinished(wait);
  }
  return response;
}
