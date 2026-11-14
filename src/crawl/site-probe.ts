/**
 * What the site says of itself once, asked after the crawl (docs/AUDIT-RESEARCH.md, batch 3; G-202):
 * its certificate (when it is served over https), whether its http address sends visitors to https,
 * its sitemap, and its security.txt. A handful of requests in all, each one the polite delay apart,
 * never a guess at a page: only the addresses a convention names. It records; whether any of it is
 * wrong is the audit's to say (src/group/probe-findings.ts).
 */
import { connect, type PeerCertificate } from 'node:tls';
import { H } from '../leaf/heuristics/suite.js';
import { NotAsked, type Asker } from './destination.js';

// The guard every request outside the browser goes through (G-243), for the crawl loop: one import for it, not two.
export { guardedRequests } from './destination.js';
import type { CrawledPage, ExternalAnswer, SiteProbe } from '../leaf/report.js';
import { askAgain } from './report-read.js';
import { twinAskable } from '../leaf/pages/twin-name.js';

const DAY = 24 * 60 * 60 * 1000;

/** The certificate the site's https address presents: when it ends, the names it covers, whether it is trusted. */
function readCertificate(host: string, port: number, timeout: number): Promise<SiteProbe['certificate']> {
  return new Promise((resolve) => {
    const socket = connect({ host, port, servername: host, rejectUnauthorized: false, timeout }, () => {
      const cert: PeerCertificate = socket.getPeerCertificate();
      const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
      const names = (cert?.subjectaltname ?? '').split(/,\s*/).filter((n) => n.startsWith('DNS:')).map((n) => n.slice(4));
      const covers = (name: string) => name === host || (name.startsWith('*.') && host.endsWith(name.slice(1)) && host.split('.').length === name.split('.').length);
      resolve(validTo ? {
        validTo: validTo.toISOString().slice(0, 10),
        daysLeft: Math.floor((validTo.getTime() - Date.now()) / DAY),
        names: names.slice(0, 10),
        matches: names.some(covers),
        trusted: socket.authorized,
        ...(socket.authorizationError ? { why: String(socket.authorizationError) } : {}),
      } : undefined);
      socket.end();
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(undefined);
    });
    socket.on('error', () => resolve(undefined));
  });
}

/**
 * The images the pages asked for, each asked once (G-203): the site's own first, then other hosts', up to
 * H.IMAGES_ASKED in all; a server that refuses HEAD is asked with GET. The broken ones, with a page each.
 */
// Decision: G-203
export async function askImages(request: Asker, origin: string, images: Map<string, string>, timeout: number, wait: () => Promise<void>, offline = false): Promise<SiteProbe['images']> {
  if (!images.size) return undefined;
  const own = (u: string) => {
    try {
      return new URL(u).origin === origin;
    } catch {
      return false;
    }
  };
  const order = [...images.keys()].sort((a, b) => Number(own(b)) - Number(own(a)));
  // Offline (G-335): another host's images are counted, never asked. A host is its name: the site's other scheme or port is the site.
  const sameHost = (u: string) => !elsewhereThan(u, new URL(origin).hostname);
  const otherHosts = offline ? order.filter((u) => !sameHost(u)).length : 0;
  const asked = (offline ? order.filter(sameHost) : order).slice(0, H.IMAGES_ASKED);
  const broken: { url: string; status: number | null; page: string }[] = [];
  for (const url of asked) {
    if (own(url)) await wait();
    let status: number | null = null;
    try {
      status = (await headThenGet(request, url, { timeout, maxRedirects: 5, failOnStatusCode: false })).status();
    } catch (error) {
      // An image further in than the site (G-243) is not asked, so not said broken.
      if (error instanceof NotAsked) continue;
      status = null;
    }
    if (status === null || status >= 400) broken.push({ url, status, page: images.get(url) ?? origin });
  }
  return { asked: asked.length, seen: images.size, ...(otherHosts ? { otherHosts } : {}), ...(broken.length ? { broken } : {}) };
}

/**
 * The http:// addresses a redirect sent the site's links to (G-240), each asked once, the polite delay apart, up
 * to H.DOWNGRADES_ASKED: the crawl reads none of them, so this is the one way to know one is a missing page.
 * Asked as images are (HEAD, then GET where HEAD answers an error, G-731), redirects followed.
 */
/**
 * An address asked as a browser would find it: HEAD first, and any error answer confirmed by a GET, whose answer
 * is the one kept (G-731). A browser loads with GET; a server may refuse HEAD (405, 501) or not route it at all (a
 * Pages Function that exports only onRequestGet answers every HEAD 404, the first authorized real-site run, G-730).
 */
// Decision: G-731
async function headThenGet(request: Asker, url: string, options: Parameters<Asker['head']>[1]): ReturnType<Asker['head']> {
  const head = await request.head(url, options);
  return head.status() >= 400 ? request.get(url, options) : head;
}

// Decision: G-240
export async function askDowngrades(request: Asker, urls: string[], timeout: number, wait: () => Promise<void>): Promise<SiteProbe['downgrades']> {
  const distinct = [...new Set(urls)];
  if (!distinct.length) return undefined;
  const answers: { url: string; status: number | null }[] = [];
  for (const url of distinct.slice(0, H.DOWNGRADES_ASKED)) {
    await wait();
    let status: number | null = null;
    try {
      status = (await headThenGet(request, url, { timeout, maxRedirects: 5, failOnStatusCode: false })).status();
    } catch {
      status = null;
    }
    answers.push({ url, status });
  }
  return { seen: distinct.length, answers };
}

/**
 * Names kept for documentation and tests (RFC 2606, RFC 6761): example.com, .net and .org, and any name under
 * .example, .test or .invalid. A link to one is a placeholder, never a site that can go dark: not asked.
 */
/** Asked when an address of another site fails to resolve or connect: if it fails too, this computer reaches no other site (G-241). */
const CONTROL = 'https://example.com/';

const PLACEHOLDER_HOST = /(^|\.)example\.(com|net|org)$|\.(example|test|invalid)$/i;

/** The addresses on other sites the pages link to, each once (its #part aside), with how many links lead there; web addresses only, never a placeholder name. */
export function externalLinks(edges: readonly { to: string; external: boolean }[]): { url: string; count: number }[] {
  const count = new Map<string, number>();
  for (const e of edges) {
    if (!e.external || !/^https?:\/\//i.test(e.to)) continue;
    if (PLACEHOLDER_HOST.test(new URL(e.to).hostname)) continue;
    const url = e.to.replace(/#.*$/, '');
    count.set(url, (count.get(url) ?? 0) + 1);
  }
  return [...count].map(([url, n]) => ({ url, count: n }));
}

/** Why a request gave no answer, from the error the HTTP client threw. */
function failedAs(error: unknown): NonNullable<ExternalAnswer['failed']> {
  const text = String((error as Error)?.message ?? error);
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) return 'no-such-name';
  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH/i.test(text)) return 'refused';
  if (/timeout|timed out|ETIMEDOUT/i.test(text)) return 'timeout';
  return 'error';
}

/**
 * The addresses on other sites the site links to (G-241), each asked once after the crawl, the most-linked
 * first, up to H.EXTERNAL_LINKS_ASKED: HEAD, then GET where HEAD answers an error (G-731: refused, not allowed or not routed),
 * redirects followed. Two requests to one host are at least `delayMs` apart; other hosts are not kept waiting.
 * A server error or a timeout is asked once more at the end, as the suite's link report does.
 */
// Decision: G-241
export async function askExternal(
  request: Asker,
  links: { url: string; count: number }[],
  timeout: number,
  delayMs: number,
  sleep: (ms: number) => Promise<void>,
  now: () => number = Date.now,
  control: string = CONTROL,
  offline = false,
): Promise<SiteProbe['external']> {
  if (!links.length) return undefined;
  // Offline (G-333): counted, never asked; neither is the control.
  if (offline) return { seen: links.length, answers: [], offline: true };
  const order = [...links].sort((a, b) => b.count - a.count).slice(0, H.EXTERNAL_LINKS_ASKED);
  const lastAt = new Map<string, number>();
  const ask = async (url: string): Promise<Omit<ExternalAnswer, 'url'>> => {
    const host = new URL(url).host;
    const since = now() - (lastAt.get(host) ?? -Infinity);
    if (since < delayMs) await sleep(delayMs - since);
    lastAt.set(host, now());
    try {
      const options = { timeout, maxRedirects: 5, failOnStatusCode: false };
      const res = await headThenGet(request, url, options);
      const to = res.url();
      return { status: res.status(), ...(to && to !== url ? { to } : {}) };
    } catch (error) {
      return error instanceof NotAsked ? { status: null, notAsked: error.message } : { status: null, failed: failedAs(error) };
    }
  };
  const answers: ExternalAnswer[] = [];
  for (const { url } of order) answers.push({ url, ...(await ask(url)) });
  for (const [i, a] of answers.entries()) if (askAgain(a)) answers[i] = { url: a.url, ...(await ask(a.url)), again: true };
  // A name that does not resolve, or a connection refused, is a site gone only where this computer reaches other
  // sites: behind a proxy or a firewall every one fails so (this project's own cloud session, 2026-10-16: five
  // live sites "gone"). The control, example.com, is kept up by IANA for this.
  const unreached = answers.some((a) => a.failed === 'no-such-name' || a.failed === 'refused');
  const unreachable = unreached && (await ask(control)).status === null;
  return { seen: links.length, answers, ...(unreachable ? { unreachable: true as const } : {}) };
}

/** A Sitemap: line as the report keeps it: the address it parses to (never the raw text, which may hold terminal controls), else a fixed words. */
function sitemapNamed(line: string): string {
  try {
    return new URL(line).href;
  } catch {
    return 'a Sitemap line that is no address';
  }
}

/** Whether an address is on a host other than this one (any scheme or port); one that is no address is. */
function elsewhereThan(url: string, hostname: string): boolean {
  try {
    return new URL(url).hostname !== hostname;
  } catch {
    return true;
  }
}

/** A GET of the site's, the polite delay before it: its status, its Location, and its text when it is under 300; never thrown. */
type Ask = (url: string, maxRedirects?: number) => Promise<{ status: number | null; location: string | undefined; text: string }>;

/** What the site's own conventions say, asked once each, the polite delay before each. */
// Decision: G-202
export async function probeSite(request: Asker, origin: string, sitemaps: string[], pages: readonly CrawledPage[], timeout: number, wait: () => Promise<void>, offline = false): Promise<SiteProbe> {
  const probe: SiteProbe = {};
  const ask = askerOf(request, timeout, wait);
  const site = new URL(origin);
  if (site.protocol === 'https:') await askHttps(probe, site, ask, timeout);
  // Its other name, www or not (a domain name only, never an address or localhost): one page at two names splits it.
  const host = site.hostname;
  // Offline (G-333) it is not asked: it is a host other than the site's.
  if (twinAskable(host, offline)) await askTwin(probe, site, ask);
  probe.sitemap = await askSitemap(ask, origin, sitemaps, pages, offline);
  probe.securityTxt = await askSecurityTxt(ask, origin);
  return probe;
}

/** The site's GETs, each the polite delay after the last (`wait`), each with the crawl's timeout. */
function askerOf(request: Asker, timeout: number, wait: () => Promise<void>): Ask {
  return async (url: string, maxRedirects = 5) => {
    await wait();
    try {
      const res = await request.get(url, { timeout, maxRedirects, failOnStatusCode: false });
      return { status: res.status(), location: res.headers().location, text: res.status() < 300 ? await res.text() : '' };
    } catch {
      return { status: null, location: undefined, text: '' };
    }
  };
}

/** A site served over https: its certificate, and where its http address sends a visitor (no redirect followed). */
async function askHttps(probe: SiteProbe, site: URL, ask: Ask, timeout: number): Promise<void> {
  const certificate = await readCertificate(site.hostname, Number(site.port || 443), timeout);
  if (certificate) probe.certificate = certificate;
  const plain = `http://${site.host}/`;
  const answer = await ask(plain, 0);
  const to = answer.location ? new URL(answer.location, plain).href : undefined;
  probe.http = { url: plain, status: answer.status, ...(to ? { to } : {}) };
}

/** The site's other name, www or not: what it answers, and where it sends a visitor (no redirect followed). */
async function askTwin(probe: SiteProbe, site: URL, ask: Ask): Promise<void> {
  const host = site.hostname;
  const other = `${site.protocol}//${host.startsWith('www.') ? host.slice(4) : `www.${host}`}${site.port ? `:${site.port}` : ''}/`;
  const answer = await ask(other, 0);
  if (answer.status !== null) probe.twin = { url: other, status: answer.status, ...(answer.location ? { to: new URL(answer.location, other).href } : {}) };
}

/** The site's sitemap, robots.txt's first Sitemap: line or /sitemap.xml: how many addresses it lists, and those the crawl found broken or moved. */
async function askSitemap(ask: Ask, origin: string, sitemaps: string[], pages: readonly CrawledPage[], offline: boolean): Promise<SiteProbe['sitemap']> {
  const site = new URL(origin);
  // Offline (G-335) a Sitemap: line naming another host is not asked: the site's own /sitemap.xml is, and the line is recorded.
  const named = sitemaps[0];
  const elsewhere = offline && named !== undefined && elsewhereThan(named, site.hostname);
  const sitemapUrl = (elsewhere ? undefined : named) ?? `${origin}/sitemap.xml`;
  const sitemap = await ask(sitemapUrl);
  const locs = [...sitemap.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
  const index = /<sitemapindex\b/i.test(sitemap.text);
  const { broken, moved } = index ? { broken: [], moved: [] } : misleadingLocs(locs, pages);
  return {
    url: sitemapUrl,
    status: sitemap.status,
    ...(elsewhere ? { notAsked: { url: sitemapNamed(named), why: 'another host, --offline' } } : {}),
    ...(sitemap.status !== null && sitemap.status < 300 ? { listed: locs.length, ...(index ? { index: true as const } : {}) } : {}),
    ...(broken.length ? { broken: broken.slice(0, H.MARKUP_SAMPLE) } : {}),
    ...(moved.length ? { moved: moved.slice(0, H.MARKUP_SAMPLE) } : {}),
  };
}

/** A sitemap's addresses the crawl read and found broken or moved: it tells search engines the wrong pages. */
function misleadingLocs(locs: string[], pages: readonly CrawledPage[]): { broken: string[]; moved: string[] } {
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const broken = locs.filter((u) => {
    const p = byUrl.get(u);
    return p !== undefined && p.status !== null && p.status >= 400;
  });
  const moved = locs.filter((u) => (byUrl.get(u)?.redirects.length ?? 0) > 0);
  return { broken, moved };
}

/** The site's security.txt: what it answers, and whether a 200 names no Contact: line. */
async function askSecurityTxt(ask: Ask, origin: string): Promise<SiteProbe['securityTxt']> {
  const securityTxt = `${origin}/.well-known/security.txt`;
  const security = await ask(securityTxt);
  return { url: securityTxt, status: security.status, ...(security.status === 200 && !/^\s*contact:/im.test(security.text) ? { noContact: true as const } : {}) };
}
