/**
 * A site that sends an incomplete certificate chain (its server does not send the intermediate certificate): browsers repair it
 * (they fetch the missing certificate), Node's TLS does not, so the crawl's robots.txt request failed with "unable to verify the
 * first certificate" and the whole site was taken as unreachable although a browser loads it (Ghost's run of nuaxis.com, G-609).
 *
 * Ghost's ruling: retry only the robots.txt fetch with relaxed verification and note it, so the browser-based crawl can continue.
 * Everything else stays strictly verified: the pages (the browser's own verification), the sitemap, the probes.
 *
 * What it costs, said plainly (G-609): a man in the middle can forge a permissive robots.txt on that one request, and the crawl
 * might then read pages the owner disallows. The gate below detects an ERROR CLASS, not a property of the site: an attacker on the
 * path can produce UNABLE_TO_VERIFY_LEAF_SIGNATURE at will, so "only for sites whose chain is incomplete" is NOT a limit against
 * that attacker. It is accepted because it is limited to the robots.txt request (one GET, same origin, no other path), is logged,
 * recorded in the crawl report (`robots.certificateChain`) and reported (SITE-37), and the pages themselves are loaded under the
 * browser's own verification. The other common cause of the error is on the crawler's side: a TLS-intercepting proxy or antivirus
 * whose certificate authority the browser trusts but Node does not (NODE_EXTRA_CA_CERTS names the file that fixes that).
 */
import { request } from 'playwright';
import type { BrowserContext } from 'playwright';
import { guardedRequests, NotAsked, type Asker, type Resolve } from './destination.js';

/** A request client with certificate-chain checking relaxed, and the call that gives it up. It throws NotRelaxed when it must not be made. */
export type Relaxed = () => Promise<{ asker: Asker; dispose: () => Promise<void> }>;

/** The relaxed client is refused, for the reason in the message (a proxy it could not carry, a browser it cannot see into). */
export class NotRelaxed extends Error {}

/**
 * The two errors Node gives for a chain whose issuer it cannot find: UNABLE_TO_VERIFY_LEAF_SIGNATURE ("unable to verify the first
 * certificate") and UNABLE_TO_GET_ISSUER_CERT_LOCALLY ("unable to get local issuer certificate"). Decided by the error's code when it
 * has one; else by the FIRST LINE of its message only (Playwright's call log, and any address in it, are not read), the phrase
 * anchored whole after Playwright's own prefix. An expired, self-signed or wrong-name certificate, a refused connection, a name that
 * does not resolve and "unable to get issuer certificate" (UNABLE_TO_GET_ISSUER_CERT) are not this.
 */
// Decision: G-609
export function incompleteChain(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') return code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY';
  return /^(?:apiRequestContext\.\w+: )?(?:UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT_LOCALLY|unable to verify the first certificate|unable to get local issuer certificate)\s*$/i.test(error.message.split('\n')[0]);
}

/**
 * Why the relaxed client must not be made, or null. It is a fresh client: it carries none of the browser context's own settings
 * (a proxy, which a TLS-intercepting proxy is the other cause of this very error; cookies, and so a signed-in session, which is
 * the safer way). A proxy in the environment, or a browser the caller gave (it may carry a proxy this code cannot see), could not be
 * carried over, so there the retry is refused.
 * NOT detected: an operating-system or PAC proxy, which a browser the crawler launches itself may use (Node does not): there the
 * relaxed read may go direct (the log says so). NO_PROXY is ignored: a site exempt from the proxy is still refused, the safe side.
 * The crawl has no proxy option of its own (CrawlOptions, newCrawlContext and chromium.launch() carry none) to consult.
 */
// Decision: G-609
function relaxedRefusal(env: Record<string, string | undefined>, browserGiven: boolean): string | null {
  if (['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy'].some((name) => env[name])) return 'a proxy is set for this computer, and the relaxed request would not go through it';
  if (browserGiven) return 'the browser was given to the crawl and may use a proxy the relaxed request would not';
  return null;
}

/**
 * `raw` (a request client that does not verify the chain) kept to `origin` (scheme, host and port) and, for the first request, to
 * /robots.txt: a request, a redirect's hop included, to any other origin throws NotAsked and is never sent (same-origin redirects
 * to another path stay allowed: a robots.txt that moved); then the same destination guard as the strict client's (guardedRequests:
 * every hop followed there with the client's own redirects off, each looked up and each through the origin lock; a hop leading
 * further in than the site refused).
 */
// Decision: G-609
async function relaxedAsker(raw: Pick<BrowserContext['request'], 'get' | 'head'>, origin: string, resolve?: Resolve): Promise<Asker> {
  const same = (url: string) => new URL(url).origin === new URL(origin).origin;
  const kept = (method: 'get' | 'head') => async (url: string, options?: Parameters<typeof raw.get>[1]) => {
    if (!same(url)) throw new NotAsked(`not asked: ${new URL(url).origin} is not the site's origin, and the relaxed check of robots.txt stays on it`);
    return raw[method](url, options);
  };
  const guarded = await guardedRequests({ request: { get: kept('get'), head: kept('head') } as never }, origin, resolve);
  return {
    get: async (url, options) => {
      if (!same(url) || new URL(url).pathname !== '/robots.txt') throw new NotAsked('not asked: the relaxed client asks for /robots.txt only');
      return guarded.get(url, options);
    },
    head: async () => {
      throw new NotAsked('not asked: the relaxed client asks for /robots.txt only, with GET');
    },
  };
}

/** Playwright's request client for one fetch, `ignoreHTTPSErrors` on, same user agent, guarded and kept to `origin`; disposed by the caller. */
// Decision: G-609
export function openRelaxed(userAgent: string, origin: string, resolve?: Resolve, browserGiven = false, env: Record<string, string | undefined> = process.env): Relaxed {
  return async () => {
    const why = relaxedRefusal(env, browserGiven);
    if (why) throw new NotRelaxed(why);
    const context = await request.newContext({ ignoreHTTPSErrors: true, userAgent });
    try {
      return { asker: await relaxedAsker(context, origin, resolve), dispose: () => context.dispose() };
    } catch (e) {
      await context.dispose().catch(() => undefined);
      throw e;
    }
  };
}
