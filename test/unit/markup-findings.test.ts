/**
 * What the audit finds in each page's markup and redirects (G-194, src/group/markup-findings.ts):
 * each finding on a small crawl that shows it, quiet where it must be. The crawl that records the
 * markup is test/crawl/markup.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import type { CrawledPage, CrawlReport, PageMarkup } from '../../src/leaf/report.js';
import { markupFindings, visitorPages as readPages } from '../../src/findings/markup-findings.js';
import { H } from '../../src/leaf/heuristics/suite.js';

const ORIGIN = 'https://shop.test';
const FINE: PageMarkup = { lang: 'en', viewport: 'width=device-width, initial-scale=1', description: 'A page.' };

function page(path: string, extra: Partial<CrawledPage> = {}, markup: Partial<PageMarkup> = {}): CrawledPage {
  return {
    url: `${ORIGIN}${path}`, finalUrl: `${ORIGIN}${path}`, status: 200, redirects: [], title: path, contentType: 'text/html', depth: 1,
    fingerprint: { hash: path, paths: ['div'] }, headings: [path], structure: { h1: [path], main: true },
    markup: { ...FINE, description: `About ${path}.`, ...markup }, ...extra,
  } as CrawledPage;
}

const crawl = (pages: CrawledPage[]) => ({ startUrl: `${ORIGIN}/`, origin: ORIGIN, pages, edges: [] }) as unknown as CrawlReport;
const codes = (pages: CrawledPage[]) => markupFindings(crawl(pages)).map((f) => f.code);
const one = (pages: CrawledPage[], code: string) => markupFindings(crawl(pages)).find((f) => f.code === code);

describe('markup findings (G-194)', () => {
  it('a site with nothing wrong in its markup has no finding, and a crawl from before the field has none of its own', () => {
    expect(codes([page('/'), page('/about')])).toEqual([]);
    const old = page('/old');
    delete old.markup;
    expect(codes([page('/'), old])).toEqual([]);
  });

  it('SITE-07, -08, -10, -13, -16: a sample on a page is a finding, one line per component it names (G-664)', () => {
    const shop = page('/shop', {}, { unnamed: { count: 7, first: ['<a href="/cart">', '<button class="icon-heart">'] } });
    expect(one([page('/'), shop], 'SITE-07')).toMatchObject({
      // 7 seen, 2 different (a sample not full names every different one): 2, a line for each, and the 5 alike said apart (G-737 slice 5).
      severity: 'major', title: '2 links and buttons on 1 page have nothing for a screen reader to say',
      where: [{ url: `${ORIGIN}/shop`, says: '`<a href="/cart">`' }, { url: `${ORIGIN}/shop`, says: '`<button class="icon-heart">`' }],
      repeated: 'Each line stands for every one alike on a page: /shop has 7 like its 2 listed.',
    });
    expect(one([page('/', {}, { unlabelled: { count: 1, first: ['<input name="email">'] } })], 'SITE-08')?.title).toBe('1 form field on 1 page has no label');
    expect(one([page('/', {}, { placeholder: { count: 2, first: ['Lorem ipsum dolor', 'XSS_TEST_BOOK'] } })], 'SITE-10')?.severity).toBe('major');
    expect(one([page('/', {}, { noAlt: { count: 3, first: ['<img src="/a.png">'] } }), page('/b', {}, { noAlt: { count: 1, first: ['<img src="/b.png">'] } })], 'SITE-13')?.title).toBe('2 images on 2 pages have no alt text');
    expect(one([page('/', {}, { deadAnchors: { count: 1, first: ['<a href="#reviews">'] } })], 'SITE-16')?.title).toBe('1 link on 1 page points to a part of the page that is not there');
  });

  it('SITE-07 over a site-wide footer: the headline counts the lines it lists, never the most one page saw (G-737 slice 5)', () => {
    // harriscomputer.com's shape (2026-11-11): / saw 11 nameless links, its sample keeps 5; the footer's links are on every page.
    const FOOTER = ['<a href="/">', '<a href="https://social.example/a">', '<a href="https://social.example/b">', '<div id="toggle">'];
    const home = page('/', {}, { unnamed: { count: 11, first: [...FOOTER, '<a href="/solutions">'] } });
    const rest = ['/a', '/b', '/c', '/d', '/e'].map((p) => page(p, {}, { unnamed: { count: FOOTER.length, first: FOOTER } }));
    const bare = page('/privacy', {}, { unnamed: { count: 1, first: ['<div id="toggle">'] } });
    const f = one([home, ...rest, bare], 'SITE-07');
    expect(f?.title).toBe('At least 5 links and buttons on 7 pages have nothing for a screen reader to say');
    expect(f?.title).not.toMatch(/11/);
    expect(f?.where).toHaveLength(5);
    expect(f?.unlisted).toBe('Up to 6 more may not be listed: the crawl notes the first 5 different ones on each page (/ showed 11, 5 listed).');
    // The footer on every page is said once, as "every page", never as 7 pages and their paths.
    expect(f?.where.map((w) => w.says)).toEqual([
      '`<div id="toggle">`, on every page',
      '`<a href="/">`, on every page but /privacy',
      '`<a href="https://social.example/a">`, on every page but /privacy',
      '`<a href="https://social.example/b">`, on every page but /privacy',
      '`<a href="/solutions">`',
    ]);
  });

  it('SITE-11: no viewport, or one that stops zooming; maximum-scale above 1 is fine', () => {
    const f = one([page('/', {}, { viewport: null }), page('/a', {}, { viewport: 'width=device-width, user-scalable=no' }), page('/b', {}, { viewport: 'width=device-width, maximum-scale=1.0' }), page('/c', {}, { viewport: 'width=device-width, maximum-scale=5' })], 'SITE-11');
    expect(f?.title).toBe('1 page has no viewport setting; 2 pages stop a visitor zooming');
    expect(f?.where.map((w) => new URL(w.url).pathname)).toEqual(['/', '/a', '/b']);
  });

  it('SITE-12: a canonical naming another site, an error or a redirect; one naming a good page is quiet', () => {
    const pages = [
      page('/', { canonical: `${ORIGIN}/` }),
      page('/a', { canonical: 'https://elsewhere.test/a' }),
      page('/b', { canonical: `${ORIGIN}/gone` }),
      page('/gone', { status: 404 }),
      page('/c', { canonical: `${ORIGIN}/old` }),
      page('/old', { finalUrl: `${ORIGIN}/new`, redirects: [{ url: `${ORIGIN}/old`, status: 301 }] }),
    ];
    expect(one(pages, 'SITE-12')?.where).toEqual([
      { url: `${ORIGIN}/a`, says: 'canonical names another site: https://elsewhere.test/a', item: { at: 'file', key: '/a', url: `${ORIGIN}/a`, status: 200, canonical: 'https://elsewhere.test/a' } },
      { url: `${ORIGIN}/b`, says: 'canonical /gone answers 404', item: { at: 'file', key: '/b', url: `${ORIGIN}/b`, status: 200, canonical: `${ORIGIN}/gone` } },
      { url: `${ORIGIN}/c`, says: 'canonical /old redirects to /new', item: { at: 'file', key: '/c', url: `${ORIGIN}/c`, status: 200, canonical: `${ORIGIN}/old` } },
    ]);
  });

  it('SITE-14 and SITE-15: no lang; no h1, or several', () => {
    expect(one([page('/', {}, { lang: null })], 'SITE-14')?.title).toBe('1 page does not say its language');
    const f = one([page('/', { structure: { h1: [], main: true } }), page('/a', { structure: { h1: ['Shop', 'Sale'], main: true } })], 'SITE-15');
    expect(f?.title).toBe('1 page has no main heading; 1 page has several main headings (h1)');
    // The site's words as code (siteText): a heading is quoted, never the line's own words.
    expect(f?.where[1].says).toBe('2 h1: `Shop`, `Sale`');
  });

  it('SITE-15: two h1s with the same words are one heading; different words are several (G-742 (1), G-737 slice 6)', () => {
    // harriscomputer.com's shape (2026-11-11): 11 of its 15 pages drew their h1 twice, the same words (a responsive or animated copy).
    expect(codes([page('/', { structure: { h1: ['Your Mission Partner.', 'Your Mission Partner.'], main: false } })])).not.toContain('SITE-15');
    expect(codes([page('/', { structure: { h1: ['Our  Solutions.', 'our solutions.'], main: true } })])).not.toContain('SITE-15');
    const f = one([page('/', { structure: { h1: ['Sitemap.', 'Sitemap.', 'Bring your best self to work.'], main: false } })], 'SITE-15');
    expect(f?.title).toBe('1 page has several main headings (h1)');
    expect(f?.where[0].says).toBe('2 h1: `Sitemap.`, `Bring your best self to work.`');
    expect(one([page('/', { structure: { h1: ['A.', 'B.'], main: true } })], 'SITE-15')?.where[0].says).toBe('2 h1: `A.`, `B.`');
  });

  it('SITE-17: no description, or one shared by pages with different titles', () => {
    const f = one([page('/', {}, { description: null }), page('/a', {}, { description: 'Our shop.' }), page('/b', {}, { description: 'Our shop.' })], 'SITE-17');
    expect(f?.title).toBe('1 page has no description for search results; 2 pages share a description with pages that differ'); // G-666: the noun said
  });

  it(`SITE-18: a chain of ${H.REDIRECT_CHAIN_HOPS} redirects or more; one alone is SITE-03's`, () => {
    expect(H.REDIRECT_CHAIN_HOPS).toBe(2);
    const chain = page('/a', { finalUrl: `${ORIGIN}/c/`, redirects: [{ url: `${ORIGIN}/a`, status: 301 }, { url: `${ORIGIN}/b`, status: 302 }] });
    expect(one([page('/'), chain], 'SITE-18')?.where).toEqual([{ url: `${ORIGIN}/c/`, says: '/a → /b → /c/ (301, 302)', item: { at: 'redirects', key: '/a', url: `${ORIGIN}/a`, hops: 2 } }]);
    expect(codes([page('/'), page('/a', { finalUrl: `${ORIGIN}/a/`, redirects: [{ url: `${ORIGIN}/a`, status: 301 }] })])).toEqual([]);
  });

  it(`SITE-19: a copyright ${H.COPYRIGHT_STALE_YEARS} years or more behind the year it was read; last year's is fine`, () => {
    expect(H.COPYRIGHT_STALE_YEARS).toBe(2);
    expect(one([page('/', {}, { copyright: { year: 2019, seen: 2026 } })], 'SITE-19')?.title).toBe('The copyright notice says 2019 on 1 page');
    expect(codes([page('/', {}, { copyright: { year: 2025, seen: 2026 } })])).toEqual([]);
  });

  it("a role's page counts only where no visitor's page has its path; error pages and copies never", () => {
    const pages = [page('/'), page('/a#as=user', { finalUrl: `${ORIGIN}/a#as=user` }), page('/a'), page('/b#as=user', { finalUrl: `${ORIGIN}/b#as=user` }), page('/x', { status: 404 }), page('/y', { duplicateOf: `${ORIGIN}/` })];
    expect(readPages(crawl(pages)).map((p) => p.url.replace(ORIGIN, ''))).toEqual(['/', '/a', '/b#as=user']);
  });
});
