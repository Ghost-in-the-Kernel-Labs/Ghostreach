// G-734: an error whose source the crawl could not tell (its stack names no script) is never said as the site's own (SITE-21,
// major): it is said in SITE-40, info and unconfirmed, as of no known source. And a bot challenge's own requests (a Private Access
// Token 401, a probe of a name that does not resolve) are no failed host of SITE-35. Made-up hosts and pages; the words that matter
// ("A network error occurred.", the challenge's path) are the real ones (rtafleet.com and perfectserve.com, 2026-11-11).
import { describe, expect, it } from 'vitest';
import type { CrawledPage, CrawlReport, PageLoad } from '../../src/leaf/report.js';
import { loadFindings } from '../../src/findings/load-findings.js';

const O = 'https://clinic.test';
function page(path: string, load?: PageLoad): CrawledPage {
  return {
    url: `${O}${path}`, finalUrl: `${O}${path}`, status: 200, redirects: [], title: path, contentType: 'text/html', depth: 1,
    fingerprint: { hash: path, paths: ['div'] }, headings: [path], structure: { h1: [path], main: true }, ...(load ? { load } : {}),
  } as CrawledPage;
}
const crawl = (pages: CrawledPage[], site?: CrawlReport['site']) => ({ startUrl: `${O}/`, origin: O, pages, edges: [], ...(site ? { site } : {}) }) as unknown as CrawlReport;
const one = (r: CrawlReport, code: string) => loadFindings(r).find((f) => f.code === code);

describe('SITE-21: an error of no known source is never the site\'s own', () => {
  it('the crawl\'s own field: SITE-40 says it, info and unconfirmed; SITE-21 says nothing', () => {
    const r = crawl([page('/podcast/a', { scriptErrorsUnknownSource: { count: 12, first: ['A network error occurred.'] } }), page('/podcast/b', { scriptErrorsUnknownSource: { count: 2, first: ['undefined'] } })]);
    expect(one(r, 'SITE-21')).toBeUndefined();
    const f = one(r, 'SITE-40');
    expect(f).toMatchObject({
      severity: 'info', unconfirmed: true,
      title: '14 errors came from a source the crawl could not tell on 2 pages, as seen by an automated visitor: unconfirmed (no script was named as their source); check in a browser',
      where: [{ url: `${O}/podcast/a`, says: '12 errors of no known source: A network error occurred.' }, { url: `${O}/podcast/b`, says: '2 errors of no known source: an error with no message' }],
    });
    expect(f?.why).not.toMatch(/the site's own scripts/i);
    expect(f?.why).toMatch(/not said as the site's/);
  });

  it('an older crawl\'s "A network error occurred." in scriptErrors moves out of SITE-21; the site\'s own named error stays, major', () => {
    const only = crawl([page('/blog/x', { scriptErrors: { count: 6, first: ['A network error occurred.'] } })]);
    expect(one(only, 'SITE-21')).toBeUndefined();
    expect(one(only, 'SITE-40')?.where).toEqual([{ url: `${O}/blog/x`, says: '6 errors of no known source: A network error occurred.' }]);
    const mixed = crawl([page('/about', { scriptErrors: { count: 3, first: ['PureCounter is not defined', 'A network error occurred.'] } })]);
    expect(one(mixed, 'SITE-21')).toMatchObject({ severity: 'major', title: "The site's own scripts throw 1 error on 1 page", where: [{ url: `${O}/about`, says: 'PureCounter is not defined' }] }); // G-743 (1): one message, not "at least 2"
    expect(one(mixed, 'SITE-40')?.where).toEqual([{ url: `${O}/about`, says: '1 error of no known source: A network error occurred.' }]);
  });

  it('another site\'s failures and an unknown error together: one SITE-40, each said', () => {
    const r = crawl([page('/', { failedOtherSite: { count: 1, first: ['player.video-made-up.net/api.js (403)'] }, scriptErrorsUnknownSource: { count: 1, first: ['A network error occurred.'] } })]);
    expect(one(r, 'SITE-40')?.title).toBe("1 script or style sheet from other sites' hosts did not load, and 1 error came from a source the crawl could not tell, on 1 page, as seen by an automated visitor: unconfirmed (other sites may block automated visitors); check in a browser");
  });
});

describe('SITE-35: a bot challenge\'s own requests are no failed host', () => {
  const challenge = ['challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/pat/a55d56c8… (401)', 'brunhild.challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/i/a… (ERR_NAME_NOT_RESOLVED)'];
  const looked = { failedHosts: [{ host: 'brunhild.challenges.cloudflare.com', resolves: null }, { host: 'challenges.cloudflare.com', resolves: true }] } as unknown as CrawlReport['site'];

  it('only the challenge\'s: no SITE-35', () => {
    const r = crawl([page('/', { failedElsewhere: { count: 2, first: challenge } }), page('/demo', { failedElsewhere: { count: 4, first: challenge } })], looked);
    expect(one(r, 'SITE-35')).toBeUndefined();
  });

  it('beside another host that failed: that host alone is named', () => {
    const r = crawl([page('/', { failedElsewhere: { count: 3, first: [...challenge, 'log.gone-made-up.net/event (ERR_NAME_NOT_RESOLVED)'] } })]);
    const f = one(r, 'SITE-35');
    expect(f?.title).toBe("Requests to 1 host of other sites failed during the crawl, as seen from the crawler's machine and network");
    expect(f?.where).toEqual([{ url: `${O}/`, says: '`log.gone-made-up.net`: 1 page asked it for data and the request failed (ERR_NAME_NOT_RESOLVED)' }]);
  });
});
