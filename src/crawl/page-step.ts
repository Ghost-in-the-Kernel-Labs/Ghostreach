/**
 * One page of a crawl (TODO.md item 14, the crawl loop's second step): load it, following redirects
 * one hop at a time; decide what its answer means for the crawl; let it settle and read it; queue its
 * links. The crawl loop (read-pages.ts) picks the page, waits the polite delay and calls visit(); what
 * the crawl knows as it goes is the CrawlState (state.ts) each step reads and writes.
 */
import { isAbandoned } from './abandoned.js';
import { browserGone, readWithin } from './deadline.js';
import { firstLine } from './error-line.js';
import type { LoadWatch } from './load-watch.js';
import type { Page } from 'playwright';
import { openPage } from './open.js';
import { isPagePart } from './part-of-page.js';
import { documentUrl, normalizeUrl, pageKey, sameOrigin } from '../leaf/pages/url.js';
import type { Checklist } from './checklist.js';
import type { FrontierItem } from './frontier.js';
import { CONTENT_READERS, decideLanguage, IDENTITY_READERS, linkEdge, readCanonical, readLanguage, readShownImages, runReaders, type RawLink, type ReadContext } from './readers/index.js';
import { markCredentials } from '../leaf/pages/credential-text.js';
import { markCredentialsIn } from './credentials-entry.js';
import { readLoginForms } from './readers/login.js';
import { readSignInLinks } from './readers/providers.js';
import type { CrawledPage, LoginForm, ProviderSignIn } from '../leaf/report.js';
import { refusalOf } from './refusals.js';
import { noteSameContent, seenHeadings } from './report-read.js';
import { settlePage } from './settle.js';
import { H } from '../leaf/heuristics/suite.js';
import { pathOnly, type CrawlState, type RobotsAnswer } from './state.js';
import { isNoAnswer, loadPage, triedAgain, type LoadedPage } from './page-load.js';

/** What one crawl's pages are visited with: the browser tab, what the crawl knows, its queue, and how it was asked to look. */
export interface CrawlRun {
  page: Page;
  state: CrawlState;
  frontier: Checklist;
  /** robots.txt for an origin the site moved to. */
  robotsFor: (origin: string) => Promise<RobotsAnswer>;
  log: (message: string) => void;
  timeout: number;
  settleMs: number;
  maxConsecutiveErrors: number;
  /** What each page's load shows beyond the page (G-201); none, nothing watched. */
  watch?: LoadWatch;
  /** How long a loaded page's reading may take before its tab is given up (deadline.ts, G-268). */
  readDeadlineMs: number;
}

/** Counts a failure; true when the crawl should stop. */
// Decision: G-021
function failed(run: CrawlRun): boolean {
  return run.state.countError() >= run.maxConsecutiveErrors;
}

/**
 * What a loaded page's answer means for the crawl: stop (a 429, or too many failures in a row), go
 * on to the next page (off the site, a duplicate, a failure, not HTML), or read it. A page to read is
 * recorded as read where it landed.
 */
function answer(run: CrawlRun, { entry, response, refusedByRobots }: LoadedPage): 'stop' | 'next' | 'read' {
  const { state } = run;
  if (entry.offSite || entry.duplicateOf || refusedByRobots) return 'next';
  if (entry.error || !response) {
    entry.error ??= 'no response';
    run.log(`  failed: ${entry.error}`);
    // The start page, failed after its second try, ends the crawl: nothing it read could be built on
    // (Ghost's recrawl of the-internet, 2026-10-04, read 95 pages of the previous crawl for 14 minutes,
    // then built nothing).
    if (state.pages.length === 1 && state.pages[0] === entry) return 'stop';
    // A page that gave no answer twice is unread, not a page (G-200): no page type, no test, said in the summary.
    const noAnswer = isNoAnswer(entry.error);
    if (noAnswer) {
      state.unread(entry.url, 'unread');
      state.countNoAnswer();
    }
    if (!failed(run)) return 'next';
    state.stop('too-many-errors');
    // Every page of the streak gave no answer: the crawl could not read the site, and fails (G-200).
    if (noAnswer && state.noAnswerStreak >= run.maxConsecutiveErrors) state.fail(`${state.noAnswerStreak} pages in a row gave no answer, each tried twice`);
    return 'stop';
  }

  state.clearNoAnswers();
  entry.status = response.status();
  entry.contentType = response.headers()['content-type'] ?? null;
  if (entry.status === 429) {
    state.stop('rate-limited');
    return 'stop';
  }
  if (entry.status < 500) state.clearErrors();
  else if (failed(run)) {
    state.stop('too-many-errors');
    return 'stop';
  }

  const earlier = state.crawledFinal.get(pageKey(entry.finalUrl));
  if (earlier !== undefined) {
    entry.duplicateOf = earlier;
    return 'next';
  }
  state.markRead(pageKey(entry.finalUrl), entry.url);
  return entry.contentType !== null && !/html/i.test(entry.contentType) ? 'next' : 'read';
}

/**
 * Where the page settled, as the crawl records it: a script that moved it to another address after
 * loading (a client-side redirect) records it where it landed; its own canonical address, trusted
 * for the same path only (/shop?sort=price names /shop: sites that name their home page as every
 * page's canonical are common enough). False when that makes it off the site or a page already read.
 */
async function settledAt(run: CrawlRun, entry: CrawledPage): Promise<boolean> {
  const { state, page } = run;
  const landed = normalizeUrl(page.url());
  if (landed && pageKey(landed) !== pageKey(entry.finalUrl)) {
    entry.redirects.push({ url: entry.finalUrl, status: 0 });
    entry.finalUrl = landed;
    if (!sameOrigin(landed, state.origin)) {
      entry.offSite = true;
      return false;
    }
    state.markSeen(pageKey(landed));
    const reached = state.crawledFinal.get(pageKey(landed));
    if (reached !== undefined) {
      entry.duplicateOf = reached;
      return false;
    }
    state.markRead(pageKey(landed), entry.url);
  }
  const canonical = await readCanonical(page);
  if (canonical && pageKey(canonical) !== pageKey(entry.finalUrl)) {
    entry.canonical = canonical;
    if (sameOrigin(canonical, state.origin) && pathOnly(canonical) === pathOnly(entry.finalUrl)) {
      const already = state.crawledFinal.get(pageKey(canonical));
      if (already !== undefined) {
        entry.duplicateOf = already;
        return false;
      }
      state.markSeen(pageKey(canonical));
      state.markRead(pageKey(canonical), entry.url);
    }
  }
  return true;
}

/**
 * Reads a page that answered: lets it settle (hydration: each wait bounded; a page that never goes
 * quiet is read as it is), records where it settled, reads what it shows (readers/), decides the
 * site's language on the start page, and queues its links.
 */
async function readPage(run: CrawlRun, item: FrontierItem, entry: CrawledPage): Promise<void> {
  const { state, page, frontier, log } = run;
  const settled = await settlePage(page, run.settleMs);
  if (settled) entry.settled = settled;
  if (!(await settledAt(run, entry)) || (await leftOutAsLanguage(run, entry))) return;
  const ctx: ReadContext = { origin: state.origin, bannerButton: null, links: [] };
  await runReaders(IDENTITY_READERS, page, entry, ctx);
  const fingerprint = ctx.fingerprint;
  if (!fingerprint) return; // the shape reader always leaves one
  if (ctx.bannerButton) state.foundConsent(ctx.bannerButton, entry.finalUrl);
  noteSameContent((content, url) => state.firstWithContent(content, url), entry, entry.headings ?? [], log);
  state.discover(entry.finalUrl, fingerprint);
  frontier.recordSample(item.url, { url: entry.finalUrl, fingerprint, headings: seenHeadings(entry) });

  await runReaders(CONTENT_READERS, page, entry, ctx);
  for (const found of await readLoginForms(page)) noteLoginForm(run, state.addLoginForm(entry.finalUrl, entry.title, found, 'page'));
  // Before its links are queued: a same-site start of one (/auth/google) is then refused, never followed.
  noteProviderSignIns(run, state.addProviderSignIns(entry.finalUrl, await readSignInLinks(page)));
  // A page with links without end is read to a bound; the rest are counted, never a clean page (Fable's review, C2).
  const links = ctx.links.slice(0, H.LINKS_PER_PAGE_MAX);
  if (ctx.links.length > links.length) entry.linksLeft = ctx.links.length - links.length;
  // The crawl stays in the start page's language (GR-003: never every language).
  if (state.pages[0] === entry) {
    const language = decideLanguage(entry.finalUrl, state.origin, await readLanguage(page), links.map((l) => l.resolved));
    state.decideLanguage(language);
    if (language) log(`  language: ${language.prefix ? `/${language.prefix}/` : language.lang}; other languages are left out`);
  }
  frontier.recordLinks(entry.finalUrl, queueLinks(run, entry.finalUrl, links, item.depth + 1));
}

/**
 * A page in a folder below the top level named as a locale (/blog/de/), beside a sibling: its lang decides whether the folder is
 * another language of the site (CrawlState.confirmLanguageFolder). One that is, is taken back (not crawled, other-language), as a
 * link into /de-de/ would never have been read, and nothing under the folder is read from then on (G-754).
 */
// Decision: G-754
async function leftOutAsLanguage(run: CrawlRun, entry: CrawledPage): Promise<boolean> {
  const folder = run.state.languageFolderCandidate(entry.finalUrl);
  if (!folder) return false;
  const { lang } = await readLanguage(run.page);
  // A reading given up at its deadline runs on (G-501): the crawl has moved on, and the last page is no longer this one.
  if (isAbandoned(entry) || run.state.pages.at(-1) !== entry || !run.state.confirmLanguageFolder(folder, lang)) return false;
  run.state.unread(entry.url, 'other-language');
  run.log(`  /${folder}/ is the site in another language: left out`);
  return true;
}

/** Says, as the crawl goes, that a sign-in by another site was found and not followed. */
function noteProviderSignIns(run: CrawlRun, found: ProviderSignIn[]): void {
  for (const s of found) run.log(`  a sign-in with ${s.provider} (${s.evidence}: ${s.sameSite ? new URL(s.address).pathname : s.address}): recorded, not followed`);
}

/** Says, as the crawl goes, that a sign-in form was found and not sent. */
function noteLoginForm(run: CrawlRun, form: LoginForm | null): void {
  if (form) run.log(`  a sign-in form (${form.role}${form.evidence.length ? `: ${form.evidence.join(', ')}` : ''}): recorded, not sent`);
}

/**
 * A sign-in link's page, opened once after the crawl only to read its sign-in form (docs/LOGIN-PLAN.md,
 * step 2): it is not a page of the crawl (its link stays not crawled, `sign-in`), and nothing on it is
 * typed or sent. One that redirects or fails is left unread.
 */
// Decision: G-155
export async function readSignInPage(run: CrawlRun, url: string): Promise<void> {
  const { state, page } = run;
  const nav = state.navigate(pageKey(documentUrl(url)));
  // A timeout is tried once more, as the start page is: the-internet's /login answered the second visit
  // (Ghost's run, 2026-10-04: 30 s without an answer, so no form).
  for (let tries = 1; ; tries++) {
    try {
      await openPage(page, url, run.timeout, tries > 1);
      break;
    } catch (error) {
      if (tries === 1 && triedAgain(run, true, firstLine(error))) continue;
      run.log(`  could not open ${url} to read its sign-in form: ${firstLine(error)}`);
      run.log('  its sign-in form is not recorded');
      return;
    } finally {
      state.responded();
    }
  }
  if (nav.redirect || nav.failed) return;
  await settlePage(page, run.settleMs);
  const title = markCredentials((await page.title()).replace(/\s+/g, ' ').trim());
  for (const found of await readLoginForms(page)) noteLoginForm(run, state.addLoginForm(url, title, found, 'sign-in-link'));
  noteProviderSignIns(run, state.addProviderSignIns(url, await readSignInLinks(page)));
}

/** Records a page's links, once per place; queues the same-site ones worth reading; gives back the same-site targets. */
function queueLinks(run: CrawlRun, from: string, links: RawLink[], depth: number): Set<string> {
  const { state } = run;
  const sameSite = new Set<string>();
  for (const link of links) {
    const edge = linkEdge(from, link, state.origin);
    if (!edge) continue; // mailto:, tel:, javascript:
    const { to, external } = edge;
    if (!external) sameSite.add(to);
    // The same link in two places (header and cookie banner, say) is recorded once per place.
    const key = `${edge.from}\n${edge.to}\n${edge.href}\n${edge.text}\n${link.region}\n${link.hidden}`;
    state.addLink(key, edge);
    if (external || state.seen.has(pageKey(to))) continue;
    state.markSeen(pageKey(to));
    // /thread?show=53141 is /thread again with something highlighted or paged: same page type.
    const path = pathOnly(to);
    const known = state.notePath(path);
    const variant = new URL(to).search !== '' && known;
    if (variant) {
      state.skip(to, 'query-variant');
      continue;
    }
    const refused = refusalOf(run, to);
    if (refused) state.skip(to, refused);
    else run.frontier.add({ url: to, depth });
  }
  return sameSite;
}

/**
 * One page of the crawl, picked by the loop: loaded, its answer judged, and when it is a page to
 * read, read. 'stop' when the crawl should stop after it (the stop reason is in the state).
 */
export async function visit(run: CrawlRun, item: FrontierItem): Promise<'stop' | 'next'> {
  if (await browserGone(run)) return 'stop';
  run.watch?.reset();
  const loaded = await loadPage(run, item);
  if (!loaded) return 'next';
  run.state.addPage(loaded.entry);
  run.state.responded();
  const verdict = answer(run, loaded);
  if (verdict !== 'read') return verdict;
  // A part of a page its script loads (G-377): not a page, and its link to the next part is not followed. Never the start
  // page, nor an error's answer (a bare "Not found" is still a broken link).
  if (run.state.pages.length > 1 && (loaded.entry.status ?? 0) < 300 && isPagePart((await loaded.response?.text().catch(() => '')) ?? '')) {
    run.state.unread(loaded.entry.url, 'page-part');
    run.log('  a part of a page, loaded into it by a script (no document around it): not read as a page');
    return 'next';
  }
  const read = await readWithin(run, loaded.entry, readPage(run, item, loaded.entry));
  if (run.state.pages.at(-1) !== loaded.entry) return 'next'; // taken back as another language (G-754)
  const load = read ? await run.watch?.read(loaded.response) : undefined;
  if (load) loaded.entry.load = load;
  // The images this page shows a visitor, beside every image it requested (the watch's): the site probe asks only those (G-737).
  if (read && run.watch) run.state.noteShownImages(await readShownImages(run.page));
  // After every reader and the load samples: the readers match the browser's own list against each other's words (readSeen), so they match as the page wrote them.
  markCredentialsIn(loaded.entry);
  return 'next';
}
