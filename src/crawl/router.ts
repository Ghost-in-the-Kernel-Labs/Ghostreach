/**
 * The crawl's request router (TODO.md item 14, the crawl loop's third step): every request the
 * browser makes during a crawl passes through here. Images, media and fonts are not fetched (the
 * structure doesn't need them); nor is anything from an ad host, as the suites block them (G-095:
 * the crawl sees the site as its tests will, so an ad's wall or banner never becomes a check); scripts, styles and frames go as they are; page loads are fetched
 * here, one hop at a time, so every redirect is checked against robots.txt by the crawl loop before
 * it is followed (page-step.ts). What it needs of the crawl, and leaves for it, is the CrawlState.
 */
import type { BrowserContext, Request, Route } from 'playwright';
import { H as crawlH } from '../leaf/heuristics/crawl.js';
import { H as suiteH } from '../leaf/heuristics/suite.js';
import { isAdHost } from '../leaf/pages/ad-hosts.js';
import { normalizeUrl, pageKey, robotsPath, sameOrigin } from '../leaf/pages/url.js';
import { firstLine } from './error-line.js';
import { isAllowed, type RobotsPolicy } from './robots.js';
import type { CrawlState, Navigation } from './state.js';

/** What the crawl never fetches: images, media and fonts (the structure doesn't need them), and anything from an ad host, as the suites block them (G-095). The second look keeps to it too. */
// Decision: G-095
export function notFetched(request: Request): boolean {
  return ['image', 'media', 'font'].includes(request.resourceType()) || isAdHost(request.url());
}

/**
 * A document of the site robots.txt disallows: a page or a frame (an outside review, 2026-10-19: a frame went out
 * before its check, so a page framing a disallowed address had it fetched). Never asked for, by the crawl or its
 * second look.
 */
export function disallowedDocument(request: Request, origin: string, policy: RobotsPolicy): boolean {
  if (!request.isNavigationRequest()) return false;
  const url = normalizeUrl(request.url());
  return url !== null && sameOrigin(url, origin) && !isAllowed(policy, robotsPath(url));
}

/** An empty page, handed to the browser where the crawl answers for the site. */
const EMPTY = { status: 200, contentType: 'text/html', body: '' } as const;

/**
 * One request of the crawl. A browser follows redirects on its own, and Playwright only routes the
 * first URL of a navigation, so a redirect target would be fetched without a robots.txt check.
 * Instead, a page load is fetched here without following redirects; on a 3xx the browser gets an
 * empty page, and the Location is left in the state for the crawl loop, which checks it before
 * loading it. A site that stops answering fails the page being loaded, never the crawl.
 */
async function routeRequest(route: Route, state: CrawlState, nav: Navigation | null): Promise<void> {
  const request = route.request();
  const verdict = await verdictOf(request, state);
  if (verdict === 'abort') return route.abort();
  if (verdict === 'blocked') return route.abort('blockedbyclient');
  if (verdict === 'continue') return route.continue();
  return routePageLoad(route, request, state, nav);
}

/**
 * What a request that is not one of the crawl's page loads gets: not fetched (`abort`), refused as the site's or this computer's
 * (`blocked`), or let go as it is (`continue`); undefined for a page load, which the router fetches itself, one hop at a time.
 */
async function verdictOf(request: Request, state: CrawlState): Promise<'abort' | 'blocked' | 'continue' | undefined> {
  if (notFetched(request)) return 'abort';
  // A request with no frame to go to: a window a page opened, closed already (context.ts). Never the crawl's page's.
  if (!hasFrame(request)) return 'abort';
  // A page asking this computer, its network or a cloud machine's credentials: refused, as a request of the crawl's is (G-270).
  const inward = state.inward ? await state.inward(request.url()) : null;
  if (inward) {
    state.refuseInBrowser(request.url(), inward);
    return 'blocked';
  }
  // A page's robots.txt check is the loop's first; this one is defense in depth, and a frame's only one.
  if (disallowedDocument(request, state.origin, state.robots.policy)) return 'blocked';
  // A frame deeper than the crawl reads (crawlH.FRAME_DEPTH) is not loaded: frames nested without end kept a page from ever
  // finishing its load, said as no answer after two waits (item 52, step 4).
  if (request.isNavigationRequest() && frameDepth(request) > crawlH.FRAME_DEPTH) return 'blocked';
  if (!request.isNavigationRequest() || request.frame().parentFrame()) return 'continue';
  return undefined;
}

/** A page load of the crawl's, fetched here without following redirects: its answer, a redirect left for the loop, or an empty page. */
async function routePageLoad(route: Route, request: Request, state: CrawlState, nav: Navigation | null): Promise<void> {
  const url = normalizeUrl(request.url());
  // A client-side redirect to a page already read: the loop records it as a duplicate from
  // the address alone, so the site isn't asked for that page a second time.
  if (url && pageKey(url) !== state.loading && state.read.has(pageKey(url))) return route.fulfill(EMPTY);
  let response;
  try {
    response = await route.fetch({ maxRedirects: 0 });
  } catch (error) {
    // The site stopped answering (a connection refused or reset): the page fails, as any page that
    // cannot be loaded does, and the crawl goes on. The reason is left for the crawl loop and the
    // browser gets an empty page: aborting would send the tab to Chrome's error page a moment later,
    // interrupting the next page's load.
    if (nav) nav.failed = firstLine(error);
    return route.fulfill(EMPTY).catch(() => {});
  }
  const location = response.headers()['location'];
  if (response.status() >= 300 && response.status() < 400 && location) return routeRedirect(route, request, response.status(), location, nav);
  // A body past what the browser's pipe holds would close the connection to the whole browser (suiteH.PAGE_BODY_MAX_BYTES).
  const size = (await response.body()).length;
  if (size > suiteH.PAGE_BODY_MAX_BYTES) {
    if (nav) nav.failed = `answered ${Math.round(size / 1e6)} MB, more than the ${suiteH.PAGE_BODY_MAX_BYTES / 1e6} MB a page is read up to`;
    return route.fulfill(EMPTY);
  }
  return route.fulfill({ response });
}

/** A 3xx with a Location: an empty page for the browser, and where it leads left for the crawl loop to check before it follows it. */
function routeRedirect(route: Route, request: Request, status: number, location: string, nav: Navigation | null): Promise<void> {
  // A Location that is no address (Location: http://[) fails the page, said, never the crawl (Fable's review, B4).
  let to: string;
  try {
    to = new URL(location, request.url()).href;
  } catch {
    if (nav) nav.failed = `answered ${status} with a Location that is no address: ${location.slice(0, 100)}`;
    return route.fulfill(EMPTY).catch(() => {});
  }
  if (nav) nav.redirect = { status, location: to };
  return route.fulfill(EMPTY);
}

/** Whether a request still has a frame: one of a window closed as it opened has none, and asking throws. */
function hasFrame(request: Request): boolean {
  try {
    request.frame();
    return true;
  } catch {
    return false;
  }
}

/** How deep in frames a request is: 0 for the page itself, 1 for a frame in it, and so on. */
function frameDepth(request: Request): number {
  let depth = 0;
  try {
    for (let f = request.frame().parentFrame(); f; f = f.parentFrame()) depth++;
  } catch {
    // A request with no frame (a service worker's): no depth.
  }
  return depth;
}

/** Routes every request of the crawl's browser context through routeRequest, with the crawl's state. */
export async function routeCrawl(context: BrowserContext, state: CrawlState): Promise<void> {
  // Playwright does not wait on a route's handler: an error escaping it would end the whole process. Any
  // that does fails the page being loaded, said, and the browser gets an empty page (Fable's review, B4).
  // Playwright 1.63 answers with a handle that takes the route off again; the crawl's route lasts as long as its context.
  await context.route('**/*', (route) => {
    // The load this request belongs to, as it arrives: what the router finds is written there, even late.
    const nav = state.current;
    return routeRequest(route, state, nav).catch((error: unknown) => {
      if (nav) nav.failed ??= `the crawl could not handle the answer: ${firstLine(error).slice(0, 200)}`;
      return route.fulfill(EMPTY).catch(() => {});
    });
  });
}
