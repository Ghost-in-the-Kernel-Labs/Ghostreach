/**
 * The audit's items (G-748, G-749 slice 1a; docs/AUDIT-TESTS-PLAN.md part 1a): each line of a re-checkable finding keeps the
 * evidence of its item, keyed so a rebuild from a later crawl names the same defect alike, for SITE-02, 03, 06, 27 and 32 (by
 * HTTP and socket). The grouping's report (templates.json) keeps only the words, so a suite built without --audit is unchanged.
 * Made-up data only (G-085).
 */
import { describe, expect, it } from 'vitest';
import type { CrawledPage, CrawlReport } from '../../src/leaf/report.js';
import { siteFindings } from '../../src/findings/findings.js';
import type { SiteFinding } from '../../src/findings/types.js';
import { siteCrawl } from '../support/audit-crawls.js';
import { ORIGIN, page, report } from '../support/review-reports.js';

const lines = (fs: SiteFinding[], code: string) => fs.filter((f) => f.code === code).flatMap((f) => f.where);
const items = (fs: SiteFinding[], code: string) => lines(fs, code).map((w) => w.item);

/** A crawl with one of each: a broken link, a redirect, a script's move, a downgrade, a dead address and an http address that stays. */
function crawl(order: 'as-read' | 'reversed' = 'as-read'): CrawlReport {
  const pages: CrawledPage[] = [
    page('/'),
    page('/news'),
    page('/old-page', 404),
    page('/about', 200, { finalUrl: `${ORIGIN}/about/`, redirects: [{ url: `${ORIGIN}/about`, status: 301 }] } as Partial<CrawledPage>),
    page('/moved', 200, { finalUrl: `${ORIGIN}/elsewhere`, redirects: [{ url: `${ORIGIN}/moved`, status: 0 }] } as Partial<CrawledPage>),
    page('/plain', 200, { finalUrl: 'http://shop.test/plain', offSite: true, redirects: [{ url: `${ORIGIN}/plain`, status: 302 }] } as Partial<CrawledPage>),
  ];
  const read = order === 'reversed' ? [pages[0], ...pages.slice(1).reverse()] : pages;
  const edges = [
    { from: `${ORIGIN}/`, to: `${ORIGIN}/news` },
    { from: `${ORIGIN}/`, to: `${ORIGIN}/old-page` },
    { from: `${ORIGIN}/news`, to: `${ORIGIN}/old-page` },
    { from: `${ORIGIN}/`, to: `${ORIGIN}/about` },
    { from: `${ORIGIN}/`, to: `${ORIGIN}/moved` },
    { from: `${ORIGIN}/`, to: `${ORIGIN}/plain` },
  ];
  return report(read, {
    edges: order === 'reversed' ? [...edges].reverse() : edges,
    addresses: [{ address: '203.0.113.9', family: 4, answered: false, error: 'timed out' }, { address: '203.0.113.10', family: 4, answered: true }],
    site: { http: { url: 'http://shop.test/', status: 200 } },
  } as Partial<CrawlReport>);
}

describe('each re-checkable line keeps its item, keyed (G-749 slice 1a)', () => {
  const fs = siteFindings(crawl());

  it('SITE-02: the broken address, what it answered, the pages linking to it; keyed by its path', () => {
    expect(items(fs, 'SITE-02')).toEqual([{ at: 'address', key: '/old-page', url: `${ORIGIN}/old-page`, status: 404, from: ['/', '/news'], more: 0 }]);
  });

  it("SITE-03: the link that redirects, by the server's status; a script's move has no item (an HTTP re-check would call it fixed)", () => {
    expect(lines(fs, 'SITE-03').map((w) => w.url).sort()).toEqual([`${ORIGIN}/about`, `${ORIGIN}/moved`]);
    expect(items(fs, 'SITE-03').filter(Boolean)).toEqual([{ at: 'address', key: '/about', url: `${ORIGIN}/about`, status: 301, to: `${ORIGIN}/about/` }]);
  });

  it('SITE-32: the link that leaves https, where it was sent; keyed by its path', () => {
    expect(items(fs, 'SITE-32')).toEqual([{ at: 'address', key: '/plain', url: `${ORIGIN}/plain`, status: 302, to: 'http://shop.test/plain' }]);
  });

  it('SITE-06: the dead IP, keyed by itself', () => {
    expect(items(fs, 'SITE-06')).toEqual([{ at: 'ip', key: '203.0.113.9', host: 'shop.test', ip: '203.0.113.9', family: 4 }]);
  });

  it("SITE-27: the site's http address, keyed `http`", () => {
    expect(items(fs, 'SITE-27')).toEqual([{ at: 'address', key: 'http', url: 'http://shop.test/', status: 200 }]);
  });

  it('a broken link a redirect sent to the http address is keyed by that http address whole', () => {
    const r = crawl();
    r.site = { ...r.site, downgrades: { answers: [{ url: 'http://shop.test/plain', status: 404 }] } } as CrawlReport['site'];
    const broken = items(siteFindings(r), 'SITE-02').find((i) => i?.at === 'address' && i.url.startsWith('http:'));
    expect(broken).toEqual({ at: 'address', key: 'http://shop.test/plain', url: 'http://shop.test/plain', status: 404, from: ['/'], more: 0 });
  });

  it('the keys do not move when the crawl read its pages in another order', () => {
    const keys = (r: CrawlReport) => siteFindings(r).flatMap((f) => f.where.flatMap((w) => (w.item ? [`${f.code} ${w.item.key}`] : []))).sort();
    expect(keys(crawl('reversed'))).toEqual(keys(crawl()));
    expect(keys(crawl()).length).toBe(5);
  });

  it("a finding-only code's lines have no item", () => {
    expect(siteFindings(crawl()).filter((f) => ['SITE-04', 'SITE-34'].includes(f.code)).flatMap((f) => f.where).filter((w) => w.item)).toEqual([]);
  });
});

/** SITE-01's pages (three apps' pages under 404, each its own heading), a not-found address that answers 200, and two chains of redirects, one with a script's move. */
function httpCrawl(): CrawlReport {
  const app = (path: string, h1: string) => page(path, 404, { structure: { h1: [h1], main: true }, headings: [h1] } as Partial<CrawledPage>);
  const chain = (path: string, hops: { url: string; status: number }[]) => page(path, 200, { finalUrl: `${ORIGIN}/end`, redirects: hops } as Partial<CrawledPage>);
  return report([
    page('/'),
    app('/shop', 'Shop'),
    app('/cart', 'Cart'),
    app('/account', 'Account'),
    page('/end'),
    chain('/old', [{ url: `${ORIGIN}/old`, status: 301 }, { url: `${ORIGIN}/older`, status: 302 }]),
    chain('/js', [{ url: `${ORIGIN}/js`, status: 301 }, { url: `${ORIGIN}/js-next`, status: 0 }]),
  ], { notFound: { url: `${ORIGIN}/suite-builder-no-such-page-cafebabe`, status: 200 } } as Partial<CrawlReport>);
}

describe('the http codes keep their items, keyed (G-749 slice 2a)', () => {
  const fs = siteFindings(httpCrawl());

  it("SITE-01: each page answering an error yet drawing one, what it answered; keyed by its path", () => {
    expect(items(fs, 'SITE-01')).toEqual(['/shop', '/cart', '/account'].map((p) => ({ at: 'address', key: p, url: `${ORIGIN}${p}`, status: 404 })));
  });

  it('SITE-05: the address that cannot exist, what it answered; keyed by its path', () => {
    expect(items(fs, 'SITE-05')).toEqual([{ at: 'address', key: '/suite-builder-no-such-page-cafebabe', url: `${ORIGIN}/suite-builder-no-such-page-cafebabe`, status: 200 }]);
  });

  it("SITE-18: a chain of the server's redirects, how many; a chain with a script's move has none (an HTTP re-check would count fewer)", () => {
    expect(lines(fs, 'SITE-18').map((w) => w.url).sort()).toEqual([`${ORIGIN}/end`, `${ORIGIN}/end`]);
    expect(items(fs, 'SITE-18').filter(Boolean)).toEqual([{ at: 'redirects', key: '/old', url: `${ORIGIN}/old`, hops: 2 }]);
  });
});

describe('the header, file and tls codes keep their items, keyed (G-749 slice 2b)', () => {
  const fs = siteFindings(siteCrawl());

  it('SITE-24: each header no page sends, on the start page; keyed by its name (the frame guard by x-frame-options)', () => {
    expect(items(fs, 'SITE-24')).toEqual(['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options'].map((h) => ({ at: 'header', key: h, url: `${ORIGIN}/`, header: h })));
  });

  it('SITE-25: each header announcing a version, what it said and where; keyed by its name ("AmazonS3" names none)', () => {
    expect(items(fs, 'SITE-25')).toEqual([{ at: 'header', key: 'server', url: `${ORIGIN}/news`, header: 'server', value: 'nginx/1.18.0' }]);
  });

  it('SITE-26: what a browser refuses the certificate for, each its own item; keyed expiry, name or trust', () => {
    const cert = { host: 'shop.test', port: 443, validTo: '2026-11-20' };
    expect(items(fs, 'SITE-26')).toEqual([{ at: 'certificate', key: 'expiry', what: 'expiry', ...cert }, { at: 'certificate', key: 'name', what: 'name', ...cert }]);
  });

  it('SITE-28: each address the sitemap lists that is broken or moved, keyed by its path; a missing sitemap keyed `missing`', () => {
    const sitemap = { at: 'file', url: `${ORIGIN}/sitemap.xml`, status: 200 };
    expect(items(fs, 'SITE-28')).toEqual([{ ...sitemap, key: '/gone', lists: `${ORIGIN}/gone` }, { ...sitemap, key: '/moved?x=1', lists: `${ORIGIN}/moved?x=1` }]);
    const r = siteCrawl();
    r.site!.sitemap = { url: `${ORIGIN}/sitemap.xml`, status: 404 };
    expect(items(siteFindings(r), 'SITE-28')).toEqual([{ ...sitemap, status: 404, key: 'missing' }]);
  });

  it('SITE-29: security.txt, what it answered and whether it names a contact; keyed `security.txt`', () => {
    expect(items(fs, 'SITE-29')).toEqual([{ at: 'file', key: 'security.txt', url: `${ORIGIN}/.well-known/security.txt`, status: 200, noContact: true }]);
  });

  it("SITE-31: the site's other name, what it answered; keyed by its origin", () => {
    expect(items(fs, 'SITE-31')).toEqual([{ at: 'address', key: 'https://www.shop.test', url: 'https://www.shop.test/', status: 200 }]);
  });
});
