/**
 * A whole host answering 404 to the crawler (G-743 (3)): when every address asked of another site's host answered the same 404
 * or 410, its index (an address shallower than the others) among them, the host is said unconfirmed, "the host may refuse
 * automated requests" (SITE-39), never "the pages are gone" (SITE-33, major). phoenixoutcomes.com's audit said 14 of 14 links
 * to a job board gone, the board's own listing page too (the corpus run of 2026-11-11, P1). Made-up hosts.
 */
import { describe, expect, it } from 'vitest';
import type { CrawlReport, ExternalAnswer } from '../../src/leaf/report.js';
import { refusingHosts } from '../../src/crawl/report-read.js';
import { siteFindings } from '../../src/findings/findings.js';

const ORIGIN = 'https://site.test';
const BOARD = 'https://jobs.board.test/recruiting/jobs';
const posting = (n: number) => `${BOARD}/Details/${n}/Site-LLC/Engineer-${n}`;
const LISTING = `${BOARD}/All/0f2a/Site-LLC`;
const report = (answers: ExternalAnswer[]) =>
  ({
    startUrl: `${ORIGIN}/`, origin: ORIGIN, pages: [{ url: `${ORIGIN}/`, finalUrl: `${ORIGIN}/`, status: 200, redirects: [], title: 'Careers', fingerprint: { hash: 'h', paths: ['div'] }, headings: ['Careers'] }],
    edges: answers.map((a) => ({ from: `${ORIGIN}/careers`, to: a.url, external: true })),
    site: { external: { seen: answers.length, answers } },
  }) as unknown as CrawlReport;
const code = (r: CrawlReport, c: string) => siteFindings(r).find((f) => f.code === c);

describe('a host that answers 404 to every address, its index too (G-743 (3))', () => {
  const all = [...[1, 2, 3].map((n) => ({ url: posting(n), status: 404 })), { url: LISTING, status: 404 }];

  it('is no SITE-33: said unconfirmed in SITE-39, "the host may refuse automated requests"', () => {
    const r = report(all);
    expect(code(r, 'SITE-33')).toBeUndefined();
    const f = code(r, 'SITE-39');
    expect(f?.unconfirmed).toBe(true);
    expect(f?.title).toBe('4 links to other sites answered an error on every address of their host: unconfirmed (the host may refuse automated requests); open each in a browser');
    expect(f?.where[0].says).toBe('answered 404, as did every address of jobs.board.test asked (4), its index too: the host may refuse automated requests; linked from /careers');
  });

  it('postings alone that answer 404, with no index among them, are gone as before', () => {
    const r = report(all.slice(0, 3));
    expect(code(r, 'SITE-33')?.where).toHaveLength(3);
    expect(code(r, 'SITE-39')).toBeUndefined();
  });

  it('a host where one address answered is no refusal: its 404s are gone', () => {
    const r = report([...all, { url: `${BOARD}/Details/9/Site-LLC/Open`, status: 200 }]);
    expect(code(r, 'SITE-33')?.where).toHaveLength(4);
  });

  it('beside a timeout of another host: one SITE-39, its title saying both', () => {
    const r = report([...all, { url: 'https://slow.test/', status: null, failed: 'timeout', again: true }]);
    expect(code(r, 'SITE-39')?.title).toBe('5 links to other sites did not answer the crawler, or answered an error on every address of their host: unconfirmed (many sites block automated visitors); open each in a browser');
  });

  it('refusingHosts: alike means one status; a name that does not resolve is gone, never a refusal', () => {
    expect([...refusingHosts(all)]).toEqual(['jobs.board.test']);
    expect([...refusingHosts([...all.slice(0, 3), { url: LISTING, status: 410 }])]).toEqual([]);
    expect([...refusingHosts([{ url: 'https://gone.test/a/b', status: null, failed: 'no-such-name' }, { url: 'https://gone.test/', status: null, failed: 'no-such-name' }])]).toEqual([]);
  });
});
