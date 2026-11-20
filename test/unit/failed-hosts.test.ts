/**
 * The other sites' hosts whose requests failed during the crawl (SITE-35, G-380): read from the pages' samples, looked up
 * once after the crawl through a lookup the test gives (never the network), and said as a minor finding that names the
 * crawler's own vantage point. The host names are the site's words: quoted, never code.
 */
import { describe, expect, it } from 'vitest';
import { checkFailedHosts, type NameLookup } from '../../src/crawl/failed-hosts.js';
import { failedHostsOf } from '../../src/leaf/pages/failed-hosts.js';
import type { CrawledPage, CrawlReport, PageLoad } from '../../src/leaf/report.js';
import { loadFindings } from '../../src/findings/load-findings.js';
import { siteFindings } from '../../src/findings/findings.js';
import { H } from '../../src/leaf/heuristics/java-suite.js';

const ORIGIN = 'https://shop.test';
const page = (path: string, failedElsewhere?: string[]): CrawledPage =>
  ({
    url: `${ORIGIN}${path}`, finalUrl: `${ORIGIN}${path}`, status: 200, redirects: [], title: path, contentType: 'text/html', depth: 1,
    fingerprint: { hash: path, paths: ['div'] }, headings: [path], structure: { h1: [path], main: true },
    ...(failedElsewhere ? { load: { failedElsewhere: { count: failedElsewhere.length, first: failedElsewhere } } as PageLoad } : {}),
  }) as CrawledPage;
const crawl = (pages: CrawledPage[], site?: CrawlReport['site']) => ({ startUrl: `${ORIGIN}/`, origin: ORIGIN, pages, edges: [], ...(site ? { site } : {}) }) as unknown as CrawlReport;
const code = (e: string): NodeJS.ErrnoException => Object.assign(new Error(e), { code: e });
const PAGES = [
  page('/', ['log.gone.test/event (ERR_NAME_NOT_RESOLVED)', 'cdn.up.test:8443/x (503)']),
  page('/a', ['log.gone.test/event (ERR_NAME_NOT_RESOLVED)']),
  page('/b'),
];

describe('failedHostsOf: the hosts, from the pages\' samples', () => {
  it('a host once, its pages counted, the most pages first, the port and the case left off', () => {
    expect(failedHostsOf(crawl([...PAGES, page('/c', ['LOG.Gone.test/other (ERR_CONNECTION_REFUSED)'])]))).toEqual([
      { host: 'log.gone.test', pages: 3, why: 'ERR_NAME_NOT_RESOLVED', page: `${ORIGIN}/` },
      { host: 'cdn.up.test', pages: 1, why: '503', page: `${ORIGIN}/` },
    ]);
    expect(failedHostsOf(crawl([page('/')]))).toEqual([]);
  });
});

describe('checkFailedHosts: do the names resolve from here (G-380)', () => {
  const fake = (answers: Record<string, 'ok' | 'ENOTFOUND' | 'EAI_AGAIN' | 'hang'>): NameLookup => async (host) => {
    const a = answers[host];
    if (a === 'ok') return [{ address: '192.0.2.1', family: 4 }];
    if (a === 'hang') return new Promise(() => undefined);
    throw code(a ?? 'EAI_AGAIN');
  };
  const limits = { max: 20, lookupMs: 50, totalMs: 200 };

  it('resolves, does not resolve, could not check: three different claims', async () => {
    const r = await checkFailedHosts(crawl(PAGES), fake({ 'log.gone.test': 'ENOTFOUND', 'cdn.up.test': 'ok' }), limits);
    expect(r).toEqual([{ host: 'log.gone.test', resolves: false }, { host: 'cdn.up.test', resolves: true }]);
    // A resolver that fails for its own reasons (no network, a refusal) says nothing about the host.
    expect((await checkFailedHosts(crawl(PAGES), fake({}), limits))?.map((h) => h.resolves)).toEqual([null, null]);
  });

  it('a lookup that never answers is "could not check" after its time, and the total cap ends the rest', async () => {
    expect(H.FAILED_HOSTS_CHECKED).toBe(20);
    const started = Date.now();
    const r = await checkFailedHosts(crawl(PAGES), fake({ 'log.gone.test': 'hang', 'cdn.up.test': 'ok' }), limits);
    expect(r).toEqual([{ host: 'log.gone.test', resolves: null }, { host: 'cdn.up.test', resolves: true }]);
    expect(Date.now() - started).toBeLessThan(1000);
    // The total cap alone: a per-lookup time longer than it.
    const slow = await checkFailedHosts(crawl(PAGES), fake({ 'log.gone.test': 'hang', 'cdn.up.test': 'hang' }), { max: 20, lookupMs: 60_000, totalMs: 30 });
    expect(slow?.map((h) => h.resolves)).toEqual([null, null]);
  });

  it('at most max hosts are looked up, the rest counted; an address in numbers and a crawl with no failure are not looked up', async () => {
    const many = crawl([page('/', Array.from({ length: 5 }, (_, i) => `h${i}.test/e (ERR_X)`)), page('/n', ['127.0.0.1:9/e (ERR_CONNECTION_REFUSED)'])]);
    const asked: string[] = [];
    const r = await checkFailedHosts(many, async (h) => { asked.push(h); return []; }, { ...limits, max: 3 });
    expect(asked).toHaveLength(3);
    expect(r).toHaveLength(3);
    expect(await checkFailedHosts(crawl([page('/')]), fake({}), limits)).toBeUndefined();
  });
});

describe('SITE-35: the finding, minor, with the vantage point (G-380)', () => {
  const one = (r: CrawlReport) => loadFindings(r).find((f) => f.code === 'SITE-35');

  it('B: names the hosts, minor, says it was seen from the crawler\'s machine; no lookup, so no claim about the name', () => {
    const f = one(crawl(PAGES));
    expect(f).toMatchObject({ severity: 'minor', title: "Requests to 2 hosts of other sites failed during the crawl, as seen from the crawler's machine and network" });
    expect(f?.where).toEqual([
      { url: `${ORIGIN}/`, says: '`log.gone.test`: 2 pages asked it for data and the request failed (ERR_NAME_NOT_RESOLVED)' },
      { url: `${ORIGIN}/`, says: '`cdn.up.test`: 1 page asked it for data and the request failed (503)' },
    ]);
    expect(f?.why).toMatch(/crawler's own machine and network only: an ad blocker, the region, DNS filtering or the crawler's own network/);
    expect(f?.why).toMatch(/may not fail for real visitors/);
    expect(f?.why).toMatch(/stops no build/);
    expect(one(crawl([page('/'), page('/a')]))).toBeUndefined();
  });

  it('C: each name resolves, does not resolve or could not be checked, said apart from "the request failed"', () => {
    const f = one(crawl(PAGES, { failedHosts: [{ host: 'log.gone.test', resolves: false }, { host: 'cdn.up.test', resolves: null }] }));
    expect(f?.where.map((w) => w.says.split('; ')[1])).toEqual(['the name does not resolve from here', 'could not check whether the name resolves']);
    const g = one(crawl(PAGES, { failedHosts: [{ host: 'log.gone.test', resolves: true }] }));
    expect(g?.where.map((w) => w.says.split('; ')[1])).toEqual(['the name resolves from here, so the request failed for another reason', 'the name was not looked up']);
  });

  it('is in the findings a build says first, after the major ones, and no build-stopper', () => {
    const all = siteFindings(crawl(PAGES));
    expect(all.find((f) => f.code === 'SITE-35')?.severity).toBe('minor');
    expect(all.filter((f) => f.severity === 'major')).toEqual([]);
  });

  it('a hostile host name is quoted, never a sentence or code', () => {
    const evil = 'ev`il*|<b>\\u000a.test';
    const f = one(crawl([page('/', [`${evil}/e (ERR_NAME_NOT_RESOLVED)`])]));
    // A backtick inside needs a longer fence; the pipe and the tag stay inside it, and the sentence after is the tool's.
    expect(f?.where[0].says).toBe('``ev`il*|<b>\\u000a.test``: 1 page asked it for data and the request failed (ERR_NAME_NOT_RESOLVED)');
    expect(f?.title).not.toContain('<b>');
    // Whitespace, a line break and a long name: one line, cut.
    const long = one(crawl([page('/', [`${'a'.repeat(400)}.test/e (ERR_X)`])]));
    expect(long?.where[0].says.length).toBeLessThan(260);
  });
});
