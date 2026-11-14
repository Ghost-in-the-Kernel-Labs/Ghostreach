/**
 * The crawl's browser context, made in one place for the crawl and its second look, so a session
 * (a signed-in crawl, docs/LOGIN-PLAN.md) is carried by both or by neither: a signed-in first read
 * compared with an anonymous second read would call every personal heading a change between visits
 * (Reviewer G, T-03). The session is the context's storage state: its cookies and local storage; the
 * report never records them (test/crawl/session.spec.ts).
 */
import type { Browser, BrowserContext } from 'playwright';

/** A signed-in session to crawl with: the role it signs in as, and what the browser keeps of it. */
export interface CrawlSession {
  role: string;
  /** The page the session signed in on: landing there again means the session was lost (the crawl stops). */
  signInPage?: string;
  /** A storage-state file's path, or the state itself (Playwright's: cookies and origins). */
  storageState: string | Exclude<Parameters<Browser['newContext']>[0], undefined>['storageState'];
}

/** A fresh context as the crawl uses one: its user agent, no service workers, no downloads, and the session when given. */
// Decision: G-146
export async function newCrawlContext(browser: Browser, userAgent: string, session?: CrawlSession): Promise<BrowserContext> {
  const context = await browser.newContext({ userAgent, serviceWorkers: 'block', acceptDownloads: false, ...(session ? { storageState: session.storageState } : {}) });
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
