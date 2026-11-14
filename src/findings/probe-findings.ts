/**
 * What the audit finds in what the site says of itself (docs/AUDIT-RESEARCH.md, batch 3; G-202): its
 * certificate, its http address, its sitemap and its security.txt. Each is a SiteFinding as G-132's are,
 * said once for the site; siteFindings (findings.ts) adds them.
 */
import { H } from '../leaf/heuristics/suite.js';
import type { CrawlReport, SiteProbe } from '../leaf/report.js';
import { keyOf } from './address-key.js';
import type { ItemEvidence } from './item-evidence.js';
import { imageItem } from './softer-items.js';
import type { SiteFinding } from './types.js';

const path = (url: string) => new URL(url).pathname;

/**
 * SITE-37: Node's TLS refused the site for a missing issuer and robots.txt was read with relaxed checking (`robots.certificateChain`,
 * G-609). Minor: browsers repair it, so visitors on a browser see nothing; the clients that do not (Node-based scripts, some API
 * clients, older mobile apps, link and uptime checkers) fail to connect. Hedged as SITE-35 is: seen from the crawler's machine, where
 * a TLS-intercepting proxy or antivirus can cause it too. Says nothing the site wrote: the origin is the crawl's own address.
 */
// Decision: G-609
function chainFinding(report: CrawlReport): SiteFinding[] {
  if (report.robots?.certificateChain !== 'incomplete') return [];
  return [{
    code: 'SITE-37', severity: 'minor',
    listed: ['address', 'addresses'], // what each line is (G-666)
    title: "The site's certificate chain looks incomplete from the crawler's machine: browsers hide it, some other clients cannot connect",
    where: [{ url: report.origin, says: "seen from the crawler's machine: the certificate was refused as lacking the intermediate certificate that links it to a trusted authority" }],
    why: "Browsers fetch a missing intermediate certificate themselves, so visitors see a working site. Other clients do not: Node-based scripts, some API clients and webhooks, older mobile apps and some monitoring and link-checking tools fail to connect with \"unable to verify the first certificate\". This was seen from the crawler's own machine and network only: a TLS-intercepting proxy or antivirus there, whose certificate authority the browser trusts but Node does not, causes the same refusal, and then the site is fine. The crawl read robots.txt with certificate checking relaxed (the pages were loaded under the browser's own checks), and whatever the cause, a man in the middle could have forged that one file. It stops no build and no test.",
    fix: "If the site's server sends only its own certificate, serve the full chain: install the certificate file your authority calls the \"full chain\" or \"bundle\" (your certificate followed by its intermediate) in the web server, load balancer or CDN; then check the site with an SSL checker that tests the chain. If an SSL checker finds the chain complete, the cause is on the crawler's machine: give Node the proxy's or antivirus's certificate authority file with NODE_EXTRA_CA_CERTS.",
  }];
}

/** Every finding of the site's own conventions, in the order the audit lists them. */
// Decision: G-202
export function probeFindings(report: CrawlReport): SiteFinding[] {
  const site = report.site;
  const out: SiteFinding[] = [...chainFinding(report)];
  if (!site) return out;
  return [...out, ...certificateFinding(report, site), ...httpRedirectFinding(site), ...sitemapFinding(site, report.origin), ...securityTxtFinding(site), ...twinNameFinding(report, site), ...brokenImagesFinding(site, report.origin)];
}

/**
 * The days left as counted when the crawl read the certificate (G-743 (4)): an audit read days later said "in 25 days" of a
 * date 22 days off (B5). The date is the fact; the count is the crawl's.
 */
const afterCrawl = (days: number) => `${days} day${days === 1 ? '' : 's'} after the crawl`;

/** SITE-26: a certificate that has expired, ends within H.CERT_WARN_DAYS, is for another name, or is not trusted by browsers. */
function certificateFinding(report: CrawlReport, site: SiteProbe): SiteFinding[] {
  const out: SiteFinding[] = [];
  const cert = site.certificate;
  if (!cert) return out;
  // [what a browser refuses it for (its item's key, G-749), in words].
  const where = ([
    ['expiry', cert.daysLeft < 0 ? `expired on ${cert.validTo}` : cert.daysLeft < H.CERT_WARN_DAYS ? `expires on ${cert.validTo}, ${afterCrawl(cert.daysLeft)}` : ''],
    ['name', cert.matches ? '' : `is for ${cert.names.join(', ') || 'another name'}, not ${new URL(report.origin).hostname}`],
    ['trust', cert.trusted || cert.daysLeft < 0 || !cert.matches ? '' : `is not trusted by browsers${cert.why ? ` (${cert.why})` : ''}`],
  ] as const).filter(([, said]) => said);
  const at = new URL(report.origin);
  if (where.length) {
    out.push({
      code: 'SITE-26', severity: 'major',
      listed: ['detail', 'details'], // what each line is (G-666)
      title: cert.daysLeft < 0 ? `The site's certificate expired on ${cert.validTo}: browsers warn every visitor away`
        : cert.daysLeft < H.CERT_WARN_DAYS && cert.matches && cert.trusted ? `The site's certificate expires on ${cert.validTo}, ${afterCrawl(cert.daysLeft)}: then browsers warn every visitor away`
        : "The site's certificate is not one browsers accept: they warn every visitor away",
      where: where.map(([what, w]) => ({ url: report.origin, says: `the certificate ${w}`, item: { at: 'certificate' as const, key: what, host: at.hostname, port: Number(at.port || 443), what, validTo: cert.validTo } })),
      why: 'A browser shows a full-page security warning in place of a site whose certificate has expired, is for another name, or is not trusted; most visitors leave, and search engines and payment providers treat the site as unsafe.',
      fix: "Renew the certificate before it ends, and have it renew itself (Let's Encrypt, or the host's automatic certificates); make sure it names every address the site answers on.",
    });
  }
  return out;
}

/** SITE-27: the site's http address does not answer, or does not send visitors to https. */
function httpRedirectFinding(site: SiteProbe): SiteFinding[] {
  const out: SiteFinding[] = [];
  const http = site.http;
  if (http && !(http.status !== null && http.status >= 300 && http.status < 400 && http.to?.startsWith('https://'))) {
    out.push({
      code: 'SITE-27', severity: http.status === null ? 'minor' : 'major',
      listed: ['address', 'addresses'], // what each line is (G-666)
      title: http.status === null ? 'The site\'s http address does not answer: a visitor who types the name without https may get nothing' : `The site's http address does not send visitors to https (it answers ${http.status}${http.to ? `, to ${http.to}` : ''})`,
      where: [{ url: http.url, says: http.status === null ? 'no answer' : `answered ${http.status}${http.to ? ` to ${http.to}` : ''}`, item: { at: 'address' as const, key: 'http', url: http.url, status: http.status, ...(http.to ? { to: http.to } : {}) } }],
      why: 'Old links, bookmarks and a name typed by hand arrive over http: without a redirect the visit is unencrypted (passwords and forms readable on the way) and browsers mark the page "Not secure".',
      fix: 'Redirect every http address to its https one with a 301 (one setting in most hosts and CDNs), and add Strict-Transport-Security.',
    });
  }
  return out;
}

/** SITE-28: no sitemap a search engine can read, or one listing addresses that are broken or moved. */
function sitemapFinding(site: SiteProbe, origin: string): SiteFinding[] {
  const out: SiteFinding[] = [];
  const sitemap = site.sitemap;
  if (!sitemap) return out;
  const missing = sitemap.status === null || sitemap.status >= 400 || sitemap.listed === 0;
  // Each address listed wrongly, said, and its item (G-749): the sitemap, keyed by the address listed; a missing one keyed `missing`.
  const listed = (u: string): ItemEvidence => ({ at: 'file', key: keyOf(u, origin), url: sitemap.url, status: sitemap.status, lists: u });
  const wrong = [...(sitemap.broken ?? []).map((u) => ({ says: `lists ${path(u)}, which answers an error`, item: listed(u) })), ...(sitemap.moved ?? []).map((u) => ({ says: `lists ${path(u)}, which redirects`, item: listed(u) }))];
  if (missing || wrong.length) {
    out.push({
      code: 'SITE-28', severity: 'minor',
      listed: ['address', 'addresses'], // what each line is (G-666)
      title: missing ? 'The site has no sitemap search engines can read' : `The sitemap lists ${wrong.length} address${wrong.length === 1 ? '' : 'es'} that ${wrong.length === 1 ? 'is' : 'are'} broken or moved`,
      where: missing
        ? [{ url: sitemap.url, says: sitemap.status === null ? 'no answer' : sitemap.listed === 0 ? 'answers, listing no address' : `answered ${sitemap.status}`, item: { at: 'file' as const, key: 'missing', url: sitemap.url, status: sitemap.status } }]
        : wrong.map((w) => ({ url: sitemap.url, ...w })),
      why: 'A sitemap tells search engines every page to index, and how fresh each is; without one they find pages only by following links, and one listing wrong addresses spends their visits on errors.',
      // G-743 (4): a site whose sitemap is there but wrong is told to correct it, not to publish one (P4).
      fix: missing
        ? 'Publish /sitemap.xml listing each page\'s final address (most site builders and CMSs have a setting or plugin for it), and name it in robots.txt (Sitemap: ...).'
        : 'Correct the sitemap: leave out each address that answers an error, and list each one that redirects at its final address (a sitemap a site builder or CMS writes is rebuilt from its pages: fix the page, or its setting).',
    });
  }
  return out;
}

/** SITE-29: no security.txt, or one that names no contact. */
function securityTxtFinding(site: SiteProbe): SiteFinding[] {
  const out: SiteFinding[] = [];
  const security = site.securityTxt;
  if (security && (security.status !== 200 || security.noContact)) {
    out.push({
      code: 'SITE-29', severity: 'minor',
      listed: ['address', 'addresses'], // what each line is (G-666)
      title: security.noContact ? "The site's security.txt names no contact" : 'The site publishes no security.txt, the file that tells security researchers whom to contact',
      where: [{ url: security.url, says: security.noContact ? 'answers, with no Contact line' : security.status === null ? 'no answer' : `answered ${security.status}`, item: { at: 'file' as const, key: 'security.txt', url: security.url, status: security.status, ...(security.noContact ? { noContact: true as const } : {}) } }],
      why: 'Researchers who find a security problem look for /.well-known/security.txt to know whom to tell (RFC 9116); without it they may not report it, or report it publicly.',
      fix: 'Publish /.well-known/security.txt with a Contact line (an email address or a form) and an Expires line.',
    });
  }
  return out;
}

/** SITE-31: the site answers at its other name (www or not) too, neither sending visitors to the other. */
// Decision: G-204
function twinNameFinding(report: CrawlReport, site: SiteProbe): SiteFinding[] {
  const out: SiteFinding[] = [];
  const twin = site.twin;
  if (twin?.status !== null && twin && twin.status >= 200 && twin.status < 300) {
    out.push({
      code: 'SITE-31', severity: 'minor',
      listed: ['address', 'addresses'], // what each line is (G-666)
      // Both as addresses, said alike (G-743 (4), SP3): a bare name and a www. name read differently in AUDIT.md.
      title: `The site answers at two names, ${new URL(report.origin).origin} and ${new URL(twin.url).origin}, neither sending visitors to the other`,
      where: [{ url: twin.url, says: `answered ${twin.status} itself`, item: { at: 'address' as const, key: new URL(twin.url).origin, url: twin.url, status: twin.status } }],
      why: 'Search engines see every page twice, at two addresses, and split its ranking between them; links and shares point at both.',
      fix: `Pick one name and redirect the other to it with a 301 (one setting in most hosts and CDNs): ${twin.url} to ${report.origin}/, say.`,
    });
  }
  return out;
}

/**
 * SITE-30: images the pages show that are broken. A crawl since 2026-11-11 asks only images a page showed a visitor and counts
 * the rest (`notOnPage`, G-737 slice 8); one made before asked every image the pages requested, a script's beacon or a hidden
 * frame's pixel too (perfectserve.com's Turnstile beacon), so its finding says what was asked, never what visitors see, and that a
 * new crawl tells them apart.
 */
// Decision: G-203, G-737
function brokenImagesFinding(site: SiteProbe, origin: string): SiteFinding[] {
  const out: SiteFinding[] = [];
  const broken = site.images?.broken ?? [];
  if (broken.length) {
    const asked = site.images?.asked ?? broken.length;
    const shownOnly = site.images?.notOnPage !== undefined;
    const are = broken.length === 1 ? 'is' : 'are';
    out.push({
      code: 'SITE-30', severity: 'major',
      listed: ['image', 'images'], // what each line is (G-666)
      title: shownOnly ? `${broken.length} of the ${asked} images on the pages ${are} broken: visitors see an empty box` : `${broken.length} of the ${asked} images the pages requested ${are} broken`,
      where: broken.map((b) => ({ url: b.page, says: `${b.url.length > 90 ? `${b.url.slice(0, 89)}…` : b.url} ${b.status === null ? 'gave no answer' : `answered ${b.status}`}`, item: imageItem(b.url, b.status, b.page, origin) })),
      why: `A broken image is the first thing a visitor notices: a product with no photo, a logo missing, a gap in the page.${shownOnly ? '' : " This crawl was made before the crawler told an image a page shows from any other image request (a script's beacon, a tracking pixel in a hidden frame), so one listed here may be none a visitor sees: crawl the site again to tell them apart."}`,
      fix: 'Put each image back at its address, or point the page at where it is now (a file renamed or a folder moved in a release is the usual cause).',
    });
  }
  return out;
}
