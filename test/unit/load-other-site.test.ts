// G-657 (TODO 129 box 3; Ghost, 2026-11-08: "info"): a script or style sheet that failed on another site's host, or an error thrown
// by another site's script, is said as seen by an automated visitor: SITE-40, info, unconfirmed, never in the short audit's top.
// A failure on the site's own host (its sub-domains too) stays SITE-20 or SITE-21, major. Made-up hosts throughout.
import { describe, expect, it } from 'vitest';
import type { CrawledPage, CrawlReport, PageLoad } from '../../src/leaf/report.js';
import { thrownFrom } from '../../src/crawl/load-watch.js';
import { loadFindings } from '../../src/findings/load-findings.js';
import { siteFindings } from '../../src/findings/findings.js';
import { siteOf } from '../../src/leaf/pages/site-of.js';

const O = 'https://shop.test';
function page(path: string, load?: PageLoad): CrawledPage {
  return {
    url: `${O}${path}`, finalUrl: `${O}${path}`, status: 200, redirects: [], title: path, contentType: 'text/html', depth: 1,
    fingerprint: { hash: path, paths: ['div'] }, headings: [path], structure: { h1: [path], main: true }, ...(load ? { load } : {}),
  } as CrawledPage;
}
const crawl = (pages: CrawledPage[]) => ({ startUrl: `${O}/`, origin: O, pages, edges: [] }) as unknown as CrawlReport;
const one = (r: CrawlReport, code: string) => loadFindings(r).find((f) => f.code === code);

describe('a host is the site\'s own by its last two labels (one rule for the crawl and the audit)', () => {
  it('www, cdn and api of the site are its own; another name is not', () => {
    expect([siteOf('https://www.shop.test/a'), siteOf('https://cdn.shop.test/x.js'), siteOf('https://shop.test/')]).toEqual(['shop.test', 'shop.test', 'shop.test']);
    expect(siteOf('https://player.vimeo-made-up.net/api.js')).toBe('vimeo-made-up.net');
    expect(siteOf('player.vimeo-made-up.net/api.js (403)')).toBe('vimeo-made-up.net'); // as a sample says it: host and path
  });
});

describe('where an error was thrown, from its stack', () => {
  it('the first web address in the stack, or null', () => {
    expect(thrownFrom('TypeError: x is undefined\n    at load (https://widgets.made-up-seo.net/sa.js:1:200)\n    at https://shop.test/app.js:3:1')).toBe('https://widgets.made-up-seo.net/sa.js');
    expect(thrownFrom('ReferenceError: y\n    at https://shop.test/js/app.js:10:5')).toBe('https://shop.test/js/app.js');
    expect([thrownFrom('Error: no frames'), thrownFrom(undefined), thrownFrom('at <anonymous>:1:1')]).toEqual([null, null, null]);
  });
});

describe('SITE-40: what failed on another site\'s host is unconfirmed, info', () => {
  it('the crawl\'s own fields: SITE-40 says each page\'s, SITE-20 and SITE-21 are not said for them', () => {
    const r = crawl([page('/', { failedOtherSite: { count: 2, first: ['player.vimeo-made-up.net/api/player.js (403)', 'widgets.made-up-seo.net/sa.js (ERR_TIMED_OUT)'] }, scriptErrorsOtherSite: { count: 1, first: ['sa is not defined'] } })]);
    expect(one(r, 'SITE-20')).toBeUndefined();
    expect(one(r, 'SITE-21')).toBeUndefined();
    expect(one(r, 'SITE-40')).toEqual({
      code: 'SITE-40', severity: 'info', unconfirmed: true,
      title: "2 scripts and style sheets from other sites' hosts did not load, and their scripts threw 1 error, on 1 page, as seen by an automated visitor: unconfirmed (other sites may block automated visitors); check in a browser",
      where: [{ url: `${O}/`, says: '2 requests: player.vimeo-made-up.net/api/player.js (403), widgets.made-up-seo.net/sa.js (ERR_TIMED_OUT); 1 error: sa is not defined' }],
      why: "Another site's script or style sheet (a video player, a widget, an analytics tag) failed while the crawler read the page. Many such services refuse or slow an automated visitor while they serve a person, so this is not said as a fact about the site; when it also fails in a browser, the part of the page that uses it does not work.",
      fix: "Open the page in an ordinary browser with the developer tools' network tab and console. If the request fails there too, check the embed's address and the account with that service, or remove the embed.",
    });
  });

  it('an older crawl\'s failed list is split by host: the site\'s own (sub-domains too) stays SITE-20, major', () => {
    const r = crawl([page('/', { failed: { count: 3, first: ['/js/app.js (404)', 'cdn.shop.test/lib.css (404)', 'player.vimeo-made-up.net/api/player.js (403)'] } })]);
    expect(one(r, 'SITE-20')).toMatchObject({ severity: 'major', title: '2 scripts, style sheets and data requests on 1 page failed to load', where: [{ url: `${O}/`, says: '/js/app.js (404)' }, { url: `${O}/`, says: 'cdn.shop.test/lib.css (404)' }] });
    expect(one(r, 'SITE-40')?.where).toEqual([{ url: `${O}/`, says: '1 request: player.vimeo-made-up.net/api/player.js (403)' }]);
    // Only another site's in an older sample: the whole count is another site's.
    const all = crawl([page('/', { failed: { count: 7, first: ['player.vimeo-made-up.net/a.js (403)'] } })]);
    expect(one(all, 'SITE-20')).toBeUndefined();
    expect(one(all, 'SITE-40')?.title).toMatch(/^7 scripts and style sheets from other sites' hosts did not load on 1 page/);
  });

  it('none when every failure is the site\'s own', () => {
    const r = crawl([page('/', { failed: { count: 1, first: ['/js/app.js (404)'] }, scriptErrors: { count: 1, first: ['x is not defined'] } })]);
    expect(one(r, 'SITE-40')).toBeUndefined();
    expect(one(r, 'SITE-20')?.severity).toBe('major');
    expect(one(r, 'SITE-21')?.severity).toBe('major');
  });

  it('after every confirmed finding', () => {
    const found = siteFindings(crawl([page('/', { failedOtherSite: { count: 1, first: ['player.vimeo-made-up.net/a.js (403)'] } })]));
    expect(found.some((f) => f.code === 'SITE-40')).toBe(true);
    const at = found.findIndex((f) => f.code === 'SITE-40');
    expect(found.slice(0, at).every((f) => f.severity !== 'info' || f.code !== 'SITE-40')).toBe(true);
    expect(found.slice(at + 1).every((f) => f.severity === 'info')).toBe(true);
  });
});
