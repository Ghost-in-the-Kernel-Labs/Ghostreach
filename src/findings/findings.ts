/**
 * What is wrong with the site itself, found in the crawl before any suite is written (G-132): each
 * finding a stable code, how bad it is, the pages that show it, why it matters to the site's owner
 * and the likely fix. The build says them first and loudly; every suite lists them in KNOWN-ISSUES.md.
 * A finding never fails the build: it is the site's, not the tool's.
 */
import { H } from '../leaf/heuristics/suite.js';
import { siteText } from '../leaf/pages/site-text.js';
import type { CrawlReport, CrawledPage, ExternalAnswer } from '../leaf/report.js';
import { externalGone, externalUnconfirmed, onlyHidden, refusingHosts } from '../crawl/report-read.js';
import { brokenLinkFindings, CLOSED, CLOSED_WHY, downgradeFinding, itemFrom, lookAt, redirectFinding, splitClosed, throughTracker } from './link-findings.js';
import { isBrokenStatus } from './on-purpose.js';
import { addressItem } from './address-key.js';
import { pageFindings } from './page-findings.js';
import { mainHeading, titleFinding } from './title-finding.js';
import type { LinkLook, SiteFinding } from './types.js';
import { ranked } from './finding-order.js';

/** Words a site's own not-found page uses for its heading. */
const NOT_FOUND = /not found|404|doesn[’']?t exist|does not exist|no longer|can[’']?t be found|cannot be found|lost|oops|nothing here|went wrong|error/i;

/**
 * Pages that answered an error yet drew a page of their own: an app served through its error page
 * (a single-page app on a CDN whose error response sends the app with a 404). Each has a main heading
 * no other error page shares, that does not say "not found", and that no working page has; and there
 * are at least H.APP_PAGES_MIN of them.
 */
// Decision: G-132
export function appPagesUnderError(report: CrawlReport): CrawledPage[] {
  const errors = report.pages.filter((p) => isBrokenStatus(p) && p.fingerprint && !p.duplicateOf && !p.offSite);
  const working = new Set(report.pages.filter((p) => p.status !== null && p.status < 400).map(mainHeading).filter((h): h is string => h !== null));
  const count = new Map<string, number>();
  for (const p of errors) {
    const h = mainHeading(p);
    if (h) count.set(h, (count.get(h) ?? 0) + 1);
  }
  const own = errors.filter((p) => {
    const h = mainHeading(p);
    return h !== null && count.get(h) === 1 && !NOT_FOUND.test(h) && !working.has(h);
  });
  return own.length >= H.APP_PAGES_MIN ? own : [];
}

const path = (url: string) => new URL(url).pathname;

/**
 * The addresses that did not answer where another of the same kind did: a computer with no IPv6, or
 * behind a proxy that refuses direct connections, sees every address of a kind fail, and that is
 * its own network, not the site's.
 */
function deadAddresses(addresses: CrawlReport['addresses']): NonNullable<CrawlReport['addresses']> {
  const list = addresses ?? [];
  return list.filter((a) => !a.answered && list.some((b) => b.answered && b.family === a.family));
}


/** Every finding the crawl shows, the most serious first. */
// Decision: G-132
export function siteFindings(report: CrawlReport): SiteFinding[] {
  const app = appPagesUnderError(report);
  const appUrls = new Set(app.flatMap((p) => [p.url, p.finalUrl]));
  const out = [...appErrorFinding(report, app), ...brokenLinkFindings(report, appUrls), ...redirectFinding(report), ...downgradeFinding(report), ...goneExternalFinding(report), ...titleFinding(report, appUrls), ...deadAddressFinding(report), ...softNotFoundFinding(report), ...unansweredExternalFinding(report)];
  return rankFindings([...out, ...pageFindings(report)], report.origin);
}

/** SITE-01: pages that show real content but answer an error status: the site served through its error page. */
function appErrorFinding(report: CrawlReport, app: CrawledPage[]): SiteFinding[] {
  const out: SiteFinding[] = [];
  if (app.length) {
    const statuses = [...new Set(app.map((p) => p.status))].join(', ');
    out.push({
      code: 'SITE-01', severity: 'major',
      title: `${app.length} pages show real content but answer ${statuses}: the site is served through its error page`,
      where: app.map((p) => ({ url: p.finalUrl, says: `answered ${p.status}, drew ${siteText(String(mainHeading(p)))}`, link: lookAt(report, p, `answered ${p.status}`, p.status, 'answers an error yet draws a page'), item: addressItem(p.finalUrl, report.origin, p.status) })),
      why: 'A visitor sees each page, but search engines, link checkers and monitoring trust the status: they treat these pages as missing, so they may never appear in search results, and every check calls them broken.',
      fix: 'Serve each page with status 200: a single-page app behind a CDN usually needs its error response (the one that returns index.html) set to 200, or each route pre-rendered as its own file.',
    });
  }
  return out;
}

/** SITE-33's item (G-749 slice 5): the other site's address whole, what it answered, and the pages linking to it (path and query: itemFrom). */
const goneItem = (a: ExternalAnswer, from: string[]) => ({ at: 'address' as const, key: a.url, url: a.url, status: a.status, ...itemFrom(from) });

/** SITE-33: links to other sites that lead nowhere; those reached only from closed parts of the page apart, minor (G-737, G-742 (1)). */
function goneExternalFinding(report: CrawlReport): SiteFinding[] {
  // Links to other sites that are gone (G-241): a 404, a name that no longer resolves, nothing taking the connection (a timeout or a server error twice is SITE-39, G-655).
  // Not when this computer reached no other site at all (a proxy, a firewall): then none is known gone; nor offline (G-333), when none was asked.
  const gone = externalAsked(report).filter((a) => externalGone(a) && !isRefused(report, a));
  const [shown, closed] = splitClosed(gone, (a) => onlyHidden(report, a.url));
  return [...goneOf(report, shown, false), ...goneOf(report, closed, true)];
}

/** One SITE-33 finding of these gone addresses: major, or minor and said apart when each is reached only from a closed part of the page. */
function goneOf(report: CrawlReport, gone: ExternalAnswer[], closed: boolean): SiteFinding[] {
  if (!gone.length) return [];
  const one = gone.length === 1;
  const fate = 'meets an error page, or nothing at all, on someone else\'s site, reached from this one.';
  return [{
    code: 'SITE-33', severity: closed ? 'minor' : 'major',
    listed: ['link', 'links'], // what each line is (G-666)
    title: `${one ? '1 link to another site' : `${gone.length} links to other sites`}${closed ? ` ${CLOSED}` : ''} ${one ? 'leads' : 'lead'} nowhere: the page${one ? ' is' : 's are'} gone`,
    where: gone.map((a) => ({ url: a.url, says: `${externalSaid(a)}${externalLinking(report, a.url)}`, link: externalLook(report, a), item: goneItem(a, externalLinks(report, a.url)) })),
    why: closed ? `Sites move and close. ${CLOSED_WHY} Opened and followed, each ${fate}` : `Sites move and close: a visitor who follows one of these links ${fate}`,
    fix: 'Point each link at where the page lives now, or take it out. The suite\'s link report asks every one again on each run, and fails when one that answered stops.',
  }];
}

/** An address of a host that answered every address alike, its index too (G-743 (3)): unconfirmed, never gone. */
function isRefused(report: CrawlReport, a: ExternalAnswer): boolean {
  return externalGone(a) && URL.canParse(a.url) && refusingHosts(externalAsked(report)).has(new URL(a.url).hostname);
}

/** A refusing host's address, in words: what it answered, and that every one of its host did. */
function refusedSaid(report: CrawlReport, a: ExternalAnswer): string {
  const host = new URL(a.url).hostname;
  const asked = externalAsked(report).filter((b) => URL.canParse(b.url) && new URL(b.url).hostname === host).length;
  return `answered ${a.status}, as did every address of ${host} asked (${asked}), its index too: the host may refuse automated requests`;
}

/** The answers of other sites' addresses, none when this computer reached no other site (a proxy, a firewall) or none was asked (offline, G-333). */
function externalAsked(report: CrawlReport) {
  const ext = report.site?.external;
  return ext?.unreachable || ext?.offline ? [] : (ext?.answers ?? []);
}

/** "; linked from /, /news" for another site's address: the first five pages, and how many more. */
function externalLinking(report: CrawlReport, url: string): string {
  const from = externalFrom(report, url);
  const through = throughTracker(report.edges.filter((e) => e.external && e.to.replace(/#.*$/, '') === url));
  return from.length ? `; linked from ${from.slice(0, 5).join(', ')}${from.length > 5 ? ` and ${from.length - 5} more` : ''}${through}` : '';
}

/**
 * SITE-39: links to other sites that did not answer the crawler (a timeout or a server error, twice). Not said as gone:
 * many sites turn an automated visitor away like that. Info and unconfirmed, so it never leads the short audit, and it carries
 * no link to look at, so "Links that need a look" (which leads the audit) does not carry it either.
 */
// Decision: G-655, G-743, G-737
function unansweredExternalFinding(report: CrawlReport): SiteFinding[] {
  const quiet = externalAsked(report).filter(externalUnconfirmed);
  const refusing = externalAsked(report).filter((a) => isRefused(report, a));
  const all = [...quiet, ...refusing];
  if (!all.length) return [];
  const one = all.length === 1;
  // G-743 (3): a host that answered an error at every address, its index too, is said here, with what it answered.
  const what = [quiet.length ? 'did not answer the crawler' : '', refusing.length ? `answered an error on every address of ${one ? 'its' : 'their'} host` : ''].filter(Boolean).join(', or ');
  const because = quiet.length ? 'many sites block automated visitors' : 'the host may refuse automated requests';
  return [{
    code: 'SITE-39', severity: 'info', unconfirmed: true,
    listed: ['link', 'links'], // what each line is (G-666)
    title: `${one ? '1 link to another site' : `${all.length} links to other sites`} ${what}: unconfirmed (${because}); open ${one ? 'it' : 'each'} in a browser`,
    // G-737, G-742 (1): a link reached only from a closed part of the page says so; SITE-39 is info already, so no severity moves.
    where: all.map((a) => ({ url: a.url, says: `${isRefused(report, a) ? refusedSaid(report, a) : externalSaid(a)}${externalLinking(report, a.url)}${onlyHidden(report, a.url) ? `; only ${CLOSED}` : ''}` })),
    why: `Many sites block an automated visitor, or answer it slowly, while they answer a person: the crawler cannot tell a site that turned it away from one that is down, so this is not said as a fact.${refusing.length ? ' A host that answers the same error at every address asked, its index too, is more likely turning the crawler away than missing every page.' : ''}`,
    fix: 'Open each in a browser. If it does not load there either, point the link at where the page lives now, or take it out.',
  }];
}

/** SITE-06: addresses the site's name points to that do not answer, where another of the same kind does. */
function deadAddressFinding(report: CrawlReport): SiteFinding[] {
  const out: SiteFinding[] = [];
  const dead = deadAddresses(report.addresses);
  if (dead.length) {
    const host = new URL(report.origin).hostname;
    // Counted within each kind (IPv4, IPv6): a visitor is handed one of its kind (Ghost's spiralmm.xyz: 1 of the 5 IPv4, not 1 of 13).
    const kinds = ([4, 6] as const).filter((f) => dead.some((a) => a.family === f));
    const counted = kinds.map((f) => `${dead.filter((a) => a.family === f).length} of the ${(report.addresses ?? []).filter((a) => a.family === f).length} IPv${f}`).join(' and ');
    out.push({
      code: 'SITE-06', severity: 'major',
      listed: ['address', 'addresses'], // what each line is (G-666)
      title: `${counted} addresses ${host} points to ${dead.length === 1 ? 'does' : 'do'} not answer: visits, and the suite's tests, pass or fail by which address they are given (flaky)`,
      where: dead.map((a) => ({ url: report.origin, says: `${a.address} (IPv${a.family}): ${a.error ?? 'no answer'}; the others answered`, item: { at: 'ip' as const, key: a.address, host, ip: a.address, family: a.family } })),
      why: 'Each new visit picks one of the addresses. On one that does not answer, the page hangs and fails after a long wait. Chrome often tries the next address, so the site looks fine from a browser; scripts, some phones, monitoring and test tools do not. Which address a visit is given changes every few minutes, so the same test passes one run and fails or slows the next.',
      fix: "Remove the address that does not answer from the domain's DNS records (often a registrar's parking or redirect record left beside the hosting's), or make it serve the site.",
    });
  }
  return out;
}

/** SITE-05: an address that cannot exist answers as a page (a soft 404). */
function softNotFoundFinding(report: CrawlReport): SiteFinding[] {
  const out: SiteFinding[] = [];
  const nf = report.notFound;
  if (nf && nf.status !== null && nf.status < 300) {
    out.push({
      code: 'SITE-05', severity: 'minor',
      listed: ['address', 'addresses'], // what each line is (G-666)
      title: `An address that cannot exist answers ${nf.status}: missing pages look like pages`,
      where: [{ url: nf.url, says: `answered ${nf.status}`, item: addressItem(nf.url, report.origin, nf.status) }],
      why: 'Search engines index missing addresses as pages (a "soft 404"), and a link that breaks is never reported as broken.',
      fix: 'Answer 404 for an address the site has no page for, while still showing a friendly not-found message.',
    });
  }
  return out;
}

/** The findings, each marked when it is about another site, in the one order every place reads (finding-order.ts, G-668; TODO 135, M1). */
function rankFindings(all: SiteFinding[], origin: string): SiteFinding[] {
  return ranked(all.map((f) => markOffSite(f, origin)));
}

/**
 * A finding's lines whose address is on another site, marked: a writer then shows the address whole (scheme and host),
 * never only its path, which reads as the site's own (SITE-33's dead links to other sites; the foodsmart scan review).
 */
// Decision: G-455
function markOffSite(f: SiteFinding, origin: string): SiteFinding {
  const host = new URL(origin).hostname;
  return { ...f, where: f.where.map((w) => (new URL(w.url).hostname === host ? w : { ...w, offSite: true as const })) };
}

/** The pages of the site that link to another site's address, each once. */
function externalFrom(report: CrawlReport, url: string): string[] {
  return [...new Set(externalLinks(report, url).map(path))];
}

/** The addresses of the site's pages that link to another site's address, whole. */
const externalLinks = (report: CrawlReport, url: string): string[] => report.edges.filter((e) => e.external && e.to.replace(/#.*$/, '') === url).map((e) => e.from);

/** The same for a link to another site that is gone (SITE-33): no path of the site's own, so no team's list clears it. */
function externalLook(report: CrawlReport, a: ExternalAnswer): LinkLook {
  const from = externalFrom(report, a.url);
  return { paths: [], status: a.status, answer: externalSaid(a), from: from.slice(0, 5), more: Math.max(0, from.length - 5), why: 'broken' };
}

/** What another site's address answered, in words (G-241). */
function externalSaid(a: ExternalAnswer): string {
  const twice = a.again ? ', asked twice' : '';
  if (a.failed === 'no-such-name') return 'its name no longer resolves: the site is gone';
  if (a.failed === 'refused') return 'nothing takes the connection';
  if (a.failed === 'timeout') return `no answer in time${twice}`;
  if (a.failed) return `no answer${twice}`;
  return `answered ${a.status}${twice}`;
}
