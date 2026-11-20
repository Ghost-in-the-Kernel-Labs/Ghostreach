/**
 * What is wrong with the site, found in the crawl (G-132, src/findings/findings.ts): each finding on a small crawl that shows it,
 * each left quiet where it must be. The parent's cases of a suite's KNOWN-ISSUES.md, its bug files and `tagsAsCode` (the suite side)
 * and of the grouping's broken-links list (`defectsOf`) were not carried (1.4, docs/CUT.md).
 */
import { describe, expect, it } from 'vitest';
import type { CrawledPage, CrawlReport } from '../../src/leaf/report.js';
import { appPagesUnderError, siteFindings } from '../../src/findings/findings.js';
import { H } from '../../src/leaf/heuristics/suite.js';

const ORIGIN = 'https://app.test';

/** A page as the crawl records it: its address, status, title and main heading. */
function page(path: string, status: number, h1: string, extra: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url: `${ORIGIN}${path}`, finalUrl: `${ORIGIN}${path}`, status, redirects: [], title: 'App', contentType: 'text/html', depth: 1,
    fingerprint: { hash: path, paths: ['div'] }, headings: [h1], structure: { h1: [h1], main: true }, ...extra,
  } as CrawledPage;
}

function crawl(pages: CrawledPage[], extra: Partial<CrawlReport> = {}): CrawlReport {
  return { startUrl: `${ORIGIN}/`, origin: ORIGIN, pages, edges: pages.slice(1).map((p) => ({ from: `${ORIGIN}/`, to: p.url })), ...extra } as CrawlReport;
}

const codes = (r: CrawlReport) => siteFindings(r).map((f) => f.code);

describe('site findings (G-132)', () => {
  it('SITE-01: pages that draw their own content under a 404 are an app served through its error page, not broken links', () => {
    // As Site G: the start page answers 200, the rest 404 with real pages, one title for all.
    const r = crawl([page('/', 200, 'We build software'), page('/careers/', 404, 'Careers'), page('/contact/', 404, "Let's talk"), page('/projects/', 404, 'Projects')]);
    expect(appPagesUnderError(r).map((p) => new URL(p.url).pathname)).toEqual(['/careers/', '/contact/', '/projects/']);
    const [app] = siteFindings(r);
    expect(app).toMatchObject({ code: 'SITE-01', severity: 'major', title: '3 pages show real content but answer 404: the site is served through its error page' });
    expect(app.where[0].says).toBe('answered 404, drew `Careers`');
    expect(codes(r)).toEqual(['SITE-01', 'SITE-04']); // and one title for four different pages
  });

  it('stays quiet where a 404 is a real one: a not-found page, one odd page, or a copy of a working page', () => {
    // A site's own not-found page: the same heading on every missing address, or words that say so.
    expect(codes(crawl([page('/', 200, 'Home'), page('/a', 404, 'Page not found'), page('/b', 404, 'Page not found')]))).toEqual(['SITE-02']);
    expect(codes(crawl([page('/', 200, 'Home'), page('/a', 404, 'Oops! Nothing here'), page('/b', 404, "This page doesn't exist")]))).toEqual(['SITE-02']);
    // Fewer than H.APP_PAGES_MIN pages of their own: one odd heading is not an app.
    expect(H.APP_PAGES_MIN).toBe(2);
    expect(codes(crawl([page('/', 200, 'Home'), page('/a', 404, 'Our team')]))).toEqual(['SITE-02']);
    // A missing address that draws the start page (a catch-all route) is a broken link, not a page of its own.
    expect(appPagesUnderError(crawl([page('/', 200, 'Home'), page('/a', 404, 'Home'), page('/b', 404, 'Team')]))).toEqual([]);
  });

  it('SITE-02: broken links, each once, with the pages linking to them', () => {
    const r = crawl([page('/', 200, 'Home', { title: 'Home' }), page('/gone', 404, 'Not found', { title: 'Gone' })]);
    const [broken] = siteFindings(r);
    expect(broken).toMatchObject({ code: 'SITE-02', title: '1 broken link: the site links to an address that answers an error' });
    expect(broken.where).toEqual([{ url: `${ORIGIN}/gone`, says: 'answered 404; linked from /', link: { paths: ['/gone'], status: 404, answer: 'answered 404', from: ['/'], more: 0, why: 'broken' }, item: { at: 'address', key: '/gone', url: `${ORIGIN}/gone`, status: 404, from: ['/'], more: 0 } }]);
  });

  it('SITE-03: the site\'s own links that redirect, said to be only a trailing slash when they are; the start page aside', () => {
    const r = crawl([
      page('/', 200, 'Home', { title: 'Home', redirects: [{ url: `${ORIGIN}`, status: 301 }] }),
      page('/about', 200, 'About', { title: 'About', finalUrl: `${ORIGIN}/about/`, redirects: [{ url: `${ORIGIN}/about`, status: 301 }] }),
    ]);
    const [redirect] = siteFindings(r);
    expect(redirect).toMatchObject({ code: 'SITE-03', severity: 'minor', title: "1 of the site's own links redirects before it arrives (only to add or drop a trailing slash)" });
    expect(redirect.where).toEqual([{ url: `${ORIGIN}/about`, says: '301 to /about/', item: { at: 'address', key: '/about', url: `${ORIGIN}/about`, status: 301, to: `${ORIGIN}/about/` } }]);
  });

  it('SITE-03 and SITE-18: a script that only tidies the query off its own page is no redirect; one moving to another page is', () => {
    // As atos.net's newsroom: ?global-filter=press-release dropped by the page's script (status 0), the same path.
    const r = crawl([
      page('/', 200, 'Home', { title: 'Home' }),
      page('/news?filter=press', 200, 'News', { title: 'News', finalUrl: `${ORIGIN}/news`, redirects: [{ url: `${ORIGIN}/news?filter=press`, status: 0 }] }),
      page('/old?x=1', 200, 'New', { title: 'New', finalUrl: `${ORIGIN}/new`, redirects: [{ url: `${ORIGIN}/old?x=1`, status: 301 }, { url: `${ORIGIN}/new?x=1`, status: 0 }] }),
      page('/go', 200, 'There', { title: 'There', finalUrl: `${ORIGIN}/there`, redirects: [{ url: `${ORIGIN}/go`, status: 0 }] }),
    ]);
    const redirect = siteFindings(r).find((f) => f.code === 'SITE-03');
    expect(redirect?.where).toEqual([{ url: `${ORIGIN}/old?x=1`, says: '301 to /new', item: { at: 'address', key: '/old?x=1', url: `${ORIGIN}/old?x=1`, status: 301, to: `${ORIGIN}/new` } }, { url: `${ORIGIN}/go`, says: 'moved by its own script to /there' }]);
    expect(codes(r)).not.toContain('SITE-18');
  });

  it('SITE-03 leaves out a redirect seen only signed in (G-183): /register sends its role to /secure, a visitor gets the form', () => {
    // As practice.expandtesting.com: /register answered 200 signed out; #as=user redirected to /secure#as=user.
    const r = crawl([
      page('/', 200, 'Home', { title: 'Home' }),
      page('/register', 200, 'Register', { title: 'Register' }),
      page('/register#as=user', 200, 'Secure', { title: 'Secure', finalUrl: `${ORIGIN}/secure#as=user`, redirects: [{ url: `${ORIGIN}/register#as=user`, status: 302 }] }),
      page('/old#as=user', 200, 'New', { title: 'New', finalUrl: `${ORIGIN}/new#as=user`, redirects: [{ url: `${ORIGIN}/old#as=user`, status: 301 }] }),
    ]);
    const redirect = siteFindings(r).find((f) => f.code === 'SITE-03');
    // Only /old, which no visitor was seen to reach without its redirect, and its role said.
    expect(redirect?.where).toEqual([{ url: `${ORIGIN}/old#as=user`, says: '301 to /new (signed in as user)', item: { at: 'address', key: 'as user /old', url: `${ORIGIN}/old`, status: 301, to: `${ORIGIN}/new#as=user` } }]);
  });

  it('SITE-04: different pages sharing a title, and pages without one; the same page twice is no finding', () => {
    expect(siteFindings(crawl([page('/', 200, 'Home'), page('/a', 200, 'About')]))[0]).toMatchObject({ code: 'SITE-04', title: '2 different pages share one title' });
    expect(siteFindings(crawl([page('/', 200, 'Home', { title: 'Home' }), page('/a', 200, 'About', { title: '' })]))[0]).toMatchObject({ code: 'SITE-04', title: '1 page has no title' });
    expect(codes(crawl([page('/', 200, 'Home', { title: 'Home' }), page('/a', 200, 'About', { title: 'About' })]))).toEqual([]);
  });

  it('SITE-05: an address that cannot exist answering 200', () => {
    const r = crawl([page('/', 200, 'Home', { title: 'Home' })], { notFound: { url: `${ORIGIN}/suite-builder-no-such-page`, status: 200 } });
    expect(siteFindings(r)).toMatchObject([{ code: 'SITE-05', title: 'An address that cannot exist answers 200: missing pages look like pages' }]);
    expect(codes(crawl([page('/', 200, 'Home', { title: 'Home' })], { notFound: { url: `${ORIGIN}/x`, status: 404 } }))).toEqual([]);
  });

  it('SITE-06: an address the name points to that does not answer, where another of its kind did', () => {
    const addresses = [
      { address: '192.0.2.10', family: 4 as const, answered: true }, { address: '192.0.2.11', family: 4 as const, answered: true },
      { address: '198.51.100.6', family: 4 as const, answered: false, error: 'no answer in 5 s' },
      { address: '2001:db8::1', family: 6 as const, answered: false, error: 'ENETUNREACH' },
    ];
    const [dead] = siteFindings(crawl([page('/', 200, 'Home', { title: 'Home' })], { addresses }));
    expect(dead).toMatchObject({ code: 'SITE-06', severity: 'major', title: "1 of the 3 IPv4 addresses app.test points to does not answer: visits, and the suite's tests, pass or fail by which address they are given (flaky)" });
    expect(dead.where).toEqual([{ url: ORIGIN, says: '198.51.100.6 (IPv4): no answer in 5 s; the others answered', item: { at: 'ip', key: '198.51.100.6', host: 'app.test', ip: '198.51.100.6', family: 4 } }]);
    // Every address of a kind failing is this computer's network (no IPv6, a proxy), not the site's.
    expect(codes(crawl([page('/', 200, 'Home', { title: 'Home' })], { addresses: addresses.map((a) => ({ ...a, answered: false })) }))).toEqual([]);
  });
});
