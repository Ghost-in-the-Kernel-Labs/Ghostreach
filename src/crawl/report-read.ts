/**
 * What is read from a crawl report (report.ts holds its types): a saved report read and checked, the
 * pages a redirect sent to the site's http:// address, the headings a visitor sees, pages at two addresses,
 * whether another site's address is gone, and which links a visitor sees on arrival.
 */
import { markCredentialsIn } from './credentials-entry.js';
import { asWritten } from './report-held.js';
import { type CrawledPage, type CrawlReport, type ExternalAnswer, type LinkEdge, type ProviderSignIn, REPORT_VERSION } from '../leaf/report.js';

/**
 * The pages a redirect sent from the https site to its own http:// address (quotes.toscrape.com's 50 author
 * pages, 2026-10-16): not read, the crawl keeping to the site's own origin, so said as the site's pages left
 * unread and as a finding, never only as "off the site" (G-240).
 */
// Decision: G-240
export function httpDowngrades(report: { pages: readonly CrawledPage[]; origin: string }): CrawledPage[] {
  const site = new URL(report.origin);
  if (site.protocol !== 'https:') return [];
  return report.pages.filter((p) => {
    if (!p.offSite) return false;
    const to = new URL(p.finalUrl);
    return to.protocol === 'http:' && to.hostname === site.hostname;
  });
}

/**
 * The headings a visitor sees: what pages are compared by. Hidden menus and cookie banners are the
 * same on every page, so counting them makes unrelated pages look alike.
 */
// Decision: G-012
export function seenHeadings(page: Pick<CrawledPage, 'headings' | 'skippedHeadings'>): string[] | undefined {
  if (!page.headings || !page.skippedHeadings) return page.headings;
  const skipped = new Set(page.skippedHeadings);
  return page.headings.filter((h) => !skipped.has(h));
}

/**
 * The links a visitor sees on arrival: those not `hidden` (G-737). On an edge `hidden` means "not shown when the page loads"
 * (a closed menu, a tab, an FAQ answer that opens on a click, a link shown on hover), not "never seen": rtafleet.com's 3898
 * hidden links carried 3 triggers. A finding that says what a visitor meets reads links through this, never `hidden` itself.
 */
// Decision: G-737
export function shownEdges<E extends Pick<LinkEdge, 'hidden'>>(edges: readonly E[]): E[] {
  return edges.filter((e) => !e.hidden);
}

/**
 * Whether an address is reached only from parts of the page closed on arrival: some page links to it (at any of `to`, a
 * link's #part aside, from a page other than itself), no link to it is shown, and none is in a dropdown the crawler opened
 * from a control a visitor sees (`trigger`: a menu's "Product" button, whose stale link leads the audit, G-668) (G-737,
 * G-742 (1)). A link no page carries (the start page, an address from the sitemap) is not: nothing says it is hidden. Such a
 * link is said apart, minor, "in a closed part of the page": without a trigger the crawl cannot tell an answer a visitor
 * opens from a menu never shown (stord.com's header links of 2026-11-11 carry none).
 */
// Decision: G-737, G-742
export function onlyHidden(report: Pick<CrawlReport, 'edges'>, to: string | Iterable<string>): boolean {
  const at = new Set(typeof to === 'string' ? [to] : to);
  const links = report.edges.filter((e) => at.has(e.to.replace(/#.*$/, '')) && !at.has(e.from));
  return links.length > 0 && shownEdges(links).length === 0 && !links.some((e) => e.trigger);
}

/**
 * The same page at two addresses the crawl's rules can't tell apart: same title, same headings, same
 * shape. Recorded (and still read), so it can be seen and set right. `firstWith` gives the first page read with a
 * content, and records this one as the first when there was none (state.ts, firstWithContent).
 */
export function noteSameContent(firstWith: (content: string, url: string) => string | undefined, entry: CrawledPage, headings: string[], log: (message: string) => void): void {
  if (!entry.title || headings.length === 0) return;
  const content = JSON.stringify([entry.title, headings, entry.fingerprint]);
  const first = firstWith(content, entry.finalUrl);
  if (first !== undefined) {
    entry.sameContentAs = first;
    log(`  same content as ${first}`);
  }
}

/**
 * The crawl summary's "Same page at two addresses" line, or null when there is nothing to say: pages
 * the crawl's rules could not tell apart, with no redirect or canonical link to say so. A page that
 * answered an error is left out, on either side: a site's not-found page is the same at every address
 * that fails, and those are reported as broken links already (seen on site-b.example, 2026-09-30).
 */
export function sameContentLine(report: Pick<CrawlReport, 'pages'>): string | null {
  const failed = new Set(report.pages.filter((p) => p.status !== null && p.status >= 400).map((p) => p.finalUrl));
  const twins = report.pages.filter((p) => p.sameContentAs && !failed.has(p.finalUrl) && !failed.has(p.sameContentAs));
  if (!twins.length) return null;
  const path = (u: string) => new URL(u).pathname + new URL(u).search;
  const named = twins.slice(0, 5).map((p) => `${path(p.finalUrl)} = ${path(p.sameContentAs ?? '')}`).join(', ');
  return `Same page at two addresses (no redirect or canonical link says so): ${named}${twins.length > 5 ? `, and ${twins.length - 5} more` : ''}`;
}

/**
 * A crawl report read from a file's text, checked: made by Suite Builder, with pages and links, in
 * a format version this Suite Builder reads (every older one: versions 2 and 3 only added optional
 * fields). Throws an Error saying what is wrong, in words for the person who ran the command. `text`
 * may be a function reading the file, so a missing file is reported the same way.
 */
// Decision: G-012
export function readCrawlReport(text: string | (() => string), file: string): CrawlReport {
  let report: Partial<CrawlReport>;
  try {
    report = JSON.parse(typeof text === 'function' ? text() : text) as Partial<CrawlReport>;
  } catch (e) {
    throw new Error(`Could not read a crawl report from ${file}: ${e instanceof Error ? e.message : e}`);
  }
  if (report?.tool !== 'suite-builder' || !Array.isArray(report.pages) || !Array.isArray(report.edges)) {
    throw new Error(`${file} is not a crawl report.`);
  }
  if (typeof report.reportVersion !== 'number' || report.reportVersion > REPORT_VERSION) {
    throw new Error(
      `${file} was made by a newer Suite Builder (report version ${report.reportVersion}; this one reads up to ${REPORT_VERSION}). Update Suite Builder, or crawl the site again with this one.`,
    );
  }
  // A crawl taken before a credential was marked still gives none to the suite built from it (TODO 89).
  for (const page of report.pages) markCredentialsIn(page);
  // One written before G-480 (or by hand) gives no token, key or signed-in person to what is made of it: masked as written.
  return asWritten(report as CrawlReport);
}


/**
 * Whether another site's address is gone (G-241, G-655): it answered 404 or 410, its name no longer resolves or nothing
 * takes the connection. A server error or a timeout twice is not gone but unconfirmed (`externalUnconfirmed`): many sites
 * turn an automated visitor away that way. Anything else is a site at work: an answer, a redirect to one, or a refusal of
 * a test tool (401, 403, 429, LinkedIn's 999), which is the site alive.
 */
// Decision: G-241, G-655
export function externalGone(a: Pick<ExternalAnswer, 'status' | 'failed' | 'again'>): boolean {
  if (a.status === 404 || a.status === 410) return true;
  return a.failed === 'no-such-name' || a.failed === 'refused';
}

/**
 * The other sites' hosts that answered the crawler the same 404 or 410 at every address asked of them, their index too: an
 * address shallower than another of the host's (a job board's listing beside its postings). A host that is gone page by page
 * keeps its index; one that answers every address alike, the index too, is as likely turning an automated visitor away
 * (G-743 (3)): said unconfirmed, never "gone". Postings alone of one depth that all answer 404 are gone, as before.
 */
// Decision: G-743
export function refusingHosts(answers: Pick<ExternalAnswer, 'url' | 'status' | 'failed'>[]): Set<string> {
  const byHost = new Map<string, Pick<ExternalAnswer, 'url' | 'status' | 'failed'>[]>();
  for (const a of answers) {
    if (!URL.canParse(a.url)) continue; // a report is data
    const host = new URL(a.url).hostname;
    byHost.set(host, [...(byHost.get(host) ?? []), a]);
  }
  const depth = (url: string) => new URL(url).pathname.split('/').filter(Boolean).length;
  const out = new Set<string>();
  for (const [host, asked] of byHost) {
    const status = asked[0].status;
    if ((status !== 404 && status !== 410) || asked.some((a) => a.status !== status)) continue;
    const depths = asked.map((a) => depth(a.url));
    if (Math.min(...depths) < Math.max(...depths)) out.add(host);
  }
  return out;
}

/** Whether another site's address did not answer the crawler, twice: a server error or a timeout, which says nothing sure of the site (G-655). */
// Decision: G-655
export function externalUnconfirmed(a: Pick<ExternalAnswer, 'status' | 'failed' | 'again'>): boolean {
  return Boolean(a.again) && askAgain(a);
}

/** A server error or a timeout: asked a second time before it is called gone (G-241). */
export const askAgain = (a: Pick<ExternalAnswer, 'status' | 'failed'>) => (a.status !== null && a.status >= 500 && a.status <= 599) || a.failed === 'timeout';

/** Each provider once, with the pages it is on: "Fixture ID at /login, Google at /login and /join". */
export function providerList(providers: ProviderSignIn[]): string {
  const pages = new Map<string, string[]>();
  for (const p of providers) pages.set(p.provider, [...(pages.get(p.provider) ?? []), new URL(p.page).pathname]);
  return [...pages].map(([provider, at]) => `${provider} at ${[...new Set(at)].join(' and ')}`).join(', ');
}
