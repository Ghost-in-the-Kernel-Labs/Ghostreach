// SITE-39 (G-655, TODO 129 box 1): what the audit says of a link to another site that did not answer the crawler. Apart from
// test/unit/external-links.test.ts, which holds what gone is and how each address is asked.
import { describe, expect, it } from 'vitest';
import type { CrawlReport, ExternalAnswer } from '../../src/leaf/report.js';
import { askExternal } from '../../src/crawl/site-probe.js';
import { siteFindings } from '../../src/findings/findings.js';
import { linksToLookAt } from '../../src/audit/links-to-look.js';

// TODO 129 box 1: a link to another site that only timed out, or answered a server error, twice, is not called gone: it did not
// answer the crawler, which many sites do to an automated visitor. Its own finding, info, after every confirmed one, never in the
// short audit's top and never in "Links that need a look" (which leads the audit). The host is made up; its truth is by construction.
describe('an outside link that only timed out is unconfirmed, not gone (SITE-39)', () => {
  const ORIGIN = 'https://site.test';
  // A world where never.test never answers (a timeout every time it is asked) and gone.test answers 404.
  const asked = async () => {
    const answer = async (url: string) => {
      if (url.startsWith('https://never.test')) throw new Error('Timeout 10000ms exceeded.');
      return { status: () => (url.startsWith('https://gone.test') ? 404 : 200), url: () => url };
    };
    const request = { head: answer, get: answer } as never;
    const links = [{ url: 'https://never.test/', count: 2 }, { url: 'https://gone.test/x', count: 1 }];
    return askExternal(request, links, 1000, 0, async () => undefined, () => 0);
  };
  const report = (answers: ExternalAnswer[], more: Partial<NonNullable<CrawlReport['site']>['external']> = {}) =>
    ({
      startUrl: `${ORIGIN}/`, origin: ORIGIN, pages: [{ url: `${ORIGIN}/`, finalUrl: `${ORIGIN}/`, status: 200, redirects: [], title: 'Home', fingerprint: { hash: 'h', paths: ['div'] }, headings: ['Home'] }],
      edges: [
        { from: `${ORIGIN}/`, to: 'https://never.test/', external: true },
        { from: `${ORIGIN}/news`, to: 'https://never.test/', external: true },
        { from: `${ORIGIN}/`, to: 'https://gone.test/x', external: true },
      ],
      site: { external: { seen: answers.length, answers, ...more } },
    }) as unknown as CrawlReport;

  it('a host that never answers is unconfirmed; one that answers 404 is gone', async () => {
    const out = await asked();
    expect(out?.answers).toEqual([{ url: 'https://never.test/', status: null, failed: 'timeout', again: true }, { url: 'https://gone.test/x', status: 404 }]);
    const found = siteFindings(report(out!.answers));
    const gone = found.find((f) => f.code === 'SITE-33');
    expect(gone?.where.map((w) => w.url)).toEqual(['https://gone.test/x']);
    expect(gone?.severity).toBe('major');
    const unconfirmed = found.find((f) => f.code === 'SITE-39');
    expect(unconfirmed).toEqual({
      code: 'SITE-39', listed: ['link', 'links'],
      severity: 'info',
      unconfirmed: true,
      title: '1 link to another site did not answer the crawler: unconfirmed (many sites block automated visitors); open it in a browser',
      where: [{ url: 'https://never.test/', says: 'no answer in time, asked twice; linked from /, /news', offSite: true }],
      why: 'Many sites block an automated visitor, or answer it slowly, while they answer a person: the crawler cannot tell a site that turned it away from one that is down, so this is not said as a fact.',
      fix: 'Open each in a browser. If it does not load there either, point the link at where the page lives now, or take it out.',
    });
    // After every confirmed finding.
    expect(found.indexOf(unconfirmed!)).toBeGreaterThan(found.indexOf(gone!));
    expect(found.slice(found.indexOf(unconfirmed!) + 1).every((f) => f.severity === 'info')).toBe(true);
  });

  it('a server error twice is unconfirmed too, and several are counted in the title', () => {
    const f = siteFindings(report([{ url: 'https://never.test/', status: 503, again: true }, { url: 'https://gone.test/x', status: null, failed: 'timeout', again: true }])).find((x) => x.code === 'SITE-39');
    expect(f?.title).toBe('2 links to other sites did not answer the crawler: unconfirmed (many sites block automated visitors); open each in a browser');
    expect(f?.where.map((w) => w.says)).toEqual(['answered 503, asked twice; linked from /, /news', 'no answer in time, asked twice; linked from /']);
  });

  it('carries no link to look at: "Links that need a look" leads the audit, and this is not a fact about the site', () => {
    const found = siteFindings(report([{ url: 'https://never.test/', status: null, failed: 'timeout', again: true }]));
    expect(found.map((f) => f.code)).not.toContain('SITE-33');
    expect(linksToLookAt(found)).toEqual([]);
  });

  it('none when this computer reached no other site', () => {
    const answers: ExternalAnswer[] = [{ url: 'https://never.test/', status: null, failed: 'timeout', again: true }];
    expect(siteFindings(report(answers, { unreachable: true })).map((f) => f.code)).not.toContain('SITE-39');
  });
});
