/**
 * Every finding of src/group/findings.ts said in full, on one crawl that shows each (G-132): its title singular and
 * plural, each page it names and what it says of it, why and the fix, the most serious first, and the broken links'
 * list. The first mutation run (G-239) found findings.ts held at 64% by findings.test.ts, which checks a title or a
 * line of each: the words, the pages left out, the order and the edges of each rule were held by nothing.
 */
import { describe, expect, it } from 'vitest';
import type { CrawledPage, CrawlReport } from '../../src/leaf/report.js';
import { appPagesUnderError, siteFindings } from '../../src/findings/findings.js';
import { isBrokenStatus } from '../../src/findings/on-purpose.js';

const ORIGIN = 'https://app.test';
const at = (path: string) => `${ORIGIN}${path}`;
function page(path: string, status: number | null, h1: string, extra: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url: at(path), finalUrl: at(path), status, redirects: [], title: path, contentType: 'text/html', depth: 1,
    fingerprint: { hash: path, paths: ['div'] }, headings: [h1], structure: { h1: [h1], main: true }, ...extra,
  } as CrawledPage;
}
const SIX = ['SITE-01', 'SITE-02', 'SITE-03', 'SITE-04', 'SITE-05', 'SITE-06'];
const ours = (r: CrawlReport) => siteFindings(r).filter((f) => SIX.includes(f.code));

const pages = [
  page('/', 200, 'Home', { title: 'Home' }),
  // Two pages of an app under its error status: a heading trimmed, and one only after the skipped headings.
  page('/team', 404, ' Team ', { title: 'Team' }),
  page('/jobs', 410, 'Jobs', { title: 'Jobs', structure: undefined, headings: ['Skip me', ' Jobs '], skippedHeadings: ['Skip me'] }),
  // Never an app's page: not read, a copy, off the site; nor a 400, nor a page that did not answer, as a working one.
  // Their titles are no page's either: a page sharing one is counted only when it is read, answered and on the site.
  page('/nofp', 404, 'Alpha', { fingerprint: undefined, title: 'Same' }),
  page('/dup', 404, 'Beta', { duplicateOf: at('/'), title: 'Same' }),
  page('/off', 404, 'Gamma', { offSite: true, title: 'Same' }),
  page('/bad', 400, 'Team ', { title: 'Same' }),
  page('/slow', null, 'Jobs', { title: 'Same' }),
  // A page whose headings were never read, under an error and among the titles: neither an app's page nor a crash.
  page('/bare', 404, '', { headings: undefined, structure: undefined, redirects: undefined }),
  // One missing page at two addresses, and a server error linked from seven pages.
  page('/gone', 404, 'Page not found', { title: 'x' }),
  page('/gone?again', 404, 'Page not found', { finalUrl: at('/gone'), title: 'x' }),
  page('/err', 500, 'Server error', { title: 'x' }),
  page('/a', 200, 'A', { title: 'Same' }),
  page('/b', 200, 'B', { title: 'Same' }),
  page('/d', 200, 'D', { title: 'Other' }),
  page('/e', 200, 'E', { title: ' Other ' }),
  page('/c', 200, 'C', { title: undefined }),
  page('/c2', 200, 'C2', { title: '  ' }),
  page('/c3', 200, 'C3', { title: undefined }),
  page('/nofp2', 200, 'Delta', { fingerprint: undefined, title: 'Same' }),
  page('/dup2', 200, 'Epsilon', { duplicateOf: at('/'), title: 'Same' }),
  page('/off2', 200, 'Zeta', { offSite: true, title: 'Same' }),
  page('/f', 200, '', { title: 'Same', headings: [], structure: { h1: [], main: true } }),
  page('/old', 200, 'New', { title: 'New', finalUrl: at('/new'), redirects: [{ url: at('/old'), status: 301 }, { url: at('/mid'), status: 302 }] }),
  page('/slash', 200, 'Slash', { title: 'Slash', finalUrl: at('/slash/'), redirects: [{ url: at('/slash'), status: 308 }] }),
];
const edges = [
  ...['/', '/a', '/b', '/d', '/e', '/c', '/team'].map((f) => ({ from: at(f), to: at('/err') })),
  { from: at('/'), to: at('/gone') }, { from: at('/a'), to: at('/gone?again') }, { from: at('/gone'), to: at('/gone') },
];
const addresses = [
  { address: '192.0.2.1', family: 4, answered: true }, { address: '192.0.2.2', family: 4, answered: false }, { address: '192.0.2.3', family: 4, answered: false, error: 'ETIMEDOUT' },
  { address: '2001:db8::1', family: 6, answered: true }, { address: '2001:db8::2', family: 6, answered: false, error: 'ENETUNREACH' },
];
const report = { startUrl: at('/'), origin: ORIGIN, pages, edges, addresses, notFound: { url: at('/no-such'), status: 200 } } as unknown as CrawlReport;

/** What SITE-02 hands the list of links that need a look for a broken page: its address, its answer, the first pages linking to it. */
const broken = (path: string, status: number, from: string[], more = 0) => ({ paths: [path], status, answer: `answered ${status}`, from, more, why: 'broken' });
/** The item a broken link's line keeps for its audit test (G-749): its address, keyed by its path, what it answered, who links to it. */
const brokenItem = (path: string, status: number, from: string[], more = 0) => ({ at: 'address', key: path, url: at(path), status, from, more });
/** The item of a dead IP of the site's name (SITE-06). */
const ipItem = (ip: string, family: 4 | 6) => ({ at: 'ip', key: ip, host: 'app.test', ip, family });
/** The item of a page's title (SITE-04, G-749 slice 5): shared, keyed by its path and words, or none, by its path. */
const titleItem = (path: string, said?: string) => ({ at: 'markup', key: said === undefined ? path : `${path}: ${said}`, read: said === undefined ? 'untitled' : 'title', said: said ?? null, pages: [at(path)] });
/** The item of a link that redirects (SITE-03): its first status, where it ended. */
const movedItem = (path: string, status: number, to: string) => ({ at: 'address', key: path, url: at(path), status, to: at(to) });

describe('every finding, said in full', () => {
  it('on one crawl that shows each, in the one order (G-678): major first, a break of the site\'s own links linked from the most pages leading, then the most pages', () => {
    expect(ours(report)).toEqual([
      {
        code: 'SITE-02', listed: ['link', 'links'], severity: 'major', title: '5 broken links: the site links to addresses that answer an error',
        where: [
          // G-668: the most pages linking first, then as read.
          { url: at('/err'), says: 'answered 500; linked from /, /a, /b, /d, /e and 2 more', link: broken('/err', 500, ['/', '/a', '/b', '/d', '/e'], 2), item: brokenItem('/err', 500, ['/', '/a', '/b', '/d', '/e'], 2) },
          { url: at('/gone'), says: 'answered 404; linked from /, /a', link: broken('/gone', 404, ['/', '/a']), item: brokenItem('/gone', 404, ['/', '/a']) },
          { url: at('/nofp'), says: 'answered 404', link: broken('/nofp', 404, []), item: brokenItem('/nofp', 404, []) },
          { url: at('/off'), says: 'answered 404', link: broken('/off', 404, []), item: brokenItem('/off', 404, []) },
          { url: at('/bare'), says: 'answered 404', link: broken('/bare', 404, []), item: brokenItem('/bare', 404, []) },
        ],
        why: 'A visitor who follows one of these links reaches an error instead of the page promised.', fix: 'Point each link at a page that exists, or bring the page back (or redirect its old address to where it went).',
      },
      {
        code: 'SITE-01', severity: 'major', title: '2 pages show real content but answer 404, 410: the site is served through its error page',
        where: [
          { url: at('/team'), says: 'answered 404, drew `Team`', link: { paths: ['/team'], status: 404, answer: 'answered 404', from: [], more: 0, why: 'answers an error yet draws a page' }, item: { at: 'address', key: '/team', url: at('/team'), status: 404 } },
          { url: at('/jobs'), says: 'answered 410, drew `Jobs`', link: { paths: ['/jobs'], status: 410, answer: 'answered 410', from: [], more: 0, why: 'answers an error yet draws a page' }, item: { at: 'address', key: '/jobs', url: at('/jobs'), status: 410 } },
        ],
        why: 'A visitor sees each page, but search engines, link checkers and monitoring trust the status: they treat these pages as missing, so they may never appear in search results, and every check calls them broken.', fix: 'Serve each page with status 200: a single-page app behind a CDN usually needs its error response (the one that returns index.html) set to 200, or each route pre-rendered as its own file.',
      },
      {
        code: 'SITE-06', listed: ['address', 'addresses'], severity: 'major',
        title: "2 of the 3 IPv4 and 1 of the 2 IPv6 addresses app.test points to do not answer: visits, and the suite's tests, pass or fail by which address they are given (flaky)",
        where: [
          { url: ORIGIN, says: '192.0.2.2 (IPv4): no answer; the others answered', item: ipItem('192.0.2.2', 4) },
          { url: ORIGIN, says: '192.0.2.3 (IPv4): ETIMEDOUT; the others answered', item: ipItem('192.0.2.3', 4) },
          { url: ORIGIN, says: '2001:db8::2 (IPv6): ENETUNREACH; the others answered', item: ipItem('2001:db8::2', 6) },
        ],
        why: 'Each new visit picks one of the addresses. On one that does not answer, the page hangs and fails after a long wait. Chrome often tries the next address, so the site looks fine from a browser; scripts, some phones, monitoring and test tools do not. Which address a visit is given changes every few minutes, so the same test passes one run and fails or slows the next.', fix: "Remove the address that does not answer from the domain's DNS records (often a registrar's parking or redirect record left beside the hosting's), or make it serve the site.",
      },
      {
        code: 'SITE-04', severity: 'minor', title: '5 different pages share 2 titles; 3 pages have no title',
        where: [
          { url: at('/a'), says: 'titled `Same`, shows `A`', item: titleItem('/a', 'Same') },
          { url: at('/b'), says: 'titled `Same`, shows `B`', item: titleItem('/b', 'Same') },
          { url: at('/f'), says: 'titled `Same`, shows ` `', item: titleItem('/f', 'Same') },
          { url: at('/d'), says: 'titled `Other`, shows `D`', item: titleItem('/d', 'Other') },
          { url: at('/e'), says: 'titled `Other`, shows `E`', item: titleItem('/e', 'Other') },
          { url: at('/c'), says: 'no title', item: titleItem('/c') },
          { url: at('/c2'), says: 'no title', item: titleItem('/c2') },
          { url: at('/c3'), says: 'no title', item: titleItem('/c3') },
        ],
        why: "Search results, bookmarks and browser tabs show the title: pages that share one can't be told apart, and a page without one shows its address.", fix: "Give each page a title of its own that names what it shows (in a single-page app, set it on each route).",
      },
      {
        code: 'SITE-03', listed: ['link', 'links'], severity: 'minor', title: "2 of the site's own links redirect before they arrive",
        where: [{ url: at('/old'), says: '301, 302 to /new', item: movedItem('/old', 301, '/new') }, { url: at('/slash'), says: '308 to /slash/', item: movedItem('/slash', 308, '/slash/') }],
        why: 'Every click on one of these links costs an extra round trip before the page starts loading, and search engines see one page at two addresses.', fix: "Link to each page's final address (with or without its trailing slash, as the server serves it).",
      },
      {
        code: 'SITE-05', listed: ['address', 'addresses'], severity: 'minor', title: 'An address that cannot exist answers 200: missing pages look like pages',
        where: [{ url: at('/no-such'), says: 'answered 200', item: { at: 'address', key: '/no-such', url: at('/no-such'), status: 200 } }],
        why: 'Search engines index missing addresses as pages (a "soft 404"), and a link that breaks is never reported as broken.', fix: 'Answer 404 for an address the site has no page for, while still showing a friendly not-found message.',
      },
    ]);
    // The other detectors' findings come after these, the major ones of all first.
    const all = siteFindings(report).map((f) => f.severity);
    expect(all).toEqual([...all].sort((x, y) => ['major', 'minor', 'info'].indexOf(x) - ['major', 'minor', 'info'].indexOf(y)));
  });
});

describe('each rule at its edge', () => {
  // G-743 (2): a visitor's other 4xx (409) is broken too, and a status past 599 (a bot wall's 999) is no server error.
  it('a broken link is a 404, a 410, a 409, or a 500 to 599: never a 499, a 400, a 999 or no answer', () => {
    expect([404, 410, 409, 500, 503, 599, 499, 400, 999, 200, null].map((status) => isBrokenStatus({ status }))).toEqual([true, true, true, true, true, true, false, false, false, false, false]);
  });

  it("an app's page under an error: two at least, and none whose heading says it is missing, in every spelling", () => {
    const errors = (...headings: string[]) => ({ startUrl: at('/'), origin: ORIGIN, pages: [page('/', 200, 'Home'), ...headings.map((h, i) => page(`/p${i}`, 404, h))], edges: [] }) as unknown as CrawlReport;
    expect(appPagesUnderError(errors('Our team', 'Careers'))).toHaveLength(2);
    expect(appPagesUnderError(errors('Our team'))).toEqual([]);
    // A heading two error pages share is the site's not-found page; a page with none is no page of its own.
    expect(appPagesUnderError(errors('Our team', 'Welcome aboard', 'Welcome aboard'))).toEqual([]);
    expect(appPagesUnderError(errors('Our team', ''))).toEqual([]);
    for (const missing of ['This page doesnt exist', 'This page doesn’t exist', "It can't be found", 'It can’t be found', 'It cant be found']) {
      expect(appPagesUnderError(errors('Our team', missing))).toEqual([]);
    }
  });

  it('one redirect, said in the singular; each only a trailing slash, added or dropped; the site\'s own pages alone', () => {
    const r = (...ps: CrawledPage[]) => ours({ startUrl: at('/'), origin: ORIGIN, pages: [page('/', 200, 'Home', { title: 'Home' }), ...ps], edges: [] } as unknown as CrawlReport);
    const moved = (from: string, to: string, extra: Partial<CrawledPage> = {}) => page(from, 200, from, { title: from, finalUrl: to.startsWith('http') ? to : at(to), redirects: [{ url: at(from), status: 301 }], ...extra });
    expect(r(moved('/old', '/new'))[0].title).toBe("1 of the site's own links redirects before it arrives");
    // The server's statuses, and its own script's move where one follows to another page.
    const mixed = moved('/m', '/z', { redirects: [{ url: at('/m'), status: 301 }, { url: at('/n'), status: 0 }] });
    expect(r(mixed)[0].where).toEqual([{ url: at('/m'), says: '301, its script to /z', item: movedItem('/m', 301, '/z') }]);
    expect(r(moved('/a', '/a/'), moved('/b/', '/b'))[0].title).toBe("2 of the site's own links redirect before they arrive (each only to add or drop a trailing slash)");
    // Off the site, or arriving on another site: not the site's own link.
    expect(r(moved('/x', '/y', { offSite: true }), moved('/out', 'https://elsewhere.test/'))).toEqual([]);
    // A visitor's page that redirects too is no reason to leave out the role's.
    const signedOut = moved('/r', '/s');
    const role = moved('/r#as=user', '/t#as=user');
    expect(r(signedOut, role)[0].where.map((w) => w.url)).toEqual([at('/r'), at('/r#as=user')]);
  });

  it('a broken page linked from exactly five pages names them all, and no "more"', () => {
    const five = ['/1', '/2', '/3', '/4', '/5'];
    const r = { startUrl: at('/'), origin: ORIGIN, pages: [page('/', 200, 'Home', { title: 'Home' }), page('/gone', 404, 'Page not found')], edges: five.map((f) => ({ from: at(f), to: at('/gone') })) } as unknown as CrawlReport;
    expect(ours(r)[0].where).toEqual([{ url: at('/gone'), says: 'answered 404; linked from /1, /2, /3, /4, /5', link: broken('/gone', 404, five), item: brokenItem('/gone', 404, five) }]);
  });

  it('an address that cannot exist: a finding while it answers below 300; a redirect (300) or no answer is none', () => {
    const r = (status: number | null) => ours({ startUrl: at('/'), origin: ORIGIN, pages: [page('/', 200, 'Home', { title: 'Home' })], edges: [], notFound: { url: at('/no-such'), status } } as unknown as CrawlReport).map((f) => f.code);
    expect([r(299), r(300), r(null)]).toEqual([['SITE-05'], [], []]);
  });
});
