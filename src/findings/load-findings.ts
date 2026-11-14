/**
 * What the audit finds in each page's load (docs/AUDIT-RESEARCH.md, batch 2; G-201): scripts and
 * styles that failed, scripts' errors, slow pages, insecure requests, and what the site's headers
 * leave open. Each is a SiteFinding as G-132's are; siteFindings (findings.ts) adds them.
 */
import { H } from '../leaf/heuristics/suite.js';
import type { CrawledPage, CrawlReport, PageLoad, Sample } from '../leaf/report.js';
import { failedHostsOf } from '../leaf/pages/failed-hosts.js';
import { siteText } from '../leaf/pages/site-text.js';
import { visitorPages } from './markup-findings.js';
import { otherSiteLoadFinding, splitLoad } from './other-site-load.js';
import type { SiteFinding } from './types.js';
import { componentFinding, type ComponentItem, type ComponentTitle } from './by-component.js';
import { answered } from './markup-items.js';
import { failedItem, insecureItem } from './softer-items.js';
import { scriptErrorFinding } from './script-errors.js';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const onPages = (n: number) => `on ${plural(n, 'page')}`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** One finding for a sample kind of the pages' loads (G-664: one line per request or error). */
function loadSample(pages: CrawledPage[], kind: 'failed' | 'insecure', noun: [string, string?], f: Omit<SiteFinding, 'where' | 'title' | 'listed'> & { title: ComponentTitle }, item?: ComponentItem): SiteFinding[] {
  return componentFinding(pages, (p) => p.load?.[kind] as Sample | undefined, (x) => x, noun, f, undefined, item);
}

/** The addresses of the pages an audit test can read (G-749): those that answered 2xx. */
const readable = (pages: CrawledPage[]) => {
  const ok = new Set(pages.filter(answered).map((p) => p.finalUrl));
  return (url: string) => ok.has(url);
};

/** Every load finding the crawl shows. */
// Decision: G-201
export function loadFindings(report: CrawlReport): SiteFinding[] {
  // G-657: another site's failures out of SITE-20 (an older crawl's split by host), said apart as SITE-40, info.
  const pages = visitorPages(report).filter((p) => p.load).map((p) => ({ ...p, load: splitLoad(p.load as PageLoad, report.origin) }));
  return [
    ...loadSample(pages, 'failed', ['script, style sheet or data request', 'scripts, style sheets and data requests'], {
      code: 'SITE-20', severity: 'major',
      title: (count, _n, m) => `${count} ${onPages(m)} failed to load`,
      why: 'A script or style sheet that does not load leaves part of the page unstyled or not working: a menu that does not open, a button that does nothing, a list that never fills. Visitors see it; nothing tells the site\'s owner.',
      fix: 'Point each at a file that exists (a path changed in a release is the usual cause), or remove the reference.',
    }, failedItem(report.origin)),
    ...scriptErrorFinding(pages, readable(pages)),
    ...slowFinding(pages),
    ...unfinishedFinding(pages),
    ...loadSample(pages, 'insecure', ['request'], {
      code: 'SITE-23', severity: 'major',
      title: (count, n, m) => `${count} ${onPages(m)} ${n === 1 ? 'goes' : 'go'} over plain http from an https page`,
      why: 'Browsers block a script or style asked for over http from an https page, and warn about the rest ("not secure"); what was blocked is missing from the page.',
      fix: 'Ask for each over https (most hosts serve both), or host the file on the site itself.',
    }, insecureItem(readable(pages))),
    ...headerFindings(report, pages),
    ...failedElsewhereFinding(report, pages),
    ...otherSiteLoadFinding(pages),
  ];
}

/**
 * A bot challenge's own requests (G-734): Cloudflare serves its challenge under `/cdn-cgi/challenge-platform/` on every host it
 * fronts, and part of it is made to fail for a browser without a token (a Private Access Token asked, 401) or to probe a name that
 * does not resolve. A normal step of the challenge, not a host a visitor finds failing: never one of SITE-35's hosts.
 */
// Decision: G-734
const CHALLENGE_PATH = '/cdn-cgi/challenge-platform/';
function withoutChallenge(p: CrawledPage): CrawledPage {
  const s = p.load?.failedElsewhere;
  if (!s) return p;
  const kept = s.first.filter((e) => !e.replace(/^[^/\s]+/, '').startsWith(CHALLENGE_PATH));
  if (kept.length === s.first.length) return p;
  const { failedElsewhere: _gone, ...rest } = p.load as PageLoad;
  return { ...p, load: kept.length ? { ...rest, failedElsewhere: { count: Math.max(kept.length, s.count - (s.first.length - kept.length)), first: kept } } : rest };
}

/**
 * SITE-35: the other sites' hosts whose data requests failed while the crawl read the pages (`load.failedElsewhere`, G-377),
 * minor and said as seen from the crawler's machine only (G-380). Where the crawl looked the names up (`site.failedHosts`),
 * each says whether the name resolves from here: "does not resolve" is stronger than "the request failed"; a lookup that
 * could not say is "could not check", never a claim. A host's name is the site's word: quoted (siteText), never part of a sentence.
 */
// Decision: G-380, G-734
function failedElsewhereFinding(report: CrawlReport, pages: CrawledPage[]): SiteFinding[] {
  const hosts = failedHostsOf({ pages: pages.map(withoutChallenge) });
  if (!hosts.length) return [];
  const looked = new Map((report.site?.failedHosts ?? []).map((h) => [h.host, h.resolves]));
  const checked = report.site?.failedHosts !== undefined;
  const names = (h: { host: string }) => {
    if (!checked || !looked.has(h.host)) return checked ? 'the name was not looked up' : '';
    const r = looked.get(h.host);
    return r === false ? 'the name does not resolve from here' : r === true ? 'the name resolves from here, so the request failed for another reason' : 'could not check whether the name resolves';
  };
  return [{
    code: 'SITE-35', severity: 'minor',
    listed: ['host', 'hosts'], // what each line is (G-666)
    title: `Requests to ${plural(hosts.length, 'host')} of other sites failed during the crawl, as seen from the crawler's machine and network`,
    where: hosts.map((h) => ({
      url: h.page,
      says: [`${siteText(h.host)}: ${plural(h.pages, 'page')} asked it for data and the request failed${h.why ? ` (${h.why})` : ''}`, names(h)].filter(Boolean).join('; '),
    })),
    why: `A script on the page asked another site's host for data (a third party's logging, analytics or a widget) and got an error or no answer. This was seen from the crawler's own machine and network only: an ad blocker, the region, DNS filtering or the crawler's own network can cause the same failure, and it may not fail for real visitors. The crawl cannot tell whether a page needs the answer. ${checked ? 'Where the crawl looked the name up from here, the line says so; "does not resolve" is stronger than "the request failed" (the host is probably gone), but it too is seen from here.' : 'The names were not looked up (--offline, or a crawl from before the lookup), so "failed" is all it can say.'} It stops no build and no test.`,
    fix: 'If a name does not resolve, the host is probably gone: remove its snippet or tag from the site. Otherwise open the page from an ordinary browser and network; if the request works there, there is nothing to fix.',
  }];
}

/**
 * SITE-38: pages whose load event had not fired when the crawl stopped waiting for it (`load.unfinished`, G-615). Not a measured
 * slowness (SITE-22 reads `loadMs`, which such a page has none of): some resource never finished, which one the crawl did not
 * prove, so the line names the hosts of the requests still pending when it could list them, by host only, each quoted (siteText)
 * and said to be the site's own host or another. Said as seen from the crawler's machine, whose own network can cause the same.
 */
// Decision: G-615
function unfinishedFinding(pages: CrawledPage[]): SiteFinding[] {
  const found = pages.filter((p) => p.load?.unfinished);
  if (!found.length) return [];
  const after = Math.max(...found.map((p) => p.load?.unfinished?.afterMs ?? 0));
  const said = (p: CrawledPage) => {
    const u = p.load?.unfinished;
    const hosts = (u?.hosts ?? []).map((h) => `${siteText(h.host)} (${h.own ? "the site's own host" : 'another host'})`);
    const left = hosts.length ? `still waiting for ${hosts.join(', ')}` : 'which requests were still pending was not recorded';
    return `the load event had not fired ${seconds(u?.afterMs ?? 0)} after the document was read; ${left}`;
  };
  return [{
    code: 'SITE-38', severity: 'minor',
    title: `${plural(found.length, 'page')} had not finished loading ${seconds(after)} after the document was read, as seen from the crawler's machine and network (the cause was not found)`,
    where: found.map((p) => ({ url: p.finalUrl, says: said(p) })),
    why: `The page's load event had not fired when the crawl stopped waiting for it (${seconds(after)} after the document was read), so some resource the page asked for had not finished: a script, a frame or a data request that never answered. The crawl read the page as it stood, so this is not a measured slow page, and the cause was not found: the hosts named are those of the requests still pending at that moment, which is not proof that one of them is at fault. This was seen from the crawler's own machine and network only: an ad blocker, a firewall, DNS filtering, the region or the crawler's own connection can hold a request open that answers real visitors at once. It stops no build and no test.`,
    fix: "Open the page from an ordinary browser and network with the developer tools' network tab: a request that stays pending there too is the one to fix, defer or remove (a tag manager or a third party's script is the usual cause). If every request finishes there, there is nothing to fix.",
  }];
}

/** SITE-22: pages slow to answer or to load, as the crawl measured them (no images, so a visitor waits longer). */
function slowFinding(pages: CrawledPage[]): SiteFinding[] {
  const slow = (l: PageLoad | undefined) => (l?.loadMs ?? 0) >= H.SLOW_PAGE_MS || (l?.firstByteMs ?? 0) >= H.SLOW_FIRST_BYTE_MS;
  const found = pages.filter((p) => slow(p.load)).sort((a, b) => (b.load?.loadMs ?? 0) - (a.load?.loadMs ?? 0));
  if (!found.length) return [];
  const slowest = found[0].load;
  return [{
    code: 'SITE-22', severity: 'major',
    title: `${plural(found.length, 'page')} ${found.length === 1 ? 'is' : 'are'} slow: the slowest took ${seconds(Math.max(slowest?.loadMs ?? 0, slowest?.firstByteMs ?? 0))}, without its images`,
    where: found.map((p) => ({ url: p.finalUrl, says: [p.load?.firstByteMs ? `first byte after ${seconds(p.load.firstByteMs)}` : '', p.load?.loadMs ? `loaded after ${seconds(p.load.loadMs)}` : ''].filter(Boolean).join(', ') })),
    why: 'Visitors leave a page that takes more than a few seconds, and search engines rank slow pages lower. The crawl fetches no images, fonts or video, so a visitor waits longer than this.',
    fix: 'A slow first byte is the server: cache the page, or find the slow query behind it. A slow load is what the page asks for: fewer and smaller scripts, deferred until needed.',
  }];
}

/**
 * A version in a header's value: a number that starts a word or follows a slash or a "v" (nginx/1.18.0, PHP/8.1, Apache 2.4,
 * v5). Not a digit inside a name: "AmazonS3" names no version (G-743 (4), SP4).
 */
const VERSION = /(?:^|[\s/(]|\bv)\d/i;

/** SITE-24 and SITE-25: what the site's own headers leave open, and what they announce; said once for the site. */
function headerFindings(report: CrawlReport, pages: CrawledPage[]): SiteFinding[] {
  const out: SiteFinding[] = [];
  const withHeaders = pages.filter((p) => p.load?.headers);
  const secure = report.origin.startsWith('https://');
  const start = pages.find((p) => p.url === report.startUrl) ?? pages[0];
  if (secure && start) {
    const sent = (h: string) => pages.some((p) => p.load?.headers?.[h] !== undefined);
    const frameGuard = pages.some((p) => p.load?.headers?.['x-frame-options'] !== undefined || /frame-ancestors/i.test(p.load?.headers?.['content-security-policy'] ?? ''));
    // [the header, what its absence leaves open, its item's key], in the order to add them: the fix names the first one missing,
    // never one already sent (G-666). Said after "no page of the site sends", so as what is open now, never what the header would
    // do (G-698). The item (G-749): the header on the start page, keyed by its name; the frame guard by X-Frame-Options.
    const missing = ([
      sent('strict-transport-security') ? null : ['Strict-Transport-Security', ' (without it, browsers are not told to keep to https)', 'strict-transport-security'],
      sent('content-security-policy') ? null : ['Content-Security-Policy', ' (without it, nothing limits which scripts a page may run)', 'content-security-policy'],
      frameGuard ? null : ['X-Frame-Options or frame-ancestors', ' (without it, another site can frame the page to trick a click)', 'x-frame-options'],
      sent('x-content-type-options') ? null : ['X-Content-Type-Options: nosniff', " (without it, a browser may guess a file's type from its content)", 'x-content-type-options'],
    ] as ([string, string, string] | null)[]).filter((m): m is [string, string, string] => m !== null);
    if (missing.length) {
      out.push({
        code: 'SITE-24', severity: 'minor',
        listed: ['missing header', 'missing headers'], // what each line is (G-666)
        title: `${plural(missing.length, 'security header')} no page sends`,
        where: missing.map(([header, does, key]) => ({ url: start.finalUrl, says: `no page of the site sends ${header}${does}`, item: { at: 'header' as const, key, url: start.finalUrl, header: key } })),
        why: 'Each header closes off one way the site could be misused (a downgrade to http, a script slipped in, the site framed in another to trick a click). A missing one is a weaker defence, not a sign the site has been attacked; security reviews ask for them, and each costs a line of server configuration.',
        fix: `Add the missing ${missing.length === 1 ? 'header' : 'headers'} in the web server or the CDN (one setting each)${missing.length > 1 ? `, starting with ${missing[0][0]}` : ''}.`,
      });
    }
  }
  // Each `header: value` said, the last page that said it, and the header (the item's key, G-749).
  const announced = new Map<string, [string, string]>();
  for (const p of withHeaders) {
    for (const h of ['server', 'x-powered-by']) {
      const v = p.load?.headers?.[h];
      if (v && VERSION.test(v)) announced.set(`${h}: ${v}`, [p.finalUrl, h]);
    }
  }
  if (announced.size) {
    out.push({
      code: 'SITE-25', severity: 'minor',
      listed: ['header', 'headers'], // what each line is (G-666)
      title: `The server says which software and version it runs (${[...announced.keys()].map((k) => k.split(': ')[1]).join(', ')})`,
      where: [...announced].map(([said, [url, header]]) => ({ url, says: said, item: { at: 'header' as const, key: header, url, header, value: said.slice(header.length + 2) } })),
      why: 'A version number tells an attacker which known holes to try, without having to look; it helps no visitor.',
      fix: 'Turn off the version in the server\'s configuration (nginx: server_tokens off; Apache: ServerTokens Prod; PHP: expose_php = Off). Behind a CDN or a storage service, the header is that service\'s: remove or rewrite it in the CDN\'s response headers.',
    });
  }
  return out;
}
