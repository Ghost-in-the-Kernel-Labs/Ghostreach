/**
 * The crawl's browser context, made in one place for the crawl and its second look, so both read as a first-time visitor:
 * no session, no cookies carried (GR-003: a review reads the public site).
 */
import type { Browser, BrowserContext } from 'playwright';

/** A fresh context as the crawl uses one: its user agent, no service workers, no downloads. */
// Decision: G-146
export async function newCrawlContext(browser: Browser, userAgent: string): Promise<BrowserContext> {
  const context = await browser.newContext({ userAgent, serviceWorkers: 'block', acceptDownloads: false });
  // A window a page opens is closed at once: the crawl reads the pages it opens itself, never a page's own windows,
  // and two hundred of them (window.open in a loop) each load and hold a renderer (item 52, step 4).
  context.on('page', (opened) => {
    void opened
      .opener()
      .then((by) => (by ? opened.close() : undefined))
      .catch(() => undefined);
  });
  return context;
}
