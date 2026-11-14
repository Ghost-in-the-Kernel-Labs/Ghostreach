/**
 * What a crawl knows as it goes (TODO.md item 14, the crawl loop's first step): the site's origin and
 * robots.txt, the page being loaded and the redirect the request router caught for it, the pages read
 * and found, the links, what was not crawled and why, the language and the cookie banner, and why
 * the crawl stopped. One object, shared by the request router and the crawl loop (crawler.ts), where
 * there were variables of one closure.
 */
import { localeFolder, localeSegment, primaryLanguage } from '../leaf/pages/locale.js';
import { addressPath, pageKey } from '../leaf/pages/url.js';
import type { Fingerprint } from '../leaf/pages/fingerprint.js';
import { H } from '../leaf/heuristics/suite.js';
import { Discovery } from './discovery.js';
import type { Leftover } from './frontier.js';
import { ALLOW_ALL, type RobotsPolicy } from './robots.js';
import { REPORT_VERSION, type CrawledPage, type CrawlReport, type FoundLoginForm, type LinkEdge, type LoginForm, type NotCrawledReason, type ProviderSignIn, type StopReason } from '../leaf/report.js';
import { providerSignIn, type FoundSignInLink } from './providers.js';
import { loginRole } from './readers/login.js';

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
 * method below, which says what it records. Ghost, 2026-11-09: "Lets go with the full version".
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
  /** Ask no host but the site (--offline, G-333, G-335): the start page's move to another host fails the crawl, and the pages' requests to other hosts are recorded. */
  #offline = false;
  /** Offline, the other hosts the pages asked while rendered: host -> resource types in the order seen, count, and the first page. */
  readonly #pageHosts = new Map<string, { types: string[]; count: number; page: string }>();
  /** Hosts the pages asked past H.OTHER_HOSTS_MAX, counted and not kept (a host asked twice past the cap counts twice). */
  #pageHostsLeft = 0;
  /** The page load under way: what the router saw of it, for the crawl loop (Fable's review, suggestion 6). */
  #current: Navigation | null = null;
  /** Pages already read (pageKey): a page's script moving the browser to one isn't sent to the site again. */
  readonly #read = new Set<string>();
  readonly #pages: CrawledPage[] = [];
  readonly #edges: LinkEdge[] = [];
  /** Each link once per place (from, to, words, region, hidden). */
  readonly #edgeKeys = new Set<string>();
  readonly #notCrawled: CrawlReport['notCrawled'] = [];
  readonly #notCrawledUrls = new Set<string>();
  /** Addresses not crawled past H.NOT_CRAWLED_MAX, counted, not listed. */
  #notCrawledLeft = 0;
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
  /** Locale segments of other languages met so far, and the language folders below the top level found (blog/de). */
  readonly #otherLocales = new Set<string>();
  /** Folders below the top level named as a locale among the addresses found (localeFolder), by the path above them: blog -> de, ja. */
  readonly #localeFolders = new Map<string, Set<string>>();
  /** Those a page of decided (confirmLanguageFolder, G-754): true, another language, left out; false, the crawl's own. */
  readonly #folderDecided = new Map<string, boolean>();
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
  /** The sign-in forms found so far, never sent (CrawlReport.loginForms). */
  readonly #loginForms: LoginForm[] = [];
  /** The sign-ins by another site found so far, never followed (CrawlReport.providerSignIns, G-261). */
  readonly #providerSignIns: ProviderSignIn[] = [];
  /** The same-site addresses that start one (/auth/google): refused as sign-in, never followed. */
  readonly #providerStarts = new Set<string>();

  constructor(startUrl: string, saturationPages: number) {
    this.#origin = new URL(startUrl).origin;
    this.#seen = new Set([pageKey(startUrl)]);
    this.#noteLocaleFolder(startUrl);
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
  get offline(): boolean {
    return this.#offline;
  }
  get pageHosts(): ReadonlyMap<string, Readonly<{ types: readonly string[]; count: number; page: string }>> {
    return this.#pageHosts;
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
    return this.#notCrawled;
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
    return this.#loginForms;
  }
  get providerStarts(): ReadonlySet<string> {
    return this.#providerStarts;
  }

  /** How the crawl was asked to look, set before it starts: offline (G-333, G-335) and the browser's guard (G-270); a setting not given stays as it was. */
  configure(settings: { offline?: boolean; inward?: (url: string) => Promise<string | null> }): void {
    if (settings.offline !== undefined) this.#offline = settings.offline;
    if (settings.inward !== undefined) this.#inward = settings.inward;
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
    this.#noteLocaleFolder(key);
  }

  /** A folder below the top level named as a locale (/blog/de/), noted under the path above it, for its siblings. */
  #noteLocaleFolder(url: string): void {
    const folder = localeFolder(url);
    if (!folder) return;
    const parent = folder.slice(0, folder.lastIndexOf('/'));
    const siblings = this.#localeFolders.get(parent) ?? new Set<string>();
    siblings.add(folder);
    this.#localeFolders.set(parent, siblings);
  }

  /**
   * The folder below the top level this address may put in another language (/blog/de/post -> blog/de), for a page of it
   * to decide (confirmLanguageFolder); null when there is nothing to ask: the site is in one language (or --all-languages),
   * the address is in no such folder, its folder has no sibling named as a locale among the addresses found (/products/id/12
   * alone is an id, not Indonesian), or a page of it has decided already (G-754).
   */
  // Decision: G-754
  languageFolderCandidate(url: string): string | null {
    const folder = this.#language ? localeFolder(url) : null;
    if (!folder || this.#folderDecided.has(folder)) return null;
    return (this.#localeFolders.get(folder.slice(0, folder.lastIndexOf('/')))?.size ?? 0) >= 2 ? folder : null;
  }

  /**
   * A page of a candidate folder (languageFolderCandidate) says its language (its html lang): the folder is another language
   * of the site when that is the folder's own (de in blog/de) and not the crawl's; from then on its addresses are left out
   * (isOtherLanguage). A page in the crawl's language, or in a third, keeps the folder in (an IT section, /blog/it/, in
   * English); a page with no lang decides nothing, and the next page of the folder is asked. True when it is left out.
   */
  confirmLanguageFolder(folder: string, lang: string | null): boolean {
    const own = this.#language?.lang ?? this.#language?.prefix;
    const said = lang?.trim();
    if (!own || !said) return false;
    const other = primaryLanguage(said) === primaryLanguage(folder) && primaryLanguage(said) !== primaryLanguage(own);
    this.#folderDecided.set(folder, other);
    if (other) this.#otherLocales.add(folder);
    return other;
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
    if (language) for (const other of language.others) this.#otherLocales.add(other);
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

  /**
   * Offline (G-335): a request a page made to a host other than the site's, kept (host, resource type, count, the first page)
   * and let go. Web addresses only; at most H.OTHER_HOSTS_MAX hosts, so a page naming hosts without end ends its list.
   */
  noteOtherHost(url: string, type: string, page: string): void {
    if (!this.#offline) return;
    let host: string;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
      if (parsed.hostname === new URL(this.#origin).hostname) return;
      host = parsed.host;
    } catch {
      return;
    }
    const known = this.#pageHosts.get(host);
    if (known) {
      known.count++;
      if (!known.types.includes(type)) known.types.push(type);
    } else if (this.#pageHosts.size < H.OTHER_HOSTS_MAX) this.#pageHosts.set(host, { types: [type], count: 1, page });
    else this.#pageHostsLeft++;
  }

  /** Records an address not crawled, and why, once. */
  skip(url: string, reason: NotCrawledReason): void {
    if (this.#notCrawledUrls.has(url)) return;
    this.#notCrawledUrls.add(url);
    // A site that makes addresses without end ends its list here; the rest are counted (Fable's review, C2).
    if (this.#notCrawled.length < H.NOT_CRAWLED_MAX) this.#notCrawled.push({ url, reason });
    else this.#notCrawledLeft++;
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

  /** True for a link into another language of the site (once the start page's language is known). */
  isOtherLanguage(url: string): boolean {
    const language = this.#language;
    if (!language) return false;
    const folder = localeFolder(url);
    if (folder && this.#folderDecided.get(folder)) return true;
    const segment = localeSegment(url);
    if (!segment) return false;
    const other = language.prefix
      ? segment !== language.prefix
      : // English at the root: /fr/ is another language, /en-us/ a country site
        this.#otherLocales.has(segment) || segment.includes('-') || (language.lang !== null && primaryLanguage(segment) !== primaryLanguage(language.lang));
    if (other) this.#otherLocales.add(segment);
    return other;
  }

  /**
   * The addresses still queued when the crawl stopped, recorded as not crawled, each for its true reason (G-741): `enough-samples`
   * only when a page of its kind was read (its pattern settled, or sampled before a saturated stop) and never for a page of the
   * site's menu, which is no more of anything (G-674); otherwise why the crawl stopped first (the page limit, or stopped).
   * phoenixoutcomes.com (2026-11-11) had /press, /awards and /certifications, footer-menu pages, left as `enough-samples`.
   */
  // Decision: G-741
  leaveOver(queued: readonly Leftover[]): void {
    const stoppedFirst: NotCrawledReason = this.#stopReason === 'page-limit' ? 'page-limit' : 'stopped';
    for (const item of queued) {
      if (this.#crawledFinal.has(pageKey(item.url))) continue;
      if (this.isOtherLanguage(item.url)) {
        this.skip(item.url, 'other-language'); // queued before a page of its folder said its language (G-754)
        continue;
      }
      const enough = !item.menu && (item.settled || (this.#stopReason === 'saturated' && item.sampled));
      this.skip(item.url, enough ? 'enough-samples' : stoppedFirst);
    }
  }

  /** A sign-in form found on a page, given its role; one already recorded there (the same password field) is not recorded again. */
  addLoginForm(url: string, title: string, found: FoundLoginForm, via: LoginForm['via']): LoginForm | null {
    if (this.#loginForms.some((f) => f.url === url && f.password.xpath === found.password.xpath)) return null;
    const form: LoginForm = { url, via, form: found.form, ...loginRole(url, title, found.form, found.heading),username: found.username, password: found.password, submit: found.submit };
    this.#loginForms.push(form);
    return form;
  }

  /** Each link or form on a page that starts a sign-in by another site, recorded once a page and provider; the ones recorded. */
  addProviderSignIns(page: string, found: FoundSignInLink[]): ProviderSignIn[] {
    const added: ProviderSignIn[] = [];
    for (const f of found) {
      const signIn = providerSignIn(f, page);
      if (!signIn) continue;
      if (signIn.sameSite) this.#providerStarts.add(pageKey(signIn.address));
      if (this.#providerSignIns.some((s) => s.page === page && s.provider === signIn.provider)) continue;
      this.#providerSignIns.push(signIn);
      added.push(signIn);
    }
    return added;
  }

  /** The crawl report (the Observation IR) of what the crawl knows: `options`, how it was asked to look. */
  report(startUrl: string, options: CrawlReport['options']): CrawlReport {
    const { origin, robots, language, consent, stopReason, failed, site } = this;
    const [discovery, notFound, addresses] = [this.#discovery, this.#notFound, this.#addresses];
    return {
      tool: 'suite-builder',
      reportVersion: REPORT_VERSION,
      startUrl,
      origin,
      options,
      adsBlocked: true,
      robots: {
        url: `${origin}/robots.txt`,
        status: robots.status,
        source: robots.policy.source,
        crawlDelaySeconds: robots.policy.crawlDelaySeconds,
        ...(robots.error ? { error: robots.error } : {}),
        ...(robots.certificateChain ? { certificateChain: robots.certificateChain } : {}),
      },
      ...(notFound ? { notFound } : {}),
      ...(site || this.#pageHosts.size || this.#pageHostsLeft ? { site: { ...site, ...(this.#pageHosts.size ? { pageHosts: [...this.#pageHosts].map(([host, h]) => ({ host, ...h })).sort((a, b) => b.count - a.count) } : {}), ...(this.#pageHostsLeft ? { pageHostsLeft: this.#pageHostsLeft } : {}) } } : {}),
      ...(addresses ? { addresses } : {}),
      ...(language ? { language: { ...language, others: [...this.#otherLocales].sort() } } : {}),
      ...(consent ? { consent } : {}),
      stopReason,
      ...(failed ? { failed } : {}),
      ...(discovery.newAt.length ? { discovery: { newAt: discovery.newAt } } : {}),
      pages: this.#pages,
      edges: this.#edges,
      notCrawled: this.#notCrawled,
      ...(this.#notCrawledLeft ? { notCrawledLeft: this.#notCrawledLeft } : {}),
      ...(this.#loginForms.length ? { loginForms: this.#loginForms } : {}),
      ...(this.#providerSignIns.length ? { providerSignIns: this.#providerSignIns } : {}),
    };
  }
}
