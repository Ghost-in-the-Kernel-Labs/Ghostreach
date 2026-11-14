/**
 * The site's robots.txt asked for (lifted out of loop.ts): RFC 9309's reading of each answer, the wait and ask again after a
 * 5xx or a 429 (G-211), and the one relaxed second attempt for an incomplete certificate chain (G-609).
 */
import type { guardedRequests } from './destination.js';
import { incompleteChain, NotRelaxed, type Relaxed } from './relaxed-chain.js';
import { firstLine } from './error-line.js';
import { ALLOW_ALL, DISALLOW_ALL, parseRobots } from './robots.js';
import type { RobotsAnswer } from './state.js';
import { H as suiteH } from '../leaf/heuristics/suite.js';
import { ROBOTS_TOKENS } from '../leaf/report.js';


/**
 * The site's robots.txt, read as RFC 9309 says: rules when it answers, none on a 4xx, nothing allowed on
 * a 5xx or when the site cannot be reached. A 5xx or a 429 is asked again first, suiteH.ROBOTS_RETRIES times,
 * the wait doubling (or the server's Retry-After, up to a limit): a site waking up or overloaded answers
 * so for a while, and one bad moment should not end the crawl (Ghost's run of demo.owasp-juice.shop,
 * G-211). Still failing, nothing is crawled, as the RFC says.
 *
 * One exception (G-609, Ghost's ruling: "Retry only the robots.txt fetch with relaxed verification and note it, so the
 * browser-based crawl can continue"): when the first request fails with the error Node gives for a chain whose issuer it
 * cannot find (incompleteChain, relaxed-chain.ts; though browsers repair an incomplete chain), robots.txt is asked ONCE
 * more through `relaxed`: ONE GET, no waiting and no asking again, certificate-chain checking off, the same origin only, the
 * same destination guard, a short timeout, the client disposed after. Only when that read succeeds does the answer say
 * `certificateChain: 'incomplete'` and the log say so (2xx parsed, 4xx other than 429 no rules, as the strict read); any other
 * ending (3xx at the redirect limit, 1xx, 429, 5xx, an error) ends as before, with the FIRST error and the whole site disallowed.
 * The relaxed client goes direct and a proxy of the operating system or a PAC file is not detected (relaxedRefusal).
 * The gate detects an ERROR CLASS, not a property of the site: an attacker on the path can produce that error at will, and
 * could then forge a permissive robots.txt on that request (the crawl might read pages the owner disallows), so "only sites
 * with an incomplete chain" is NOT a limit against that attacker. Ghost accepts it because it is limited to one robots.txt
 * request, logged, recorded and reported (SITE-37), and the pages load under the browser's own verification.
 */
// Decision: G-021
export async function fetchRobots(
  request: Awaited<ReturnType<typeof guardedRequests>>,
  origin: string,
  timeout: number,
  log: (message: string) => void,
  firstWaitMs: number = suiteH.ROBOTS_RETRY_WAIT_MS,
  relaxed?: Relaxed,
): Promise<RobotsAnswer> {
  try {
    return await askRobots(request, origin, timeout, log, firstWaitMs);
  } catch (e) {
    // Usually the site itself can't be reached (a typo in the address, no network, DNS).
    const error = firstLine(e).replace(/^apiRequestContext\.get:\s*/, '');
    if (relaxed && incompleteChain(e)) {
      const second = await askRelaxed(relaxed, origin, timeout, log);
      if (second) return second;
    }
    log(`could not reach ${origin} (${error})`);
    return { policy: DISALLOW_ALL, status: null, error };
  }
}

/**
 * The relaxed second attempt at robots.txt (G-609): one GET, its answer with the chain noted, or null when it is refused or
 * fails (the first error then stands, and nothing is said of the chain). A client that may not be made says why in the log.
 */
// Decision: G-609
async function askRelaxed(relaxed: Relaxed, origin: string, timeout: number, log: (message: string) => void): Promise<RobotsAnswer | null> {
  let held: Awaited<ReturnType<Relaxed>> | undefined;
  try {
    held = await relaxed();
    // A short timeout, derived from the retry wait rather than a new limit (10 s at its default).
    const res = await held.asker.get(`${origin}/robots.txt`, { timeout: Math.min(timeout, suiteH.ROBOTS_RETRY_WAIT_MS * 2), maxRedirects: 5, failOnStatusCode: false });
    const status = res.status();
    // As the strict read: 2xx parsed, 4xx no rules; anything else (3xx at the redirect limit, 1xx, 429, 5xx) is no success, and the first error stands.
    const ok = status >= 200 && status < 300;
    if (!ok && !(status >= 400 && status < 500 && status !== 429)) return null;
    const answer = ok ? { policy: parseRobots(await res.text(), ROBOTS_TOKENS), status } : { policy: ALLOW_ALL, status };
    log(`As seen from this computer, the site's certificate chain is incomplete (${origin}: the server does not send its intermediate certificate), so robots.txt was read with relaxed checking. Browsers repair this but some tools do not. Another cause is a TLS-intercepting proxy or antivirus on this computer whose certificate authority the browser trusts but Node does not (NODE_EXTRA_CA_CERTS names the file that fixes that side). The relaxed read goes direct: an operating-system or PAC proxy is not detected, so a browser may reach the site through one that this read did not. The pages are still loaded with the browser's own checks; a man in the middle could have forged that robots.txt.`);
    return { ...answer, certificateChain: 'incomplete' };
  } catch (e) {
    if (e instanceof NotRelaxed) log(`robots.txt was not read again with relaxed checking: ${e.message}`);
    return null;
  } finally {
    await held?.dispose().catch(() => undefined);
  }
}

/** One reading of robots.txt through `request`, a 5xx or a 429 asked again; throws when the site cannot be reached. */
async function askRobots(request: Awaited<ReturnType<typeof guardedRequests>>, origin: string, timeout: number, log: (message: string) => void, firstWaitMs: number): Promise<RobotsAnswer> {
  const url = `${origin}/robots.txt`;
  let res = await request.get(url, { timeout, maxRedirects: 5, failOnStatusCode: false });
  for (let attempt = 0, wait = firstWaitMs; attempt < suiteH.ROBOTS_RETRIES && (res.status() >= 500 || res.status() === 429); attempt++, wait *= 2) {
    const told = Number(res.headers()['retry-after']);
    const ms = Number.isFinite(told) && told > 0 ? Math.min(told * 1000, suiteH.ROBOTS_RETRY_WAIT_MS * 4) : wait;
    log(`robots.txt answered ${res.status()}; asking again in ${Math.round(ms / 1000)} s (a site waking up or busy answers so for a while)`);
    await new Promise((r) => setTimeout(r, ms));
    res = await request.get(url, { timeout, maxRedirects: 5, failOnStatusCode: false });
  }
  const status = res.status();
  if (status >= 200 && status < 300) return { policy: parseRobots(await res.text(), ROBOTS_TOKENS), status };
  // RFC 9309: 4xx means there are no rules; 5xx means the site is unreachable, so crawl nothing.
  if (status >= 400 && status < 500) return { policy: ALLOW_ALL, status };
  log(`robots.txt answered ${status}; treating the whole site as disallowed`);
  return { policy: DISALLOW_ALL, status };
}
