/**
 * Loading one page of a crawl (page-step.ts's first step): following redirects one hop at a time, each checked against
 * robots.txt, and trying once more a page that gave no answer. Moved out of page-step.ts, unchanged, to keep each file
 * under the largest-file target (docs/AGENT.md).
 */
import type { Response } from 'playwright';
import { firstLine } from './error-line.js';
import { openPage } from './open.js';
import { documentUrl, normalizeUrl, pageKey, robotsPath } from '../leaf/pages/url.js';
import type { FrontierItem } from './frontier.js';
import { judgeRedirect } from './redirects.js';
import type { CrawledPage } from '../leaf/report.js';
import { isAllowed } from './robots.js';
import type { CrawlRun } from './page-step.js';

/** No answer at all: a timeout, or a connection dropped or refused; never a status, which is an answer. */
// Decision: G-200
export function isNoAnswer(error: string): boolean {
  return /Timeout \d+ms exceeded|net::ERR_(CONNECTION_(RESET|CLOSED|REFUSED|ABORTED|TIMED_OUT)|EMPTY_RESPONSE|TIMED_OUT|NETWORK_CHANGED)|socket hang up|ECONNRESET|ECONNREFUSED|no response/i.test(error);
}

/**
 * A page that gave no answer on its first try: says so and asks for one more (G-200). A server asleep (a
 * free hosting plan, the-internet.herokuapp.com's) wakes on the first visit, which can take longer than
 * the wait (Ghost's run, 2026-10-02); a dropped connection is often the network's moment. Once only: a
 * page that answered an error status is never tried again, it answered.
 */
export function triedAgain(run: CrawlRun, mayTryAgain: boolean, error: string): boolean {
  if (!mayTryAgain || !isNoAnswer(error)) return false;
  run.log(/Timeout/.test(error) ? `  no answer within ${Math.round(run.timeout / 1000)} s; trying once more (a server waking up can take that long)` : `  no answer (${error}); trying once more`);
  return true;
}

/** A page loaded: its report entry, the answer, and whether robots.txt disallowed where a redirect led (the entry's error says it in words). */
export interface LoadedPage {
  entry: CrawledPage;
  response: Response | null;
  refusedByRobots: boolean;
}

/** One redirect hop's outcome: the address to request next, or the load ends here, `refused-by-robots` when robots.txt disallows where it leads. */
type Hop = { next: string } | { end: 'refused-by-robots' | 'ended' };

/**
 * Loads a page, following redirects one hop at a time (each checked against robots.txt before it is
 * requested), into its report entry; null when the address is served as a file download (a PDF with
 * no .pdf extension, say), recorded as not crawled. The start page may move the crawl to another
 * origin, with its own robots.txt.
 */
export async function loadPage(run: CrawlRun, item: FrontierItem): Promise<LoadedPage | null> {
  const { state } = run;
  const entry: CrawledPage = {
    url: item.url,
    finalUrl: item.url,
    status: null,
    redirects: [],
    title: '',
    contentType: null,
    depth: item.depth,
    fingerprint: null,
  };
  const isStart = state.pages.length === 0;
  let tried = false;
  let response: Response | null = null;
  let refusedByRobots = false;
  for (let current = item.url; ; ) {
    // The key is the document the site is asked for: a route's address is, to the router, its page without the fragment (G-306).
    const nav = state.navigate(pageKey(documentUrl(current)));
    try {
      response = await openPage(run.page, current, run.timeout, tried, run.watch);
    } catch (error) {
      if (firstLine(error).includes('Download is starting')) {
        // Served as a file download (a PDF with no .pdf extension, say). Not a page.
        state.skip(current, 'not-html');
        state.responded();
        return null;
      }
      if (triedAgain(run, !tried, firstLine(error))) {
        tried = true;
        continue;
      }
      entry.error = firstLine(error);
      break;
    }
    // The site stopped answering: the router could not fetch the page (router.ts).
    const failedFetch = nav.failed;
    if (failedFetch) {
      if (triedAgain(run, !tried, failedFetch)) {
        tried = true;
        continue;
      }
      entry.error = failedFetch;
      response = null;
      break;
    }
    const redirect = nav.redirect;
    if (!redirect) {
      entry.finalUrl = current;
      break;
    }

    const hop = await followRedirect(run, entry, redirect, current, isStart);
    if ('end' in hop) {
      refusedByRobots = hop.end === 'refused-by-robots';
      break;
    }
    current = hop.next;
  }
  return { entry, response, refusedByRobots };
}

/**
 * One redirect hop of a page load, recorded on its entry and judged (redirects.ts): the address to
 * request next, or the load ends here (an error, off the site, disallowed by robots.txt, said by its
 * own end, or a page already read). The start page may move the crawl to another origin, with its own robots.txt.
 */
async function followRedirect(run: CrawlRun, entry: CrawledPage, redirect: { status: number; location: string }, current: string, isStart: boolean): Promise<Hop> {
  const { state, log } = run;
  entry.redirects.push({ url: current, status: redirect.status });
  entry.finalUrl = normalizeUrl(redirect.location) ?? redirect.location;
  const verdict = judgeRedirect(entry.redirects, redirect.location, state.origin, isStart, state.offline);
  if ('error' in verdict) {
    entry.error = verdict.error;
    // The start page's move offline: no crawl to build from, as when the start page gives no answer (G-335).
    if (verdict.fatal) state.fail(verdict.error);
    return { end: 'ended' };
  }
  if ('offSite' in verdict) {
    entry.offSite = true; // never requested: not our site
    return { end: 'ended' };
  }
  const next = verdict.follow;
  if (verdict.movedTo) {
    // The site lives where the start page lands: crawl that origin, and obey its robots.txt.
    state.moveTo(verdict.movedTo);
    state.readRobots(await run.robotsFor(state.origin));
    log(`  site moved to ${state.origin}`);
  }
  if (!isAllowed(state.robots.policy, robotsPath(next))) {
    state.skip(next, 'robots');
    entry.error = 'redirects to a URL that robots.txt disallows';
    return { end: 'refused-by-robots' };
  }
  state.markSeen(pageKey(next));
  const known = state.crawledFinal.get(pageKey(next));
  if (known !== undefined) {
    entry.duplicateOf = known; // already read; no need to request it again
    return { end: 'ended' };
  }
  return { next };
}
