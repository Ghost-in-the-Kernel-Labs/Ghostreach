/**
 * The site's own links that answer an error, redirect or leave https (G-132, G-240): the findings SITE-02, SITE-34, SITE-03 and
 * SITE-32, and how a link that answered an error is graded and handed to the list put before a person (links-to-look). Read by
 * findings.ts, which adds them to every other finding; nothing here reads another site's answers (those are SITE-33's, there).
 */
import { holdsSecret } from '../leaf/pages/saved-secrets.js';
import { openPath, roleOf, withoutRole } from '../leaf/pages/url.js';
import type { CrawlReport, CrawledPage } from '../leaf/report.js';
import { httpDowngrades, onlyHidden } from '../crawl/report-read.js';
import { keyOf } from './address-key.js';
import { redirectHops } from './markup-findings.js';
import { answeredOnPurpose, isBrokenStatus } from './on-purpose.js';
import { droppedQuery, queryDropOnly } from './query-dropped.js';
import { menuSaid } from './stale-menu.js';
import type { ItemEvidence } from './item-evidence.js';
import type { LinkLook, SiteFinding } from './types.js';

const path = (url: string) => new URL(url).pathname;
/**
 * The pages that link to an address, as its audit item names them (G-749, the linking check): each one's path and query, as the
 * crawl read it (a query names a page of its own: the linking check reading /list for /list?page=2 read a page that never linked,
 * Fable's second review), the first five and how many more. A page whose address holds a secret (a token in its query, G-410) is
 * never written into a suite: it is counted among the more, so the item stays open while it answers so (no page unread is taken
 * as no longer linking).
 */
// Decision: G-749
export function itemFrom(urls: string[]): { from: string[]; more: number } {
  const pages = [...new Set(urls.map((u) => `${new URL(u).pathname}${new URL(u).search}`))];
  const from = pages.filter((p) => !holdsSecret(p));
  return { from: from.slice(0, 5), more: Math.max(0, from.length - 5) + pages.length - from.length };
}
/** The item of a link that redirects (SITE-03, SITE-32): the address, the server's first status and where it ended; none for a script's move, which a re-check over HTTP cannot see. */
// Decision: G-749
function redirectItem(p: CrawledPage, origin: string): { item?: ItemEvidence } {
  const first = redirectHops(p)[0]?.status;
  return first !== undefined && first >= 300 && first < 400 ? { item: { at: 'address', key: keyOf(p.url, origin), url: withoutRole(p.url), status: first, to: p.finalUrl } } : {};
}
/** A page's redirects in a few words: the server's statuses (301, 302), or its own script's move. */
const redirectsSaid = (p: CrawledPage) => {
  const hops = redirectHops(p);
  return hops.every((r) => r.status === 0) ? 'moved by its own script' : hops.map((r) => (r.status === 0 ? 'its script' : r.status)).join(', ');
};

/**
 * The pages that link to a broken page, by any address that ends where it does (/gone and /gone?x, one missing
 * page): said once, the first address's links alone left out the others' (found writing its tests, 2026-10-16).
 */
function linkingTo(report: CrawlReport, broken: CrawledPage): string[] {
  return linksTo(report, broken).map((e) => e.from);
}

/** Every address that ends where a page does (/gone and /gone?x, one missing page). */
const addressesOf = (report: CrawlReport, page: CrawledPage) => new Set(report.pages.filter((q) => q.finalUrl === page.finalUrl).flatMap((q) => [q.url, q.finalUrl]));

/** The links to a broken page, by any address that ends where it does, from another page. */
function linksTo(report: CrawlReport, broken: CrawledPage) {
  const addresses = addressesOf(report, broken);
  return report.edges.filter((e) => addresses.has(e.to) && e.from !== broken.finalUrl);
}

/**
 * Words for a link reached only from parts of the page closed on arrival (G-737, G-742 (1); `onlyHidden`): said apart from
 * the links a visitor meets, as minor, and never as what "a visitor who follows one" meets. The crawl cannot tell an answer a
 * visitor opens from a menu never shown (stord.com's 18 broken links, all in a header menu hidden on arrival, 2026-11-11).
 */
export const CLOSED = 'in a closed part of the page';
/** Why a broken link in a closed part a visitor opens is major all the same (G-764). */
const CLOSED_OPENED_WHY = 'Each is linked only from a part of the page that is closed when it loads (a tab, an answer or a menu that opens on a click, a link shown on hover), on a page that shows a visitor what opens it: a closed part a visitor opens is as much the page as an open one.';
export const CLOSED_WHY = 'Each is linked only from a part of the page that is closed when it loads (a menu, a tab, an answer that opens on a click, a link shown on hover): the crawler cannot tell whether a visitor opens it, so these are said apart, and as minor.';

/** The controls a visitor opens a closed part of a page with: a tab, an expander (a summary), a button (a menu or an answer that opens on a click). */
const OPENERS = new Set(['tab', 'expander', 'button']);

/**
 * Whether a page carrying a closed link shows a visitor a control that opens a part of it (G-764): a tab, an expander or a
 * button, as the crawl recorded the page's controls. The crawl does not record which control opens which part, so a page
 * with one is taken as one a visitor opens; a page with none shows nothing that opens anything, and its closed links stay
 * said as the crawler cannot tell (minor).
 */
// Decision: G-764
function openedByAVisitor(report: Pick<CrawlReport, 'pages'>, from: readonly string[]): boolean {
  const at = new Set(from);
  return report.pages.some((p) => (at.has(p.url) || at.has(p.finalUrl)) && (p.controls ?? []).some((c) => OPENERS.has(c.kind)));
}

/** A finding's lines split: those of an address some page shows a link to, and those reached only from closed parts. */
export function splitClosed<T>(lines: T[], closed: (line: T) => boolean): [T[], T[]] {
  return [lines.filter((l) => !closed(l)), lines.filter(closed)];
}

/** ", through a tracker (cts.businesswire.com)" when a link among these went through one (G-656); "" otherwise. */
// Decision: G-656
export function throughTracker(edges: { via?: string }[]): string {
  const hostOf = (via: string) => URL.canParse(via) ? [new URL(via).hostname] : []; // a report is data: a via that is no address says nothing
  const hosts = [...new Set(edges.flatMap((e) => (e.via ? hostOf(e.via) : [])))];
  return hosts.length ? `, through a tracker (${hosts.join(', ')})` : '';
}

/**
 * A link that answered an error, or none, as a finding hands it to the list put before a person (item 71,
 * src/model/links-to-look.ts): what it answered, the first pages linking to it, and why it is there.
 */
export function lookAt(report: CrawlReport, page: CrawledPage, answer: string, status: number | null, why: string): LinkLook {
  const from = [...new Set(linkingTo(report, page).map(path))];
  return { paths: [...new Set([openPath(page.finalUrl), openPath(page.url)])], status, answer, from: from.slice(0, 5), more: Math.max(0, from.length - 5), why };
}

/** What an http:// address a link was sent to answered when asked after the crawl (G-240), in words; empty when it was not asked. */
function answerSaid(report: CrawlReport, url: string): string {
  const answer = report.site?.downgrades?.answers.find((a) => a.url === url);
  if (!answer) return report.site?.downgrades ? ' (not asked: past the first ones)' : '';
  return answer.status === null ? '; it gave no answer' : `; it answered ${answer.status}`;
}

/**
 * The links a redirect sent to the site's http:// address where that address answered an error when asked (G-240):
 * broken links like any other, said by the link the site wrote, with what answered.
 */
function brokenDowngrades(report: CrawlReport): { page: CrawledPage; status: number }[] {
  return httpDowngrades(report).flatMap((page) => {
    const status = report.site?.downgrades?.answers.find((a) => a.url === page.finalUrl)?.status;
    return status != null && isBrokenStatus({ status }) ? [{ page, status }] : [];
  });
}

/**
 * The pages the site links to that answered an error, each once (by its final address), told apart: a link whose own
 * words or address name the status it answers is `expected` with the reason, the rest are `broken`. The one place
 * a link is graded, for the link report (brokenLinksOf) and for the site finding (SITE-02, SITE-34); `appUrls`:
 * pages an app drew under an error status, a finding of their own (SITE-01).
 */
// Decision: G-132
function errorLinks(report: CrawlReport, appUrls: Set<string>): { broken: CrawledPage[]; expected: { page: CrawledPage; reason: string }[] } {
  const broken: CrawledPage[] = [];
  const expected: { page: CrawledPage; reason: string }[] = [];
  for (const p of report.pages) {
    if (!isBrokenStatus(p) || p.duplicateOf || appUrls.has(p.url) || [...broken, ...expected.map((e) => e.page)].some((q) => q.finalUrl === p.finalUrl)) continue;
    const reason = answeredOnPurpose(p.status, path(p.finalUrl), wordsOfLinksTo(report, p));
    if (reason) expected.push({ page: p, reason });
    else broken.push(p);
  }
  return { broken, expected };
}

/** What the links to a page say, by any address that ends where it does. */
function wordsOfLinksTo(report: CrawlReport, page: CrawledPage): string[] {
  const addresses = new Set(report.pages.filter((q) => q.finalUrl === page.finalUrl).flatMap((q) => [q.url, q.finalUrl]));
  return report.edges.flatMap((e) => (addresses.has(e.to) && e.text ? [e.text] : []));
}

/** How many pages link to a broken link's page: the first five named, and the rest counted. */
export const linkingPages = (l: LinkLook): number => l.from.length + l.more;

/** Broken links in the order an owner acts on them (G-668): those a menu carries first, then the most pages linking; else as read. */
// Decision: G-668
function leadingFirst<T extends { link: LinkLook }>(lines: T[]): T[] {
  return lines.map((w, i) => ({ w, i })).sort((a, b) => Number(!a.w.link.inMenu) - Number(!b.w.link.inMenu) || linkingPages(b.w.link) - linkingPages(a.w.link) || a.i - b.i).map((x) => x.w);
}

/** SITE-02 and SITE-34: links that answer an error, broken ones apart from those that answer one on purpose. */
export function brokenLinkFindings(report: CrawlReport, appUrls: Set<string>): SiteFinding[] {
  const out: SiteFinding[] = [];
  const { broken: brokenOnce, expected } = errorLinks(report, appUrls);
  const linkedFrom = (p: CrawledPage) => {
    const from = [...new Set(linkingTo(report, p).map(path))];
    return from.length ? `; linked from ${from.slice(0, 5).join(', ')}${from.length > 5 ? ` and ${from.length - 5} more` : ''}${throughTracker(linksTo(report, p))}` : '';
  };
  // A link sent to the site's http:// address that answered an error there is broken too (G-240).
  const brokenWhere = [
    // G-658: a link in a menu is named by its menu, and a stale menu by what most pages do; G-668: those lines first.
    ...leadingFirst(brokenOnce.map((p) => {
      const menu = menuSaid(report, linksTo(report, p));
      const link = lookAt(report, p, `answered ${p.status}`, p.status, menu ? `broken; ${menu}` : 'broken');
      const item: ItemEvidence = { at: 'address', key: keyOf(p.finalUrl, report.origin), url: withoutRole(p.finalUrl), status: p.status, ...itemFrom(linkingTo(report, p)) };
      const closed = onlyHidden(report, addressesOf(report, p));
      return { url: p.finalUrl, says: `answered ${p.status}${linkedFrom(p)}${menu ? `; ${menu}` : ''}`, link: menu ? { ...link, inMenu: true as const } : link, item, closed, opens: closed && openedByAVisitor(report, linksTo(report, p).map((e) => e.from)) };
    })),
    ...brokenDowngrades(report).map(({ page, status }) => {
      const answer = `sent to ${page.finalUrl}, which answered ${status}`;
      const link = lookAt(report, page, answer, status, 'broken');
      const item: ItemEvidence = { at: 'address', key: page.finalUrl, url: page.finalUrl, status, ...itemFrom(linkingTo(report, page)) };
      const closed = onlyHidden(report, page.url);
      return { url: page.url, says: `${answer}${linkedFrom(page)}`, link, item, closed, opens: closed && openedByAVisitor(report, linksTo(report, page).map((e) => e.from)) };
    }),
  ];
  // G-737, G-742 (1): a broken link reached only from closed parts of the page is said apart. G-764 (Ghost, 2026-11-12): major
  // when its page shows a control a visitor opens a part with, as an open one is; minor, with no visitor's sentence, when not.
  const [shownOrClosed, never] = splitClosed(brokenWhere, (w) => w.closed && !w.opens);
  const [shown, closed] = splitClosed(shownOrClosed, (w) => w.closed).map((ws) => ws.map(({ closed: _, opens: __, ...w }) => w));
  const unopened = never.map(({ closed: _, opens: __, ...w }) => w);
  const fix = 'Point each link at a page that exists, or bring the page back (or redirect its old address to where it went).';
  if (shown.length) {
    out.push({
      code: 'SITE-02', severity: 'major',
      listed: ['link', 'links'], // what each line is (G-666)
      title: shown.length === 1 ? '1 broken link: the site links to an address that answers an error' : `${shown.length} broken links: the site links to addresses that answer an error`,
      where: shown,
      why: 'A visitor who follows one of these links reaches an error instead of the page promised.',
      fix,
    });
  }
  if (closed.length) {
    out.push({
      code: 'SITE-02', severity: 'major',
      listed: ['link', 'links'],
      title: `${closed.length === 1 ? '1 broken link' : `${closed.length} broken links`} ${CLOSED}: the site links to ${closed.length === 1 ? 'an address that answers' : 'addresses that answer'} an error`,
      where: closed,
      why: `${CLOSED_OPENED_WHY} A visitor who opens it and follows one of these links reaches an error instead of the page promised.`,
      fix,
    });
  }
  if (unopened.length) {
    out.push({
      code: 'SITE-02', severity: 'minor',
      listed: ['link', 'links'],
      title: `${unopened.length === 1 ? '1 broken link' : `${unopened.length} broken links`} ${CLOSED}: the site links to ${unopened.length === 1 ? 'an address that answers' : 'addresses that answer'} an error`,
      where: unopened,
      why: `${CLOSED_WHY} No page that carries ${unopened.length === 1 ? 'it' : 'them'} shows a tab, an expander or a button. Opened and followed, each reaches an error instead of the page promised.`,
      fix,
    });
  }
  // Links that answer an error on purpose (a page showing what a 404 looks like) are no broken links: said apart, counting against nothing.
  if (expected.length) {
    out.push({
      code: 'SITE-34', severity: 'info',
      listed: ['link', 'links'], // what each line is (G-666)
      title: `${expected.length === 1 ? '1 link answers' : `${expected.length} links answer`} an error on purpose: ${expected.length === 1 ? 'its' : 'their'} own words or address name the status`,
      where: expected.map(({ page, reason }) => ({ url: page.finalUrl, says: `answered ${page.status}, expected: ${reason}${linkedFrom(page)}`, link: lookAt(report, page, `answered ${page.status}`, page.status, reason) })),
      why: 'A link that names the error it leads to (a page showing what a 404 or a 500 looks like) is the site working as designed, so it is listed apart and counts against the site in nothing.',
      fix: 'Nothing, unless a link is not meant to fail: then point it at a page that exists.',
    });
  }
  return out;
}

/** ", dropping ?hsLang=en" when the redirect only left out a query parameter the link had; "" otherwise. */
function droppedSaid(p: CrawledPage): string {
  if (!queryDropOnly(p.url, p.finalUrl)) return '';
  const names = droppedQuery(p.url, p.finalUrl);
  const from = new URL(p.url).searchParams;
  return `, dropping ?${names.map((n) => `${n}=${from.get(n)}`).join('&')}`;
}

/** SITE-03: the site's own links that redirect before they arrive; those reached only from closed parts of the page apart (G-737). */
export function redirectFinding(report: CrawlReport): SiteFinding[] {
  // A page signed in that sends its role elsewhere (/register to /secure) while the same address answers a
  // visitor is the site at work, not a link to fix: only one that redirects signed out too is the site's (G-183).
  const answersSignedOut = new Set(report.pages.filter((p) => roleOf(p.url) === null && !(p.redirects?.length ?? 0)).map((p) => p.url));
  const redirected = report.pages.filter((p) => p.url !== report.startUrl && !p.offSite && redirectHops(p).length > 0 && new URL(p.finalUrl).origin === report.origin && !(roleOf(p.url) !== null && answersSignedOut.has(withoutRole(p.url))));
  const [shown, closed] = splitClosed(redirected, (p) => onlyHidden(report, p.url));
  return [...redirectsOf(shown, '', report.origin), ...redirectsOf(closed, ` ${CLOSED}`, report.origin)];
}

/** One SITE-03 finding of these redirected pages; `where`, " in a closed part of the page" for those reached only from one. */
function redirectsOf(redirected: CrawledPage[], where: string, origin: string): SiteFinding[] {
  if (!redirected.length) return [];
  const slashOnly = redirected.every((p) => p.finalUrl === `${p.url}/` || `${p.finalUrl}/` === p.url);
  // G-743 (4), I8: a redirect that only drops a query parameter (HubSpot's ?hsLang=en) is said so, not as a trailing slash.
  const queryOnly = !slashOnly && redirected.every((p) => queryDropOnly(p.url, p.finalUrl));
  const dropped = [...new Set(redirected.filter((p) => queryDropOnly(p.url, p.finalUrl)).flatMap((p) => droppedQuery(p.url, p.finalUrl)))];
  const each = redirected.length === 1 ? 'only' : 'each only';
  return [{
    code: 'SITE-03', severity: 'minor',
    listed: ['link', 'links'], // what each line is (G-666)
    title: `${redirected.length === 1 ? "1 of the site's own links" : `${redirected.length} of the site's own links`}${where} ${redirected.length === 1 ? 'redirects' : 'redirect'} before ${redirected.length === 1 ? 'it arrives' : 'they arrive'}${slashOnly ? ` (${each} to add or drop a trailing slash)` : queryOnly ? ` (${each} to drop a query parameter)` : ''}`,
    where: redirected.map((p) => ({ url: p.url, says: `${redirectsSaid(p)} to ${path(p.finalUrl)}${droppedSaid(p)}${roleOf(p.url) === null ? '' : ` (signed in as ${roleOf(p.url)})`}`, ...redirectItem(p, origin) })),
    why: `${where ? `${CLOSED_WHY} ` : ''}Every click on one of these links costs an extra round trip before the page starts loading, and search engines see one page at two addresses.`,
    fix: `Link to each page's final address${dropped.length ? '' : ' (with or without its trailing slash, as the server serves it)'}.${dropped.length ? ` Where the redirect only drops a query parameter (${dropped.join(', ')}), link without it: a site builder often adds it to every link (a language switcher), and its setting can stop that.` : ''}`,
  }];
}

/** SITE-32: the site's own links that send visitors from https down to http. */
export function downgradeFinding(report: CrawlReport): SiteFinding[] {
  const out: SiteFinding[] = [];
  // Links that send a visitor from the https site down to its own http:// address (G-240).
  const downgraded = httpDowngrades(report);
  if (downgraded.length) {
    out.push({
      code: 'SITE-32', severity: 'major',
      listed: ['link', 'links'], // what each line is (G-666)
      title: `${downgraded.length === 1 ? "1 of the site's own links sends" : `${downgraded.length} of the site's own links send`} visitors from https to http: the page${downgraded.length === 1 ? ' arrives' : 's arrive'} unencrypted`,
      where: downgraded.map((p) => ({ url: p.url, says: `${redirectHops(p).map((r) => r.status).join(', ') || 'redirects'} to ${p.finalUrl}${answerSaid(report, p.finalUrl)}`, ...redirectItem(p, report.origin) })),
      why: 'On http, what a visitor sends and reads can be seen and changed on the way; browsers mark the page "Not secure", and some refuse a form on it. The suite cannot test these pages either: the crawl keeps to the site\'s https address, so it read none of them.',
      fix: 'Redirect each to its https:// address (most often a rule that builds the redirect from the request\'s own scheme, or a proxy that does not pass it on).',
    });
  }
  return out;
}
