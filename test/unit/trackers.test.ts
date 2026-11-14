// G-656 (TODO 129 box 2): a click-tracking redirect is judged by where it goes. A link through a listed tracker host is recorded
// with its destination (`to`) and the tracker's address (`via`): an own-site destination is the site's own link, an outside one an
// outside link, and the audit says "through a tracker" beside it. The tracker itself is never asked, so never called broken; a
// host not on the list is never read through (an open redirect elsewhere is not followed blind). Made-up hosts throughout, but
// for the one shape the Vouched review met (cts.businesswire.com), whose truth is the list's own.
import { describe, expect, it } from 'vitest';
import type { CrawlReport, ExternalAnswer } from '../../src/leaf/report.js';
import { linkEdge, type RawLink } from '../../src/crawl/readers/links.js';
import { externalLinks } from '../../src/crawl/site-probe.js';
import { DESTINATION_PARAMS, TRACKERS, trackerDestination, type Tracker } from '../../src/crawl/trackers.js';
import { siteFindings } from '../../src/findings/findings.js';

const S = 'https://site.test';
const MADE_UP: Tracker[] = [{ host: 'click.track.test', why: 'a made-up tracker for the tests' }];
const link = (resolved: string): RawLink => ({ href: resolved, resolved, text: 'Read more', hidden: false, region: 'main', trigger: null, innerTriggers: [], newTab: false });
const via = (dest: string, param = 'url') => `https://click.track.test/ct?id=smartlink&${param}=${encodeURIComponent(dest)}&esheet=1`;

describe('the tracker list is data, each host with why', () => {
  it('names each host once, in lower case, with a reason; the parameters read are url, u, redirect and dest', () => {
    expect(TRACKERS.length).toBeGreaterThan(0);
    for (const t of TRACKERS) {
      expect(t.host, t.host).toBe(t.host.toLowerCase());
      expect(t.why.length, t.host).toBeGreaterThan(10);
    }
    expect(new Set(TRACKERS.map((t) => t.host)).size).toBe(TRACKERS.length);
    expect(TRACKERS.map((t) => t.host)).toContain('cts.businesswire.com');
    expect([...DESTINATION_PARAMS]).toEqual(['url', 'u', 'redirect', 'dest']);
  });
});

describe('where a tracker link goes', () => {
  it('reads the destination from a listed host, by any of the four parameters', () => {
    for (const p of DESTINATION_PARAMS) expect(trackerDestination(via(`${S}/industries/telehealth`, p), MADE_UP), p).toBe(`${S}/industries/telehealth`);
    expect(trackerDestination(`https://cts.businesswire.com/ct/CT?id=smartlink&url=${encodeURIComponent('https://www.vouched.example/identity')}&esheet=1&lan=en-US`)).toBe('https://www.vouched.example/identity');
  });

  it('reads nothing from a host not on the list, a relative or non-http destination, or none', () => {
    expect(trackerDestination(`https://open.redirect.test/go?url=${encodeURIComponent(`${S}/x`)}`, MADE_UP)).toBeNull();
    expect(trackerDestination('https://click.track.test/ct?url=/relative', MADE_UP)).toBeNull();
    expect(trackerDestination(`https://click.track.test/ct?url=${encodeURIComponent('javascript:alert(1)')}`, MADE_UP)).toBeNull();
    expect(trackerDestination(`https://click.track.test/ct?u=${encodeURIComponent('ftp://files.test/a')}`, MADE_UP)).toBeNull();
    expect(trackerDestination('https://click.track.test/ct?id=1', MADE_UP)).toBeNull();
    expect(trackerDestination('not a url', MADE_UP)).toBeNull();
    // A subdomain or a look-alike of a listed host is another host.
    expect(trackerDestination(via(`${S}/x`).replace('click.track.test', 'evil.click.track.test'), MADE_UP)).toBeNull();
  });

  it('records the link by its destination, the tracker as via: own-site is the site\'s own, outside is outside', () => {
    const own = linkEdge(`${S}/press`, link(via(`${S}/industries/telehealth`)), S, MADE_UP);
    expect(own).toMatchObject({ to: `${S}/industries/telehealth`, external: false, via: via(`${S}/industries/telehealth`) });
    const out = linkEdge(`${S}/press`, link(via('https://news.test/story')), S, MADE_UP);
    expect(out).toMatchObject({ to: 'https://news.test/story', external: true, via: via('https://news.test/story') });
    // An ordinary link has no via; a host not on the list is recorded as it is.
    expect(linkEdge(`${S}/`, link('https://news.test/a'), S, MADE_UP)).not.toHaveProperty('via');
    const open = `https://open.redirect.test/go?url=${encodeURIComponent(`${S}/x`)}`;
    expect(linkEdge(`${S}/`, link(open), S, MADE_UP)).toMatchObject({ to: open, external: true });
  });

  it('never asks the tracker: the outside links asked after the crawl are the destinations', () => {
    // Names that are not reserved for tests (externalLinks skips .test, .example and example.com): made up all the same.
    const wire: Tracker[] = [{ host: 'clicks.presswire-made-up.net', why: 'a made-up tracker for the tests' }];
    const through = (dest: string) => `https://clicks.presswire-made-up.net/ct?url=${encodeURIComponent(dest)}`;
    const edges = [linkEdge(`${S}/press`, link(through('https://news.made-up-paper.net/story')), S, wire)!, linkEdge(`${S}/press`, link(through(`${S}/about`)), S, wire)!];
    expect(externalLinks(edges).map((l) => l.url)).toEqual(['https://news.made-up-paper.net/story']);
  });
});

describe('the audit says "through a tracker" beside a link that went through one', () => {
  const report = (pages: { url: string; status: number }[], edges: object[], answers: ExternalAnswer[] = []) =>
    ({
      startUrl: `${S}/`, origin: S,
      pages: pages.map((p) => ({ url: p.url, finalUrl: p.url, status: p.status, redirects: [], title: p.url, fingerprint: { hash: p.url, paths: ['div'] }, headings: [p.url] })),
      edges,
      site: { external: { seen: answers.length, answers } },
    }) as unknown as CrawlReport;

  it('an own-site destination that is gone is the site\'s broken link, through a tracker; the tracker is not named broken', () => {
    const r = report(
      [{ url: `${S}/`, status: 200 }, { url: `${S}/press`, status: 200 }, { url: `${S}/old`, status: 404 }],
      [{ from: `${S}/press`, to: `${S}/old`, href: via(`${S}/old`), text: 'Old', external: false, via: via(`${S}/old`) }],
    );
    const said = JSON.stringify(siteFindings(r));
    const broken = siteFindings(r).find((f) => f.code === 'SITE-02');
    expect(broken?.where[0].says).toBe('answered 404; linked from /press, through a tracker (click.track.test)');
    expect(said).not.toContain('"url":"https://click.track.test');
  });

  it('an outside destination that is gone is SITE-33, through a tracker', () => {
    const r = report(
      [{ url: `${S}/`, status: 200 }],
      [{ from: `${S}/`, to: 'https://news.test/story', href: via('https://news.test/story'), text: 'Story', external: true, via: via('https://news.test/story') }],
      [{ url: 'https://news.test/story', status: 404 }],
    );
    expect(siteFindings(r).find((f) => f.code === 'SITE-33')?.where[0].says).toBe('answered 404; linked from /, through a tracker (click.track.test)');
  });

  it('says nothing of a tracker when no link to it went through one', () => {
    const r = report([{ url: `${S}/`, status: 200 }], [{ from: `${S}/`, to: 'https://news.test/story', href: 'https://news.test/story', text: 'Story', external: true }], [{ url: 'https://news.test/story', status: 404 }]);
    expect(siteFindings(r).find((f) => f.code === 'SITE-33')?.where[0].says).toBe('answered 404; linked from /');
  });
});
