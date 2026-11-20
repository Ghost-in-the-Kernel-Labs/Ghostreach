/**
 * What the crawl does once its pages are read (crawl/loop.ts runs it last): the frontier's leftovers kept, then,
 * unless the site asked it to stop, the requests outside the browser (the not-found probe, what the site says of
 * itself, its images, its http:// downgrades, its links to other sites), each sign-in page's form, and the
 * second look.
 */
import { givenUp, givenUpWhy } from './deadline.js';
import type { Browser, BrowserContext } from 'playwright';
import { H } from '../leaf/heuristics/crawl.js';
import { notFoundPath, robotsPath, signInKind } from '../leaf/pages/url.js';
import type { CrawlSettings } from './loop.js';
import { readSignInPage, type CrawlRun } from './page-step.js';
import { DEFAULT_USER_AGENT, type CrawlReport, type SiteProbe } from '../leaf/report.js';
import { httpDowngrades } from './report-read.js';
import { isAllowed } from './robots.js';
import { secondLook } from './second-look.js';
import { askDowngrades, askExternal, askImages, externalLinks, guardedRequests, probeSite } from './site-probe.js';
import type { RobotsAnswer } from './state.js';

/** A wait: the crawl's polite delays. */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** What was left in the frontier; then, never once the site has asked the crawl to stop, the not-found probe and the second look. */
export async function afterCrawl(run: CrawlRun, context: BrowserContext, browser: Browser, settings: CrawlSettings): Promise<void> {
  const { options, delayMs, settleMs, timeout, log } = settings;
  const { state } = run;
  state.leaveOver(run.frontier.leftovers());
  const { stopReason, robots, pages } = state;
  const stopped = stopReason === 'rate-limited' || stopReason === 'too-many-errors';
  const wait = Math.max(delayMs, (robots.policy.crawlDelaySeconds ?? 0) * 1000);
  // Last, as one more page, the polite delay first.
  if (!stopped && pages.length > 0) {
    await sleep(Math.max(0, wait - (Date.now() - state.lastResponseAt)));
    // Every request from here on outside the browser, each redirect of it checked: none leads further in than the site (G-243).
    const request = await guardedRequests(context, state.origin, options.resolve);
    state.noteNotFound(await askNotFound(request, state.origin, robots, timeout));
    // What the site says of itself (G-202): a few requests, each the polite delay apart.
    const polite = () => sleep(wait);
    state.noteSite(await probeSite(request, state.origin, robots.policy.sitemaps ?? [], pages, timeout, polite));
    const images = run.watch ? await askShownImages(run.watch.imagesSeen(), state.shownImages(), (shown) => askImages(request, state.origin, shown, timeout, polite)) : undefined;
    if (images) state.noteSite({ images });
    const downgrades = await askDowngrades(request, httpDowngrades({ pages, origin: state.origin }).map((p) => p.finalUrl), timeout, polite);
    if (downgrades) state.noteSite({ downgrades });
    // Every other site the pages link to, each address asked once (G-241): a link gone dark is a finding.
    const external = await askExternal(request, externalLinks(state.edges), timeout, wait, sleep, Date.now, options.externalControl);
    if (external) state.noteSite({ external });
  }
  // Each sign-in link's page, opened once to read its form (G-155): the polite delay first, robots.txt asked.
  if (!stopped) {
    const signIns = state.notCrawled.filter((n) => n.reason === 'sign-in' && signInKind(n.url) === 'login' && isAllowed(robots.policy, robotsPath(n.url)));
    for (const { url } of signIns.slice(0, H.SIGN_IN_PAGES_READ)) {
      await sleep(Math.max(0, wait - (Date.now() - state.lastResponseAt)));
      run.log(`  reading the sign-in form at ${url} (a sign-in page: read for its form only)`);
      // Kept to the deadline as every page is (G-268): a sign-in page that never stops is left unread.
      const fresh = await givenUp(run.page, readSignInPage(run, url), run.readDeadlineMs);
      if (fresh) {
        run.page = fresh;
        run.log(`  ${url}: ${givenUpWhy(run.readDeadlineMs)}`);
      }
    }
  }
  // The second look, always (GR-003: a review is the full one).
  if (!stopped) {
    const { differed } = await secondLook(browser, pages, { userAgent: DEFAULT_USER_AGENT, delayMs: wait, settleMs, timeout, log, origin: state.origin, robots: robots.policy, readDeadlineMs: run.readDeadlineMs, ...(state.inward ? { inward: state.inward } : {}) });
    if (differed) log(`  ${differed} page${differed === 1 ? '' : 's'} read differently the second time: ${differed === 1 ? 'its' : 'their'} changing headings won't be checks`);
  }
}

/**
 * The images to ask (G-203): of every image the pages requested (the load watch's), those a page showed a visitor
 * (readers/images.ts, G-737 slice 8). A script's beacon (`new Image().src`), a preload and a pixel in a frame no visitor sees are
 * counted in `notOnPage`, never asked: perfectserve.com's audit called a Cloudflare Turnstile beacon "an empty box visitors see".
 * `seen` then counts the images shown on a page. Always written, 0 too, so a report tells this crawl from one made before it.
 */
// Decision: G-737
async function askShownImages(requested: Map<string, string>, shown: ReadonlySet<string>, ask: (images: Map<string, string>) => Promise<SiteProbe['images']>): Promise<SiteProbe['images']> {
  const onPage = new Map([...requested].filter(([url]) => shown.has(url)));
  const notOnPage = requested.size - onPage.size;
  const asked = await ask(onPage);
  if (asked) return { ...asked, notOnPage };
  return notOnPage ? { seen: 0, asked: 0, notOnPage } : undefined;
}

/**
 * The site's answer to an address that cannot exist (notFoundPath), when robots.txt allows asking:
 * what a test can hold it to. Redirects are followed, so a site that sends missing pages to a page
 * that answers 404 counts; one that answers 200 (a single-page app's shell) does not.
 */
async function askNotFound(request: Awaited<ReturnType<typeof guardedRequests>>, origin: string, robots: RobotsAnswer, timeout: number): Promise<CrawlReport['notFound']> {
  const url = `${origin}${notFoundPath(origin)}`;
  if (robots.status === null || !isAllowed(robots.policy, robotsPath(url))) return undefined;
  try {
    const res = await request.get(url, { timeout, maxRedirects: 5, failOnStatusCode: false });
    return { url, status: res.status() };
  } catch {
    return { url, status: null };
  }
}
