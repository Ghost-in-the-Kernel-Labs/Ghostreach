/**
 * Step 1 of Suite Builder: crawl one site in a real browser and record its pages and links.
 *
 * Politeness is built in, not optional:
 *   - one origin only (external links are recorded, never followed)
 *   - a page limit (H.MAX_PAGES; the crawl stops sooner once pages stop teaching it anything) and a
 *     delay between page loads (H.DELAY_MS, longer if robots.txt asks for it with Crawl-delay)
 *   - robots.txt is obeyed for the forecursor token and the one it went by before (RFC 9309, GR-017), on every redirect hop too
 *   - an honest User-Agent that names the tool
 *   - it stops after repeated failures, and at once on 429 Too Many Requests
 *   - images, media and fonts are not downloaded (the structure doesn't need them)
 *
 * What a loaded page shows is read by the readers (readers/): this file decides how to look (which
 * page next, when it has settled, when to stop), never what the suite should test.
 *
 * Pages are visited one at a time. The next page is picked by URL pattern so a small page budget
 * covers every kind of page (see frontier.ts), and the picks are deterministic.
 */
import { browserGuard, reachOfUrl } from './destination.js';
import { newCrawlContext } from './context.js';
import { chromium } from 'playwright';
import { checkFailedHosts } from './failed-hosts.js';
import { crawlLoop, crawlSettings } from './loop.js';
import { CrawlState } from './state.js';
import { routeCrawl } from './router.js';
import { H } from '../leaf/heuristics/crawl.js';
import { DEFAULT_USER_AGENT, type CrawlReport } from '../leaf/report.js';

import type { CrawlOptions } from './options.js';
export type { CrawlOptions } from './options.js';

/**
 * Reads a site into a crawl report (the Observation IR): opens a browser (or uses the one given),
 * routes its requests (images, media and fonts not fetched; each redirect of a page load caught, to be
 * followed one hop at a time), then runs the crawl loop (loop.ts) and closes what it opened. The report
 * says what the browser saw and nothing more: no page is interpreted here.
 */
// Decision: G-010
export async function crawl(options: CrawlOptions): Promise<CrawlReport> {
  const settings = crawlSettings(options);
  const { startUrl } = settings;

  // What the crawl knows as it goes, shared by the request router and the crawl loop (state.ts).
  const state = new CrawlState(startUrl, H.SATURATION_PAGES);
  // The browser's own requests no further in than the site is (G-270), as the crawl's own are (G-243).
  state.configure({ inward: browserGuard((await reachOfUrl(state.origin, options.resolve)).reach, options.resolve) });

  const ownsBrowser = !options.browser;
  const browser = options.browser ?? (await chromium.launch());
  const context = await newCrawlContext(browser, DEFAULT_USER_AGENT);
  try {
    // Every request through the crawl's router: no images, media or fonts; page loads one hop at a time (router.ts).
    await routeCrawl(context, state);
    const report = await crawlLoop(await context.newPage(), context, browser, state, settings);
    // The other sites' hosts whose data requests failed (G-380): do their names resolve from here?
    const failedHosts = report.site ? await checkFailedHosts(report, options.hostLookup) : undefined;
    if (failedHosts && report.site) report.site.failedHosts = failedHosts;
    const refused = [...state.refusedInBrowser];
    if (refused.length) settings.log(`The pages asked for ${refused.length} address${refused.length === 1 ? '' : 'es'} further in than the site; none was sent (${refused.slice(0, 3).map(([url, why]) => `${url}: ${why}`).join('; ')}${refused.length > 3 ? '; ...' : ''})`);
    return report;
  } finally {
    // A context a page took down is closed already: what was read is still the report (item 52, step 4).
    await context.close().catch(() => undefined);
    if (ownsBrowser) await browser.close().catch(() => undefined);
  }
}
