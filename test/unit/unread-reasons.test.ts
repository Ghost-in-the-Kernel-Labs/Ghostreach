/**
 * An address the crawl left unread says why truly, and a menu page left unread is said in the summary (G-741). The corpus run of
 * phoenixoutcomes.com (2026-11-11) left /press, /awards and /certifications, footer-menu pages linked from all 54 pages read, as
 * `enough-samples` ("more pages of a type it already had enough of") with no page of their kind read, and the CLI said nothing of
 * them. The crawl itself: test/crawl/footer-menu-stop.spec.ts in the parent. The summary's cases went with `budgetLines` (cut at 1.2).
 */
import { describe, expect, it } from 'vitest';
import { Frontier } from '../../src/crawl/frontier.js';
import type { CrawlReport } from '../../src/leaf/report.js';
import { CrawlState } from '../../src/crawl/state.js';

const O = 'https://site.test';

/** The reasons `leaveOver` gives these leftovers after a stop for `stop`. */
function reasons(stop: CrawlReport['stopReason'], left: { url: string; settled: boolean; sampled: boolean; menu: boolean }[]): Record<string, string> {
  const state = new CrawlState(`${O}/`, 30);
  state.stop(stop);
  state.leaveOver(left);
  return Object.fromEntries(state.notCrawled.map((n) => [new URL(n.url).pathname, n.reason]));
}

const item = (path: string, settled: boolean, sampled: boolean, menu = false) => ({ url: `${O}${path}`, settled, sampled, menu });

describe('the reason an address is left unread is true (G-741)', () => {
  it('a menu page is never "enough samples": the page limit, or the stop, came first', () => {
    expect(reasons('page-limit', [item('/press', true, true, true)])).toEqual({ '/press': 'page-limit' });
    expect(reasons('saturated', [item('/press', true, true, true)])).toEqual({ '/press': 'stopped' });
  });

  it('a saturated stop says "enough samples" only of a kind it read; a kind never read was left because it stopped', () => {
    expect(reasons('saturated', [item('/news/post-9', false, true), item('/case-study/a', false, false)])).toEqual({ '/news/post-9': 'enough-samples', '/case-study/a': 'stopped' });
  });

  it('a settled kind is "enough samples" whatever stopped the crawl; any other leftover of a page limit is the limit', () => {
    expect(reasons('page-limit', [item('/news/post-9', true, true), item('/case-study/a', false, false)])).toEqual({ '/news/post-9': 'enough-samples', '/case-study/a': 'page-limit' });
  });

  it('the frontier says of each leftover whether a page of its kind was read and whether it is in the menu', () => {
    const f = new Frontier();
    for (const from of ['/', '/news/a', '/news/b']) f.recordLinks(`${O}${from}`, [`${O}/press`]);
    f.add({ url: `${O}/news/a`, depth: 1 });
    f.add({ url: `${O}/news/b`, depth: 1 });
    f.add({ url: `${O}/press`, depth: 1 });
    f.add({ url: `${O}/case-study/x`, depth: 1 });
    f.recordSample(`${O}/news/a`, { url: `${O}/news/a`, fingerprint: { tags: {}, depth: 1 } as never, headings: [] });
    expect(f.leftovers()).toEqual([
      { url: `${O}/news/a`, settled: false, sampled: true, menu: false },
      { url: `${O}/news/b`, settled: false, sampled: true, menu: false },
      { url: `${O}/press`, settled: false, sampled: false, menu: true },
      { url: `${O}/case-study/x`, settled: false, sampled: false, menu: false },
    ]);
  });
});
