/**
 * What the audit finds in what the site says of itself (G-202, src/group/probe-findings.ts): each
 * finding on a small crawl that shows it, quiet where it must be. test/crawl/site-probe.spec.ts asks a
 * served site and reads a real certificate.
 */
import { describe, expect, it } from 'vitest';
import type { CrawlReport, SiteProbe } from '../../src/leaf/report.js';
import { probeFindings } from '../../src/findings/probe-findings.js';
import { H } from '../../src/leaf/heuristics/suite.js';

const ORIGIN = 'https://shop.test';
const GOOD: SiteProbe = {
  certificate: { validTo: '2027-06-01', daysLeft: 240, names: ['shop.test', 'www.shop.test'], matches: true, trusted: true },
  http: { url: 'http://shop.test/', status: 301, to: 'https://shop.test/' },
  sitemap: { url: `${ORIGIN}/sitemap.xml`, status: 200, listed: 40 },
  securityTxt: { url: `${ORIGIN}/.well-known/security.txt`, status: 200 },
};
const crawl = (site: Partial<SiteProbe>) => ({ startUrl: `${ORIGIN}/`, origin: ORIGIN, pages: [], edges: [], site: { ...GOOD, ...site } }) as unknown as CrawlReport;
const codes = (site: Partial<SiteProbe>) => probeFindings(crawl(site)).map((f) => f.code);
const one = (site: Partial<SiteProbe>, code: string) => probeFindings(crawl(site)).find((f) => f.code === code);

describe('site probe findings (G-202)', () => {
  it('a site that says all it should is no finding; a crawl from before the probe has none', () => {
    expect(codes({})).toEqual([]);
    expect(probeFindings({ ...crawl({}), site: undefined })).toEqual([]);
  });

  it(`SITE-26: a certificate expired, under ${H.CERT_WARN_DAYS} days from its end, for another name, or not trusted`, () => {
    expect(H.CERT_WARN_DAYS).toBe(30);
    expect(one({ certificate: { ...GOOD.certificate!, validTo: '2026-10-19', daysLeft: 14 } }, 'SITE-26')?.title).toBe("The site's certificate expires on 2026-10-19, 14 days after the crawl: then browsers warn every visitor away"); // G-743 (4)
    expect(one({ certificate: { ...GOOD.certificate!, validTo: '2026-09-01', daysLeft: -34 } }, 'SITE-26')?.title).toBe("The site's certificate expired on 2026-09-01: browsers warn every visitor away");
    expect(one({ certificate: { ...GOOD.certificate!, matches: false, names: ['parked.example'] } }, 'SITE-26')?.where).toEqual([{ url: ORIGIN, says: 'the certificate is for parked.example, not shop.test', item: { at: 'certificate', key: 'name', host: 'shop.test', port: 443, what: 'name', validTo: '2027-06-01' } }]);
    expect(one({ certificate: { ...GOOD.certificate!, trusted: false, why: 'SELF_SIGNED_CERT_IN_CHAIN' } }, 'SITE-26')?.where[0].says).toBe('the certificate is not trusted by browsers (SELF_SIGNED_CERT_IN_CHAIN)');
    expect(codes({ certificate: { ...GOOD.certificate!, daysLeft: H.CERT_WARN_DAYS } })).toEqual([]);
  });

  it('SITE-27: an http address that answers without sending visitors to https; one that does not answer is minor', () => {
    expect(one({ http: { url: 'http://shop.test/', status: 200 } }, 'SITE-27')).toMatchObject({ severity: 'major', title: "The site's http address does not send visitors to https (it answers 200)" });
    expect(one({ http: { url: 'http://shop.test/', status: 302, to: 'http://shop.test/home' } }, 'SITE-27')?.severity).toBe('major');
    expect(one({ http: { url: 'http://shop.test/', status: null } }, 'SITE-27')?.severity).toBe('minor');
  });

  it('SITE-28: no sitemap, an empty one, or one listing addresses broken or moved; an index is fine', () => {
    expect(one({ sitemap: { url: `${ORIGIN}/sitemap.xml`, status: 404 } }, 'SITE-28')?.title).toBe('The site has no sitemap search engines can read');
    expect(one({ sitemap: { url: `${ORIGIN}/sitemap.xml`, status: 200, listed: 0 } }, 'SITE-28')?.where[0].says).toBe('answers, listing no address');
    expect(one({ sitemap: { url: `${ORIGIN}/sitemap.xml`, status: 200, listed: 9, broken: [`${ORIGIN}/gone`], moved: [`${ORIGIN}/old`] } }, 'SITE-28')?.title).toBe('The sitemap lists 2 addresses that are broken or moved');
    expect(codes({ sitemap: { url: `${ORIGIN}/sitemap.xml`, status: 200, listed: 3, index: true } })).toEqual([]);
  });

  it('SITE-30: images that answered an error or nothing when asked, each with a page that shows it', () => {
    const f = one({ images: { seen: 120, asked: 60, notOnPage: 4, broken: [{ url: `${ORIGIN}/img/a.jpg`, status: 404, page: `${ORIGIN}/shop` }, { url: 'https://cdn.test/b.png', status: null, page: `${ORIGIN}/` }] } }, 'SITE-30');
    expect(f).toMatchObject({ severity: 'major', title: '2 of the 60 images on the pages are broken: visitors see an empty box' });
    expect(f?.where).toEqual([
      { url: `${ORIGIN}/shop`, says: `${ORIGIN}/img/a.jpg answered 404`, item: { at: 'address', key: '/img/a.jpg', url: `${ORIGIN}/img/a.jpg`, status: 404, from: ['/shop'], more: 0 } },
      { url: `${ORIGIN}/`, says: 'https://cdn.test/b.png gave no answer', item: { at: 'address', key: 'https://cdn.test/b.png', url: 'https://cdn.test/b.png', status: null, from: ['/'], more: 0 } },
    ]);
    expect(codes({ images: { seen: 3, asked: 3 } })).toEqual([]);
  });

  it('SITE-30 of a crawl made before images were told apart (no notOnPage): says what was asked, never what visitors see (G-737)', () => {
    const f = one({ images: { seen: 1, asked: 1, broken: [{ url: 'https://challenges.cloudflare.test/cdn-cgi/challenge-platform/h/b/ci/x', status: 400, page: `${ORIGIN}/` }] } }, 'SITE-30');
    expect(f?.title).toBe('1 of the 1 images the pages requested is broken');
    expect(f?.title).not.toMatch(/visitors see/);
    expect(f?.why).toContain('crawl the site again to tell them apart');
  });

  it('SITE-31: the site answering at its other name, www or not, without sending visitors on; a redirect is fine (G-204)', () => {
    expect(one({ twin: { url: 'https://www.shop.test/', status: 200 } }, 'SITE-31')?.title).toBe('The site answers at two names, https://shop.test and https://www.shop.test, neither sending visitors to the other'); // G-743 (4)
    expect(codes({ twin: { url: 'https://www.shop.test/', status: 301, to: 'https://shop.test/' } })).toEqual([]);
  });

  it('SITE-29: no security.txt, or one with no contact', () => {
    expect(one({ securityTxt: { url: `${ORIGIN}/.well-known/security.txt`, status: 404 } }, 'SITE-29')?.title).toBe('The site publishes no security.txt, the file that tells security researchers whom to contact');
    expect(one({ securityTxt: { url: `${ORIGIN}/.well-known/security.txt`, status: 200, noContact: true } }, 'SITE-29')?.title).toBe("The site's security.txt names no contact");
  });

  it("SITE-37: robots.txt could only be read with certificate checking relaxed, because the server does not send its intermediate certificate (G-609)", () => {
    const withChain = { ...crawl({}), robots: { url: `${ORIGIN}/robots.txt`, status: 200, source: 'parsed', crawlDelaySeconds: null, certificateChain: 'incomplete' } } as unknown as CrawlReport;
    const [f, ...rest] = probeFindings(withChain);
    expect(rest).toEqual([]);
    expect(f).toMatchObject({ code: 'SITE-37', severity: 'minor', title: "The site's certificate chain looks incomplete from the crawler's machine: browsers hide it, some other clients cannot connect" });
    expect(f.where).toEqual([{ url: ORIGIN, says: "seen from the crawler's machine: the certificate was refused as lacking the intermediate certificate that links it to a trusted authority" }]);
    expect(f.why).toContain('TLS-intercepting proxy or antivirus');
    expect(f.why).toContain("seen from the crawler's own machine");
    expect(f.why).toContain('whatever the cause');
    expect(f.fix).toContain('NODE_EXTRA_CA_CERTS');
    expect(f.why).toContain('Node-based scripts');
    expect(f.why).toContain('API clients');
    expect(f.why).toMatch(/browsers/i);
    expect(f.why).toContain('forge');
    expect(f.fix).toContain('full chain');
    expect(f.fix).toContain('intermediate');
  });

  it('SITE-37 is absent without the field: a complete chain, and a crawl from before it', () => {
    const base = crawl({});
    expect(probeFindings(base).map((f) => f.code)).toEqual([]);
    for (const robots of [undefined, { url: `${ORIGIN}/robots.txt`, status: 200, source: 'parsed', crawlDelaySeconds: null }]) {
      expect(probeFindings({ ...base, robots } as unknown as CrawlReport).map((f) => f.code)).toEqual([]);
    }
  });

  it("SITE-37 says nothing the site wrote: a hostile robots url or error in the report reaches no line of it", () => {
    const hostile = '</script><img src=x onerror=alert(1)>\u202e';
    const report = { ...crawl({}), robots: { url: `${ORIGIN}/${hostile}`, status: 200, source: 'parsed', crawlDelaySeconds: null, certificateChain: 'incomplete', error: hostile } } as unknown as CrawlReport;
    const f = probeFindings(report).find((x) => x.code === 'SITE-37')!;
    expect(JSON.stringify(f)).not.toContain('onerror');
    expect(JSON.stringify(f)).not.toContain(hostile);
  });

  it('SITE-37 is also found when the certificate probe itself found nothing wrong, and does not hide the others', () => {
    const withChain = { ...crawl({ http: { url: 'http://shop.test/', status: 200 } }), robots: { url: `${ORIGIN}/robots.txt`, status: 200, source: 'parsed', crawlDelaySeconds: null, certificateChain: 'incomplete' } } as unknown as CrawlReport;
    expect(probeFindings(withChain).map((f) => f.code).sort()).toEqual(['SITE-27', 'SITE-37']);
  });
});
