/**
 * The crawl's reading loop (lifted out of loop.ts, which starts the crawl, runs this, and finishes it): one page
 * after another until a stop reason holds.
 */
import { sleep } from './after-crawl.js';
import type { CrawlSettings } from './loop.js';
import { visit, type CrawlRun } from './page-step.js';
import { pageKey } from '../leaf/pages/url.js';

/**
 * Why the crawl stops now: the page limit whenever it is reached, whatever else holds (G-759). keepersecurity.com became
 * saturated at page 297 and the limit stopped it at 300 with menu pages unread; the build said "saturated".
 */
// Decision: G-759
function stopReasonOf(pagesRead: number, maxPages: number, saturated: boolean): 'saturated' | 'page-limit' {
  return pagesRead >= maxPages || !saturated ? 'page-limit' : 'saturated';
}

/**
 * Takes the next address from the frontier until it is empty or a stop reason holds (page limit,
 * nothing new for SATURATION_PAGES pages, too many errors in a row, the site asking us to slow down);
 * for each page: wait the polite delay, then load, judge and read it (page-step.ts).
 */
export async function readPages(run: CrawlRun, settings: CrawlSettings): Promise<void> {
  const { maxPages, delayMs, log } = settings;
  const { state, frontier } = run;
  const { pages, crawledFinal } = state;
  while (frontier.size > 0) {
    if (pages.length >= maxPages || frontier.stopsEarly(state.saturated)) {
      state.stop(stopReasonOf(pages.length, maxPages, state.saturated));
      break;
    }
    const item = frontier.next(state.saturated);
    if (!item) break;
    // Already read, as where an earlier redirect landed: it is in the report; don't load it again.
    if (crawledFinal.has(pageKey(item.url))) continue;
    // Queued before a page of its folder said the folder is another language (G-754): never loaded.
    if (state.isOtherLanguage(item.url)) {
      state.skip(item.url, 'other-language');
      continue;
    }
    // The delay runs from when the previous page's response arrived (the site had the request by
    // then), so time spent rendering and settling that page counts toward it.
    const wait = Math.max(delayMs, (state.robots.policy.crawlDelaySeconds ?? 0) * 1000);
    if (pages.length > 0) await sleep(Math.max(0, wait - (Date.now() - state.lastResponseAt)));
    log(`[${pages.length + 1}/${maxPages}] ${item.url}`);
    if ((await visit(run, item)) === 'stop') break;
  }
}
