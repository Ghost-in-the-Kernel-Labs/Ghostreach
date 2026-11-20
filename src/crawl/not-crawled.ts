/**
 * The addresses a crawl did not crawl, and why (CrawlReport.notCrawled; state.ts, CrawlState, which delegates here). Moved out
 * of state.ts by what it does, for the 400-line target (C-022, C-023, J-014): the bodies are the parent's, what `leaveOver`
 * read of CrawlState (why the crawl stopped, the pages read, the other languages) passed in.
 */
import { H } from '../leaf/heuristics/suite.js';
import { pageKey } from '../leaf/pages/url.js';
import type { CrawlReport, NotCrawledReason, StopReason } from '../leaf/report.js';
import type { Leftover } from './frontier.js';

export class NotCrawled {
  readonly #notCrawled: CrawlReport['notCrawled'] = [];
  readonly #notCrawledUrls = new Set<string>();
  /** Addresses not crawled past H.NOT_CRAWLED_MAX, counted, not listed. */
  #notCrawledLeft = 0;

  get list(): CrawlReport['notCrawled'] {
    return this.#notCrawled;
  }
  get left(): number {
    return this.#notCrawledLeft;
  }

  /** Records an address not crawled, and why, once. */
  skip(url: string, reason: NotCrawledReason): void {
    if (this.#notCrawledUrls.has(url)) return;
    this.#notCrawledUrls.add(url);
    // A site that makes addresses without end ends its list here; the rest are counted (Fable's review, C2).
    if (this.#notCrawled.length < H.NOT_CRAWLED_MAX) this.#notCrawled.push({ url, reason });
    else this.#notCrawledLeft++;
  }

  /**
   * The addresses still queued when the crawl stopped, recorded as not crawled, each for its true reason (G-741): `enough-samples`
   * only when a page of its kind was read (its pattern settled, or sampled before a saturated stop) and never for a page of the
   * site's menu, which is no more of anything (G-674); otherwise why the crawl stopped first (the page limit, or stopped).
   * phoenixoutcomes.com (2026-11-11) had /press, /awards and /certifications, footer-menu pages, left as `enough-samples`.
   */
  // Decision: G-741
  leaveOver(queued: readonly Leftover[], stopReason: StopReason, crawledFinal: ReadonlyMap<string, string>, isOtherLanguage: (url: string) => boolean): void {
    const stoppedFirst: NotCrawledReason = stopReason === 'page-limit' ? 'page-limit' : 'stopped';
    for (const item of queued) {
      if (crawledFinal.has(pageKey(item.url))) continue;
      if (isOtherLanguage(item.url)) {
        this.skip(item.url, 'other-language'); // queued before a page of its folder said its language (G-754)
        continue;
      }
      const enough = !item.menu && (item.settled || (stopReason === 'saturated' && item.sampled));
      this.skip(item.url, enough ? 'enough-samples' : stoppedFirst);
    }
  }
}
