/**
 * The crawl report: everything later steps (template grouping, inventory, code generation) need
 * to know about the site, as plain JSON.
 *
 * It is deterministic: crawling an unchanged site twice gives byte-identical JSON. There are no
 * timestamps or durations in it (the CLI prints those), and every list is in crawl order or in
 * the order links were found.
 */
import type { Fingerprint } from './pages/fingerprint.js';
import type { BrowserControl, GuardForm, LoginForm, MenuTrigger, PageAnchor, PageControl, PageFrame, PageLoad, PageMarkup, ProviderSignIn } from './report-page.js';
export type { BrowserControl, FoundLoginForm, LoginForm, MenuTrigger, PageAnchor, PageControl, PageFrame, PageLoad, PageMarkup, ProviderSignIn, Sample, SoftwareWords } from './report-page.js';

/**
 * The report's format version (docs/CRAWL-FORMAT.md). Bumped by any change to the format, with a
 * line in that document's history saying what changed and how older reports are read.
 */
export const REPORT_VERSION = 6;

/** The name a robots.txt addresses the crawler by (in its user agent too). */
export const PRODUCT_TOKEN = 'SuiteBuilder';

export type StopReason =
  /** Every reachable page was crawled. */
  | 'complete'
  /** The page limit was reached with pages still queued. */
  | 'page-limit'
  /** Several requests in a row failed (network error or 5xx), so the crawler backed off. */
  | 'too-many-errors'
  /** The site answered 429 Too Many Requests. */
  | 'rate-limited'
  /** Pages in a row taught nothing new (a new shape or address pattern): the rest is more of the same. */
  | 'saturated'
  /** A short audit (suite audit --short, G-142) found what it looked for: the first few things wrong. */
  | 'found-enough'
  /** A signed-in crawl was led back to its sign-in form: the site ended the session (G-157). */
  | 'session-lost';

export type NotCrawledReason =
  /** robots.txt disallows it for this crawler. */
  | 'robots'
  /** Outside the --include paths, or inside an --exclude path. */
  | 'out-of-scope'
  /** The same path as a page already found, with a different query string (?show=2, ?page=3). */
  | 'query-variant'
  /** A file type that is downloaded, not browsed (PDF, image, archive). */
  | 'not-html'
  /** A sign-in, sign-out or account page: the crawl reads public pages only. */
  | 'sign-in'
  /** A link that does something when opened (adds to a cart): never followed, so the crawl leaves the site as it found it (G-170). */
  | 'action'
  /** The same site in another language (/fr/ when the crawl started in /en/). */
  | 'other-language'
  /** It gave no answer, twice (a timeout or a dropped connection): no page type, no test (G-200). */
  | 'unread'
  /** Its URL pattern already gave enough pages of the same shape (e.g. the 4th Pokémon page); never a page of the site's menu (G-741). */
  | 'enough-samples'
  /** A part of a page a script loads into it (no document around it: no doctype, html, head, body, title or frameset), not a page (G-377). */
  | 'page-part'
  /** Discovered, but the page limit was reached first. */
  | 'page-limit'
  /** Discovered, but the crawl stopped early (errors, rate limiting, or a saturated stop before a page of its kind or menu page was read, G-741). */
  | 'stopped';

export interface RedirectHop {
  url: string;
  /** The HTTP status (301, 302...); 0 when the page's own script moved it (a client-side redirect). */
  status: number;
}

export interface CrawledPage {
  /** The URL the crawler asked for (normalized: absolute, no #fragment). */
  url: string;
  /** Where the browser ended up after redirects. */
  finalUrl: string;
  /**
   * HTTP status of the final response. Null when there is none: the request failed, or the
   * crawler stopped at a redirect (off-site, disallowed by robots.txt, or to a page it already read).
   */
  status: number | null;
  /** Redirects followed on the way, in order. Empty when there were none. */
  redirects: RedirectHop[];
  title: string;
  contentType: string | null;
  /** Link hops from the start page (along the path the crawler found it). */
  depth: number;
  /** Null for failed requests, non-HTML responses and duplicates. */
  fingerprint: Fingerprint | null;
  /**
   * Texts of headings, table headers, labels, legends, captions and dt elements, in page order,
   * each once (at most 150, each at most 80 characters). Absent when the page was not read.
   */
  headings?: string[];
  /**
   * Those of `headings` a visitor does not see on arrival: hidden (a closed menu, a cookie
   * preference centre) or inside a cookie/consent banner. Fine for telling pages apart, useless as
   * checks that a page has loaded. Absent when there are none.
   */
  skippedHeadings?: string[];
  /**
   * What proves the page loaded whatever its words say (readers/structure.ts): the texts of the main
   * headings (h1) a visitor sees on arrival, at most 80 characters each, consent banners left out;
   * and whether it shows a main region (<main>, role="main"). Optional in version 5.
   */
  structure?: { h1: string[]; main: boolean };
  /**
   * The controls a visitor can use on arrival (buttons, fields, dropdowns), with the words a person
   * calls them by and a locator checked to match exactly that one element here. Absent when none.
   */
  controls?: PageControl[];
  /** Under --sec only (item 107): the page's forms that hold a recorded control, where and how each sends (`GuardForm`). Absent when none, or not asked. */
  forms?: GuardForm[];
  /**
   * The page's links and controls as the browser itself lists them (readers/seen.ts), each role and name
   * once, at most 300: what the crawl's readers are checked against, so what they did not read is said
   * (src/group/unread.ts). Absent when the browser would not say, and in reports before 2026-10-11.
   */
  seen?: BrowserControl[];
  /**
   * The browser's list was not whole, so what the readers missed on this page is not fully known (the
   * reviews of 2026-10-11): `failed`, the browser would not say (an error, or no answer in 5 s), and `seen`
   * is absent; `cut`, it listed more than SEEN_MAX, and `left` entries were not kept. Absent when the list
   * was whole, and in reports before 2026-10-11.
   */
  seenIncomplete?: { why: 'failed' | 'cut'; left?: number };
  /**
   * How many of the page's links were past H.LINKS_PER_PAGE_MAX, so neither recorded nor followed (Fable's
   * review, C2). Absent when every link was kept, and in reports before 2026-10-12.
   */
  linksLeft?: number;
  /** Its in-page anchors (TODO 111; docs/CRAWL-FORMAT.md): each link to a part of this page. Absent when none, and before 2026-11-13. */
  anchors?: PageAnchor[];
  /**
   * Set when a redirect (the server's or the page's own script), or the page's canonical address
   * for the same path, led to a page already crawled. The page is not read again.
   */
  duplicateOf?: string;
  /** The page's <link rel="canonical">, when it names another address. */
  canonical?: string;
  /**
   * An earlier page with the same title, headings and shape: most likely one page at two addresses
   * that no redirect or canonical link says are one. Read anyway; recorded so it can be looked at.
   */
  sameContentAs?: string;
  /**
   * What a second visit, in a fresh browser, read differently (second-look.ts): the headings a
   * visitor saw that time. Absent when the page wasn't looked at again, or read the same.
   */
  secondLook?: { headings: string[] };
  /**
   * The second look's watch for what a page draws after it has settled (readers/late.ts, TODO 38): it watched
   * the page `afterMs` more and asked the browser again. `seen`: the links and controls the browser listed
   * only then (empty: nothing appeared), each one no reader recorded with where it lives; `controls`: those
   * of them the controls reader could read then, which the first visit did not record; `left`: entries past
   * SEEN_MAX on either list, so what appeared is not wholly known (ChatGPT's fourth audit, 2). Absent when
   * the page was not watched (the second look watches at most SECOND_LOOK_MAX_PAGES, two of a family; none
   * when the crawl did not wait for pages), and in reports before 2026-10-12.
   */
  late?: { afterMs: number; seen: BrowserControl[]; controls?: PageControl[]; left?: number };
  /** Set when a redirect leads off the site; the other site is not requested. */
  offSite?: true;
  /**
   * The page's frames, outermost first, each with its frame path (docs/FRAMES-PLAN.md). Absent when
   * the page has none. Since report version 5.
   */
  frames?: PageFrame[];
  /**
   * How the page settled before it was read (src/crawl/settle.ts): how long the waits took, to the
   * nearest 100 ms, and whether the network and the page went quiet within them. Since version 5.
   */
  settled?: { ms: number; networkQuiet: boolean; domQuiet: boolean };
  /**
   * What its markup says to a phone, a screen reader and a search engine (readers/markup.ts), for
   * the audit (docs/AUDIT-RESEARCH.md). Absent in reports before 2026-10-05.
   */
  markup?: PageMarkup;
  /** What its load showed beyond the page itself (load-watch.ts), for the audit. Absent in reports before 2026-10-05. */
  load?: PageLoad;
/**
   * What some of the crawl's readers could not read on a page it did load, each reader's reason once (Fable's
   * review of 2026-10-11, B3): most often a page that navigated itself mid-read. What the others read is kept.
   * Absent when every reader finished, and in reports before 2026-10-11.
   */
  readerErrors?: string[];
    error?: string;
}

export interface LinkEdge {
  /** The page the link is on (its final URL). */
  from: string;
  /** Where the link points (normalized). */
  to: string;
  /** The href attribute as written in the page, e.g. /pokedex/bulbasaur. */
  href: string;
  /** Visible text, or aria-label / title / image alt text when there is none. At most 80 characters. */
  text: string;
  /** Points to another site. External links are recorded but never followed. */
  external: boolean;
  /** Where the link sits: header or nav, footer, or a cookie banner. Absent: in the page itself. */
  region?: 'header' | 'footer' | 'banner';
  /** Not visible as the page loaded: inside a closed hover menu, say. */
  hidden?: true;
  /** For a hidden link: the control that opens its dropdown, when the crawler could tell. */
  trigger?: MenuTrigger;
  /**
   * Inside the dropdown `trigger` opens, what opens the part the link is in, outermost first: a mega
   * menu's category ("Data & AI") whose sub-panel holds the link. Absent when the link shows as
   * soon as the dropdown opens.
   */
  innerTriggers?: MenuTrigger[];
  /** Opens in a new tab (target="_blank"). */
  newTab?: true;
  /** The click tracker the link goes through (its address as written), when `to` was read from it (G-656, src/crawl/trackers.ts). */
  via?: string;
}

export interface CrawlReport {
  tool: 'suite-builder';
  reportVersion: number;
  startUrl: string;
  origin: string;
  options: {
    /** null: no limit (--long). */
    maxPages: number | null;
    delayMs: number;
    userAgent: string;
    maxConsecutiveErrors: number;
    include: string[];
    exclude: string[];
    /** True when --all-languages turned off staying in the start page's language. */
    allLanguages?: boolean;
    /** True when --offline kept the crawl to the site under test (G-333); a build that did not ask for it does not reuse such a crawl. */
    offline?: true;
    /** True when --sec read the page's own guards (item 107, G-733): a page's `forms` and a field's `limits`, `pattern`, `autocomplete`, `inputMode`. Absent: never read, so an absent one says nothing of the site. */
    sec?: true;
  };
  /** Which build of the tool crawled (src/version.ts); absent when it ran from its source. */
  build?: { commit: string; branch: string; dirty?: true };
  /** True when requests to ad hosts were refused, as the suites refuse them (G-095); absent in crawls before it. */
  adsBlocked?: true;
  robots: {
    url: string;
    status: number | null;
    source: 'parsed' | 'none' | 'unreachable';
    crawlDelaySeconds: number | null;
    /** Why robots.txt could not be fetched at all (usually: the site could not be reached). */
    error?: string;
    /**
     * 'incomplete' when, as seen from the crawler's machine (a TLS-intercepting proxy there can cause it too), the server does not send its intermediate certificate: Node's TLS refused the site, a browser repairs it,
     * so robots.txt (and only it) was read once more with relaxed checking (G-609). Absent otherwise, and in crawls before it.
     */
    certificateChain?: 'incomplete';
  };
  /**
   * The site's answer to one address that cannot exist (notFoundPath), asked once by HTTP after the
   * last page (not when the site asked the crawl to stop), redirects followed: a site that says 404 to it can be tested to keep saying so.
   * `status` is null when it could not be asked; absent when robots.txt disallows it, and in
   * crawls before it.
   */
  notFound?: { url: string; status: number | null };
  /** What the site says of itself, asked once after the crawl (G-202); absent when not asked, and before 2026-10-05. */
  site?: SiteProbe;
  /**
   * Every address the site's name pointed to, each tried once for a connection as the crawl started
   * (src/crawl/addresses.ts, G-139). Absent for a site given by IP address, and in crawls before it.
   */
  addresses?: { address: string; family: 4 | 6; answered: boolean; error?: string }[];
  /**
   * The start page's language, when the site has others. `prefix` is its locale segment (/en/),
   * or null when the start page has none; `others` are the locale segments treated as other
   * languages (links there are not crawled), and the language folders below the top level a page
   * of confirmed (blog/de, G-754). Absent for single-language sites.
   */
  language?: { prefix: string | null; lang: string | null; others: string[] };
  /**
   * A cookie/consent banner's accept button seen during the crawl (never clicked by the crawler),
   * as a Playwright selector. Generated tests click it when it gets in the way.
   */
  consent?: { selector: string; page: string };
  stopReason: StopReason;
  /**
   * Why the crawl failed as a whole, when it did (G-200): H.MAX_CONSECUTIVE_ERRORS pages in a row gave no
   * answer. Nothing is built from a failed crawl; its report is kept for a look. Absent otherwise.
   */
  failed?: string;
  /** The page numbers where something new was met (src/crawl/discovery.ts): the last shows how far a crawl had to go. */
  discovery?: { newAt: number[] };
  pages: CrawledPage[];
  edges: LinkEdge[];
  notCrawled: { url: string; reason: NotCrawledReason }[];
  /**
   * How many more addresses were not crawled past H.NOT_CRAWLED_MAX rows, so not listed (Fable's review, C2).
   * Absent when every one is listed, and in reports before 2026-10-12.
   */
  notCrawledLeft?: number;
  /** The sign-in forms found, none sent; absent when there were none, and before version 6. */
  loginForms?: LoginForm[];
  /** The sign-ins by another site found (G-261), never followed. Absent when there were none. */
  providerSignIns?: ProviderSignIn[];
  /**
   * Each sign-in tried for a crawl behind a login (`suite crawl --login`, G-157): the role, the form's
   * page, whether it worked, and why not. Never what was typed. Absent when none was tried. `session` (optional):
   * signed in by a saved session (G-264), the provider it was made with; `url` is then where it landed.
   */
  signIns?: { role: string; url: string; ok: boolean; why?: string; session?: string }[];
  /**
   * The pages a role read just as a visitor does, marked with the role (/tips#as=user): dropped from
   * `pages`, kept once as public (G-161), and said here so a rebuild knows they were read (G-179).
   * Absent when there were none.
   */
  asPublic?: string[];
}

/** What the site says of itself, asked once after the crawl (src/crawl/site-probe.ts, G-202). */
export interface SiteProbe {
  /** An https site's certificate: the day it ends, the days left when read, the names it covers, whether one is the site's, whether a browser trusts it. */
  certificate?: { validTo: string; daysLeft: number; names: string[]; matches: boolean; trusted: boolean; why?: string };
  /** An https site's http address, asked without following: its status, and where it sends a visitor. */
  http?: { url: string; status: number | null; to?: string };
  /** Its other name, www or not, asked without following, when it answers at all: its status, and where it sends a visitor (G-204). */
  twin?: { url: string; status: number | null; to?: string };
  /** Its sitemap (robots.txt's Sitemap line, else /sitemap.xml): its status, how many addresses it lists (an index lists sitemaps), and the first it lists that the crawl found broken or moved. */
  sitemap?: { url: string; status: number | null; listed?: number; index?: true; broken?: string[]; moved?: string[]; notAsked?: { url: string; why: string } };
  /** /.well-known/security.txt: its status, and noContact when it answers without a Contact line. */
  securityTxt?: { url: string; status: number | null; noContact?: true };
  /**
   * The images the pages showed a visitor, each asked once after the crawl (G-203): how many were `seen` (shown on a page; before
   * 2026-11-11, requested), how many asked, and the broken ones with a page that shows each. `notOnPage`: images requested that no
   * page showed (a script's beacon, a hidden frame's pixel), counted and never asked (G-737); absent in reports before 2026-11-11.
   */
  images?: { seen: number; asked: number; otherHosts?: number; notOnPage?: number; broken?: { url: string; status: number | null; page: string }[] };
  /**
   * Offline only (--offline, G-335): the hosts other than the site's that the pages themselves asked while the crawl's browser
   * rendered them, allowed and recorded, not blocked: each host, the resource types asked of it in the order first seen, how
   * many requests, and the first page (its address) that asked. At most H.OTHER_HOSTS_MAX hosts.
   */
  pageHosts?: { host: string; types: string[]; count: number; page: string }[];
  /** Requests to hosts past that cap, counted and not listed (a host past the cap asked twice counts twice). */
  pageHostsLeft?: number;
  /**
   * The http:// addresses a redirect sent the site's links to (G-240), each asked once after the crawl: how many
   * there were, and each one asked (H.DOWNGRADES_ASKED at most) with its status, null when it gave no answer.
   */
  downgrades?: { seen: number; answers: { url: string; status: number | null }[] };
  /**
   * The addresses on other sites the site links to, each asked once after the crawl (G-241): how many there were,
   * and each one asked (H.EXTERNAL_LINKS_ASKED at most, the most-linked first) with its status, where a redirect
   * took it (`to`), or why it gave none (`failed`: the name does not resolve, the connection was refused, it timed
   * out, or another error), and `again` when a server error or a timeout was asked a second time. `unreachable`:
   * an address failed to resolve or connect, and so did the control (example.com): this computer reaches no other
   * site (a proxy, a firewall), so none of them is called gone. `offline`: the build was told (--offline) to ask no
   * host but the site (G-333): the links are counted in `seen` and none was asked, so none is gone and the suite
   * carries no test of them.
   */
  external?: { seen: number; answers: ExternalAnswer[]; unreachable?: true; offline?: true };
  /** Whether the names of the hosts whose requests failed resolve from here (G-380, docs/CRAWL-FORMAT.md). */
  failedHosts?: { host: string; resolves: boolean | null }[];
}

/** One address on another site, asked after the crawl or by the suite's link report (G-241). */
export interface ExternalAnswer {
  url: string;
  status: number | null;
  to?: string;
  failed?: 'no-such-name' | 'refused' | 'timeout' | 'error';
  again?: true;
  /** Not asked, and why: it leads further in than the site under test, into a private network or this computer (G-243). */
  notAsked?: string;
}
