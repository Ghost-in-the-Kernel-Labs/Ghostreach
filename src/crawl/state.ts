/**
 * What a crawl knows as it goes (TODO.md item 14, the crawl loop's first step): the site's origin and
 * robots.txt, the page being loaded and the redirect the request router caught for it, the pages read
 * and found, the links, what was not crawled and why, the language and the cookie banner, and why
 * the crawl stopped. One object, shared by the request router and the crawl loop (crawler.ts), where
 * there were variables of one closure.
 */
import { addressPath, pageKey } from '../leaf/pages/url.js';
import type { Fingerprint } from '../leaf/pages/fingerprint.js';
import { Discovery } from './discovery.js';
import type { Leftover } from './frontier.js';
import { NotCrawled } from './not-crawled.js';
import { ALLOW_ALL, type RobotsPolicy } from './robots.js';
import type { CrawledPage, CrawlReport, FoundLoginForm, LinkEdge, LoginForm, NotCrawledReason, ProviderSignIn, StopReason } from '../leaf/report.js';
import type { FoundSignInLink } from './providers.js';
import { LanguageFolders } from './language-folders.js';
import { SignIns } from './sign-ins.js';
import { crawlReport } from './state-report.js';

/** The site's robots.txt as read: its rules, the status it answered, and why it could not be read. */
export interface RobotsAnswer {
  policy: RobotsPolicy;
  status: number | null;
  error?: string;
  /** 'incomplete': as seen from the crawler's machine (a TLS-intercepting proxy there can cause it too) the server sends no intermediate certificate, so robots.txt was read with relaxed checking (G-609). */
  certificateChain?: 'incomplete';
}

/** A page's address without its query: /thread?show=53141 and /thread are one path. */
export function pathOnly(url: string): string {
  const parsed = new URL(pageKey(url));
  return parsed.origin + addressPath(parsed.href);
}

/**
 * One page load, as the router saw it (Fable's review of 2026-10-11, suggestion 6): the page the crawl loop
 * is loading (`key`, a pageKey), the redirect the router intercepted for the loop to follow or not, and why
 * the router could not fetch it. Each load has its own: an answer arriving late is written to its own load,
 * never the next one's.
 */
export interface Navigation {
  readonly key: string;
  redirect: { status: number; location: string } | null;
  failed: string | null;
}

/**
 * Every field is private: read through a getter (a collection as a read-only view), written only through a named
 * method below, which says what it records. Ghost, 2026-11-09: "Lets go with the full version". Its other languages, the
 * addresses not crawled, the sign-ins and the report's assembly live in sibling files it delegates to (C-022, J-014).
 */
// Decision: G-686
export class CrawlState {
  /** The site crawled: the start page's origin, or where the start page moved to. */
  #origin: string;
  /** robots.txt for `origin`; nothing allowed until it is read. */
  #robots: RobotsAnswer = { policy: ALLOW_ALL, status: null };
  /** Whether a request of the browser's may go (destination.ts, browserGuard: G-270); none, every request goes. */
  #inward?: (url: string) => Promise<string | null>;
  /** The browser's requests refused as leading further in than the site, each address once, with why. */
  readonly #refusedInBrowser = new Map<string, string>();
  /** The images the pages showed a visitor (noteShownImages). */
  readonly #shownImages = new Set<string>();
  /** The page load under way: what the router saw of it, for the crawl loop (Fable's review, suggestion 6). */
  #current: Navigation | null = null;
  /** Pages already read (pageKey): a page's script moving the browser to one isn't sent to the site again. */
  readonly #read = new Set<string>();
  readonly #pages: CrawledPage[] = [];
  readonly #edges: LinkEdge[] = [];
  /** Each link once per place (from, to, words, region, hidden). */
  readonly #edgeKeys = new Set<string>();
  /** The addresses not crawled, and why (not-crawled.ts). */
  readonly #notCrawled = new NotCrawled();
  /** Pages found (by pageKey: /about/ is /about), so none is queued twice. */
  readonly #seen: Set<string>;
  /** Pages read, by pageKey of where they landed -> the URL of the page that reached it. */
  readonly #crawledFinal = new Map<string, string>();
  /** Title, headings and shape of every page read, to spot the same page at two addresses. */
  readonly #contents = new Map<string, string>();
  readonly #discovery: Discovery;
  /** Paths (without query) of every URL found, to spot query-string variants of a known page. */
  readonly #seenPaths: Set<string>;
  #language: CrawlReport['language'];
  /** The other languages met so far and the language folders found and decided (language-folders.ts, G-754). */
  readonly #folders = new LanguageFolders();
  #consent: CrawlReport['consent'];
  #stopReason: StopReason = 'complete';
  #consecutiveErrors = 0;
  /** Pages in a row that gave no answer, each tried twice (G-200): enough of them fail the crawl. */
  #noAnswerStreak = 0;
  #failed: string | undefined;
  /** When the previous page's response arrived: the polite delay runs from then. */
  #lastResponseAt = 0;
  /** The answer to an address that cannot exist (CrawlReport.notFound), once asked. */
  #notFound: CrawlReport['notFound'];
  /** What the site says of itself (CrawlReport.site), once asked. */
  #site: CrawlReport['site'];
  /** Each address the site's name points to, and whether it took a connection (CrawlReport.addresses). */
  #addresses: CrawlReport['addresses'];
  /** The sign-in forms and the sign-ins by another site found so far, never sent nor followed (sign-ins.ts, G-261). */
  readonly #signIns = new SignIns();

  constructor(startUrl: string, saturationPages: number) {
    this.#origin = new URL(startUrl).origin;
    this.#seen = new Set([pageKey(startUrl)]);
    this.#folders.noteLocaleFolder(startUrl);
    this.#seenPaths = new Set([pathOnly(startUrl)]);
    this.#discovery = new Discovery(saturationPages);
  }

  get origin(): string {
    return this.#origin;
  }
  get robots(): Readonly<RobotsAnswer> {
    return this.#robots;
  }
  get inward(): ((url: string) => Promise<string | null>) | undefined {
    return this.#inward;
  }
  get refusedInBrowser(): ReadonlyMap<string, string> {
    return this.#refusedInBrowser;
  }
  get current(): Navigation | null {
    return this.#current;
  }
  /** The page the crawl loop is loading now (pageKey): a navigation to anything else is the page's own doing. */
  get loading(): string | null {
    return this.#current?.key ?? null;
  }
  get read(): ReadonlySet<string> {
    return this.#read;
  }
  get pages(): readonly CrawledPage[] {
    return this.#pages;
  }
  get edges(): readonly LinkEdge[] {
    return this.#edges;
  }
  get notCrawled(): readonly CrawlReport['notCrawled'][number][] {
    return this.#notCrawled.list;
  }
  get seen(): ReadonlySet<string> {
    return this.#seen;
  }
  get crawledFinal(): ReadonlyMap<string, string> {
    return this.#crawledFinal;
  }
  /** Whether pages stopped teaching the crawl anything new (discovery.ts). */
  get saturated(): boolean {
    return this.#discovery.saturated;
  }
  get language(): CrawlReport['language'] {
    return this.#language;
  }
  get consent(): CrawlReport['consent'] {
    return this.#consent;
  }
  get stopReason(): StopReason {
    return this.#stopReason;
  }
  get noAnswerStreak(): number {
    return this.#noAnswerStreak;
  }
  get failed(): string | undefined {
    return this.#failed;
  }
  get lastResponseAt(): number {
    return this.#lastResponseAt;
  }
  get site(): Readonly<CrawlReport['site']> {
    return this.#site;
  }
  get loginForms(): readonly LoginForm[] {
    return this.#signIns.loginForms;
  }
  get providerStarts(): ReadonlySet<string> {
    return this.#signIns.providerStarts;
  }

  /** The browser's guard (G-270), set before the crawl starts. */
  configure(settings: { inward: (url: string) => Promise<string | null> }): void {
    this.#inward = settings.inward;
  }

  /** The site lives where the start page landed: the crawl's origin from now on (its robots.txt is read next, `readRobots`). */
  moveTo(origin: string): void {
    this.#origin = origin;
  }

  /** robots.txt for the origin, as read. */
  readRobots(robots: RobotsAnswer): void {
    this.#robots = robots;
  }

  /** Each address the site's name points to, as probed (CrawlReport.addresses). */
  noteAddresses(addresses: CrawlReport['addresses']): void {
    this.#addresses = addresses;
  }

  /** A request of the browser's refused as leading further in than the site: the first reason an address was refused for is the one kept. */
  refuseInBrowser(url: string, why: string): void {
    if (!this.#refusedInBrowser.has(url)) this.#refusedInBrowser.set(url, why);
  }

  /** A new page load, of the page with this key: the router's answers to it go here. */
  navigate(key: string): Navigation {
    this.#current = { key, redirect: null, failed: null };
    return this.#current;
  }

  /** A page loaded, recorded in the order loaded; its entry is filled in as it is read. */
  addPage(entry: CrawledPage): void {
    this.#pages.push(entry);
  }

  /** The site answered just now: the polite delay runs from here. */
  responded(): void {
    this.#lastResponseAt = Date.now();
  }

  /** A page found (pageKey), so it is never queued twice. */
  markSeen(key: string): void {
    this.#seen.add(key);
    this.#folders.noteLocaleFolder(key);
  }

  /** The folder this address may put in another language, for a page of it to decide; null, nothing to ask (language-folders.ts, G-754). */
  languageFolderCandidate(url: string): string | null {
    return this.#folders.languageFolderCandidate(this.#language, url);
  }

  /** A page of a candidate folder says its language: true when the folder is another language, left out from then on (language-folders.ts). */
  confirmLanguageFolder(folder: string, lang: string | null): boolean {
    return this.#folders.confirmLanguageFolder(this.#language, folder, lang);
  }

  /** The path (without query) of a URL found, noted; true when it was found before (with a query, a variant of a known page). */
  notePath(path: string): boolean {
    const known = this.#seenPaths.has(path);
    this.#seenPaths.add(path);
    return known;
  }

  /** A link recorded once per place (`key`: from, to, words, region, hidden). */
  addLink(key: string, edge: LinkEdge): void {
    if (this.#edgeKeys.has(key)) return;
    this.#edgeKeys.add(key);
    this.#edges.push(edge);
  }

  /** The first page read with this content (title, headings and shape), when there was one; none, `url` is recorded as the first. */
  firstWithContent(content: string, url: string): string | undefined {
    const first = this.#contents.get(content);
    if (first === undefined) this.#contents.set(content, url);
    return first;
  }

  /** A page read, counted toward saturation (discovery.ts) as the page numbered by the pages loaded so far. */
  discover(url: string, fingerprint: Fingerprint): void {
    this.#discovery.see(this.#pages.length, url, fingerprint);
  }

  /** The site's language, decided on the start page; its other languages' segments are known from then on. */
  decideLanguage(language: CrawlReport['language']): void {
    this.#language = language;
    if (language) this.#folders.addOthers(language.others);
  }

  /** The cookie banner's button, as found on a page; the first one found is kept. */
  foundConsent(selector: string, page: string): void {
    if (!this.#consent) this.#consent = { selector, page };
  }

  /** A failure counted in a row (G-021); the count so far. */
  countError(): number {
    return ++this.#consecutiveErrors;
  }

  /** A page answered with a status under 500: the failures in a row start again. */
  clearErrors(): void {
    this.#consecutiveErrors = 0;
  }

  /** A page that gave no answer, tried twice, counted in a row (G-200). */
  countNoAnswer(): void {
    this.#noAnswerStreak++;
  }

  /** A page answered: the pages in a row with no answer start again (G-200). */
  clearNoAnswers(): void {
    this.#noAnswerStreak = 0;
  }

  /** The crawl failed, and why: there is no crawl to build from. */
  fail(why: string): void {
    this.#failed = why;
  }

  /** The answer to an address that cannot exist (CrawlReport.notFound). */
  noteNotFound(notFound: CrawlReport['notFound']): void {
    this.#notFound = notFound;
  }

  /**
   * The images the pages showed a visitor (readers/images.ts, G-737 slice 8), by address: the site probe asks only those of the
   * images the pages requested, so a script's beacon or a hidden frame's pixel is never said to be an image a visitor sees.
   */
  noteShownImages(urls: readonly string[]): void {
    for (const url of urls) this.#shownImages.add(url);
  }

  /** The images the pages showed (noteShownImages). */
  shownImages(): ReadonlySet<string> {
    return this.#shownImages;
  }

  /** What the site says of itself (CrawlReport.site), added to what is known of it: a fact known already is replaced where it stands. */
  noteSite(facts: NonNullable<CrawlReport['site']>): void {
    this.#site = { ...this.#site, ...facts };
  }

  /** Records an address not crawled, and why, once (not-crawled.ts). */
  skip(url: string, reason: NotCrawledReason): void {
    this.#notCrawled.skip(url, reason);
  }

  /** A page read where it landed (`key`, a pageKey), reached from `reachedFrom`: `crawledFinal` and `read` move together, here only. */
  markRead(key: string, reachedFrom: string): void {
    this.#crawledFinal.set(key, reachedFrom);
    this.#read.add(key);
  }

  /** The page just recorded taken back, recorded as not crawled and why; where it landed stays read, when it was (a page's part, G-377). */
  unread(url: string, reason: NotCrawledReason): void {
    this.#pages.pop();
    this.skip(url, reason);
  }

  /** Why the crawl stops; a later reason replaces an earlier one, though every caller stops the crawl at once. */
  stop(reason: StopReason): void {
    this.#stopReason = reason;
  }

  /** True for a link into another language of the site (once the start page's language is known; language-folders.ts). */
  isOtherLanguage(url: string): boolean {
    return this.#folders.isOtherLanguage(this.#language, url);
  }

  /** The addresses still queued when the crawl stopped, recorded as not crawled, each for its true reason (not-crawled.ts, G-741). */
  leaveOver(queued: readonly Leftover[]): void {
    this.#notCrawled.leaveOver(queued, this.#stopReason, this.#crawledFinal, (url) => this.isOtherLanguage(url));
  }

  /** A sign-in form found on a page, given its role; one already recorded there is not recorded again (sign-ins.ts). */
  addLoginForm(url: string, title: string, found: FoundLoginForm, via: LoginForm['via']): LoginForm | null {
    return this.#signIns.addLoginForm(url, title, found, via);
  }

  /** Each link or form on a page that starts a sign-in by another site, recorded once a page and provider; the ones recorded (sign-ins.ts). */
  addProviderSignIns(page: string, found: FoundSignInLink[]): ProviderSignIn[] {
    return this.#signIns.addProviderSignIns(page, found);
  }

  /** The crawl report (the Observation IR) of what the crawl knows: `options`, how it was asked to look (state-report.ts). */
  report(startUrl: string, options: CrawlReport['options']): CrawlReport {
    const { origin, robots, language, consent, stopReason, failed, site } = this;
    return crawlReport(startUrl, options, {
      origin, robots, language, consent, stopReason, failed, site, otherLanguages: this.#folders.others,
      notFound: this.#notFound, addresses: this.#addresses, discovery: this.#discovery, pages: this.#pages, edges: this.#edges,
      notCrawled: this.#notCrawled, loginForms: this.#signIns.loginForms, providerSignIns: this.#signIns.providerSignIns,
    });
  }
}
