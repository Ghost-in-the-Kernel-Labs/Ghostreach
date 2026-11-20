/**
 * The addresses not crawled are listed to a bound (Fable's review of 2026-10-11, C2): a site that makes
 * addresses without end (a calendar, filters) adds a row per address it shows; past H.NOT_CRAWLED_MAX
 * they are counted, not listed, and the report says how many.
 */
import { describe, expect, it } from 'vitest';
import { H } from '../../src/leaf/heuristics/suite.js';
import { CrawlState } from '../../src/crawl/state.js';

describe('CrawlState.skip', () => {
  it('lists the first H.NOT_CRAWLED_MAX addresses and counts the rest, each once', () => {
    const state = new CrawlState('https://example.com/', 30);
    for (let i = 0; i < H.NOT_CRAWLED_MAX + 5; i++) state.skip(`https://example.com/day/${i}`, 'robots');
    state.skip('https://example.com/day/0', 'robots');
    state.skip(`https://example.com/day/${H.NOT_CRAWLED_MAX + 4}`, 'robots');
    const report = state.report('https://example.com/', { maxPages: 10, delayMs: 0, userAgent: 'test', maxConsecutiveErrors: 3 });
    expect(report.notCrawled).toHaveLength(H.NOT_CRAWLED_MAX);
    expect(report.notCrawledLeft).toBe(5);
  });

  it('says nothing more when every address is listed', () => {
    const state = new CrawlState('https://example.com/', 30);
    state.skip('https://example.com/a', 'robots');
    const report = state.report('https://example.com/', { maxPages: 10, delayMs: 0, userAgent: 'test', maxConsecutiveErrors: 3 });
    expect(report.notCrawledLeft).toBeUndefined();
  });
});

describe('CrawlState.report: the robots block and an incomplete certificate chain (G-609)', () => {
  const options = { maxPages: 10, delayMs: 0, userAgent: 'test', maxConsecutiveErrors: 3 };

  it('says certificateChain: incomplete when robots.txt was read with relaxed checking, and survives a JSON round trip', () => {
    const state = new CrawlState('https://example.com/', 30);
    state.readRobots({ ...state.robots, status: 200, certificateChain: 'incomplete' });
    const report = state.report('https://example.com/', options);
    expect(report.robots.certificateChain).toBe('incomplete');
    expect(JSON.parse(JSON.stringify(report)).robots.certificateChain).toBe('incomplete');
  });

  it('has no such key otherwise: the robots block is exactly what it was before', () => {
    const state = new CrawlState('https://example.com/', 30);
    const report = state.report('https://example.com/', options);
    expect(Object.keys(report.robots)).toEqual(['url', 'status', 'source', 'crawlDelaySeconds']);
    expect('certificateChain' in report.robots).toBe(false);
  });
});

// keepersecurity.com (2026-11-11): /blog/de/, /blog/ja/ and nine more were read as the English site, 135 of 300 pages (G-754).
describe('CrawlState: a language folder below the top level (G-754)', () => {
  const options = { maxPages: 10, delayMs: 0, userAgent: 'test', maxConsecutiveErrors: 3 };
  const multilingual = () => {
    const state = new CrawlState('https://example.com/', 30);
    state.decideLanguage({ prefix: null, lang: 'en-US', others: ['de-de'] });
    for (const path of ['/blog/', '/blog/de/', '/blog/ja/', '/blog/zh-hans/', '/blog/it/', '/blog/post-one/', '/products/id/12']) state.markSeen(`https://example.com${path}`);
    return state;
  };

  it('is a candidate only beside a sibling locale folder, once the site is known to have other languages', () => {
    const state = multilingual();
    expect(state.languageFolderCandidate('https://example.com/blog/de/')).toBe('blog/de');
    expect(state.languageFolderCandidate('https://example.com/blog/de/post-x/')).toBe('blog/de');
    expect(state.languageFolderCandidate('https://example.com/products/id/12')).toBeNull(); // no sibling: an id, not Indonesian
    expect(state.languageFolderCandidate('https://example.com/blog/post-one/')).toBeNull();
    const single = new CrawlState('https://example.com/', 30);
    for (const path of ['/blog/de/', '/blog/ja/']) single.markSeen(`https://example.com${path}`);
    expect(single.languageFolderCandidate('https://example.com/blog/de/')).toBeNull(); // one language, or --all-languages
  });

  it("is another language when its page says the segment's language and not the crawl's; its addresses are then left out", () => {
    const state = multilingual();
    expect(state.isOtherLanguage('https://example.com/blog/de/post-x/')).toBe(false); // not before a page of it says so
    expect(state.confirmLanguageFolder('blog/de', 'de-DE')).toBe(true);
    expect(state.isOtherLanguage('https://example.com/blog/de/post-x/')).toBe(true);
    expect(state.isOtherLanguage('https://example.com/blog/de/')).toBe(true);
    expect(state.isOtherLanguage('https://example.com/blog/deals/')).toBe(false);
    expect(state.isOtherLanguage('https://example.com/blog/ja/')).toBe(false); // each folder by its own page
    expect(state.confirmLanguageFolder('blog/zh-hans', 'zh-CN')).toBe(true);
    expect(state.report('https://example.com/', options).language?.others).toEqual(['blog/de', 'blog/zh-hans', 'de-de']);
  });

  it("stays in when its page says the crawl's language, another than its own, or nothing", () => {
    const state = multilingual();
    expect(state.confirmLanguageFolder('blog/it', 'en-US')).toBe(false); // an IT folder of the English site
    expect(state.languageFolderCandidate('https://example.com/blog/it/next/')).toBeNull(); // decided: no page of it is asked again
    expect(state.isOtherLanguage('https://example.com/blog/it/next/')).toBe(false);
    expect(state.confirmLanguageFolder('blog/ja', '')).toBe(false); // no lang: undecided, the next page there is asked
    expect(state.languageFolderCandidate('https://example.com/blog/ja/')).toBe('blog/ja');
    expect(state.confirmLanguageFolder('blog/ja', 'fr')).toBe(false); // French in a "ja" folder: not what the address says
    expect(state.report('https://example.com/', options).language?.others).toEqual(['de-de']);
  });

  it('leaves a queued address in a left-out folder over as other-language, not as the page limit', () => {
    const state = multilingual();
    state.confirmLanguageFolder('blog/de', 'de');
    state.stop('page-limit');
    state.leaveOver([{ url: 'https://example.com/blog/de/post-y/', settled: false, sampled: false, menu: false }]);
    expect(state.notCrawled).toEqual([{ url: 'https://example.com/blog/de/post-y/', reason: 'other-language' }]);
  });
});
