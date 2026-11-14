/**
 * TODO 132 box 2 (G-663), from the irthsolutions.com crawl of 2026-11-08: HubSpot writes its visitor parameters (`__hstc`,
 * `__hssc`, `__hsfp`) onto links that leave its pages, so one login page took 86 of the 100 outside links the crawl asks; and
 * the audit listed that check as having run, though 293 of the 393 addresses were never asked. An address is one address
 * without them, and a check that looked at part of what was seen says how much.
 */
import { describe, expect, it } from 'vitest';
import { auditChecked } from '../../src/audit/audit-checked.js';
import { externalLinks } from '../../src/crawl/site-probe.js';
import { isTracking, normalizeUrl } from '../../src/leaf/pages/url.js';
import { page, report } from '../support/review-reports.js';

const LOGIN = 'https://portal.fernhollow-pipelines.com/Logon.aspx?ReturnUrl=%2fportal';
/** The login page as normalizeUrl writes it: the URL parser re-encodes the query it rebuilds (`%2f` becomes `%2F`). */
const LOGIN_NORMAL = 'https://portal.fernhollow-pipelines.com/Logon.aspx?ReturnUrl=%2Fportal';
const visit = (n: number) => `${LOGIN}&__hstc=176797178.c4ed${n}.1794150491945.1&__hssc=176797178.${n}.1794150491945&__hsfp=5793569d${n}`;

describe("HubSpot's visitor parameters are not part of an address", () => {
  it('are tracking, as utm_* is', () => {
    for (const name of ['__hstc', '__hssc', '__hsfp', '__HSTC']) expect(isTracking(name)).toBe(true);
    expect(isTracking('hsLang')).toBe(false); // a language, box 5's question, not a visit's
  });

  it('come off an address, leaving its own query', () => {
    expect(normalizeUrl(visit(1))).toBe(LOGIN_NORMAL);
  });

  it('three links to one page under three visits are one outside address, linked three times', () => {
    const edges = [1, 2, 3].map((n) => ({ to: normalizeUrl(visit(n)) as string, external: true }));
    expect(externalLinks(edges)).toEqual([{ url: LOGIN_NORMAL, count: 3 }]);
  });
});

describe('a check that looked at part of what was seen says how much (G-663)', () => {
  const line = (name: string, r: ReturnType<typeof report>) => auditChecked(r).groups.flatMap((g) => g.lines).find((l) => l.startsWith(name));
  const answers = (n: number) => Array.from({ length: n }, (_, i) => ({ url: `https://other${i}.example.org/`, status: 200 }));

  it('outside links: "100 of the 393 addresses seen were asked, the most linked first"', () => {
    const r = report([page('/')], { site: { external: { seen: 393, answers: answers(100) } } } as never);
    expect(line('Links to other sites that lead nowhere', r)).toBe('Links to other sites that lead nowhere: 100 of the 393 addresses seen were asked, the most linked first');
    expect(line('Links to other sites that did not answer', r)).toBe('Links to other sites that did not answer the crawler: 100 of the 393 addresses seen were asked, the most linked first');
  });

  it('an address never asked on purpose (a private one) is not counted as checked', () => {
    const r = report([page('/')], { site: { external: { seen: 3, answers: [...answers(2), { url: 'http://10.0.0.1/', status: null, notAsked: 'a private network' }] } } } as never);
    expect(line('Links to other sites that lead nowhere', r)).toBe('Links to other sites that lead nowhere: 2 of the 3 addresses seen were asked, the most linked first');
  });

  it('every one asked: the name alone, as before', () => {
    const r = report([page('/')], { site: { external: { seen: 2, answers: answers(2) } } } as never);
    expect(line('Links to other sites that lead nowhere', r)).toBe('Links to other sites that lead nowhere');
  });

  it('images: "40 of the 120 images seen were asked, the site\'s own first" (G-698); all asked, the name alone', () => {
    const part = report([page('/')], { site: { images: { seen: 120, asked: 40 } } } as never);
    expect(line('Images that do not load', part)).toBe("Images that do not load: 40 of the 120 images seen were asked, the site's own first");
    const all = report([page('/')], { site: { images: { seen: 12, asked: 12 } } } as never);
    expect(line('Images that do not load', all)).toBe('Images that do not load');
  });

  it('a check that did not run says only that', () => {
    const r = report([page('/')], { site: { external: { seen: 393, answers: [], unreachable: true } } } as never);
    expect(line('Links to other sites that lead nowhere', r)).toBe('Links to other sites that lead nowhere: not run');
  });
});
