/**
 * Why the crawl does not read a same-site address (lifted out of page-step.ts, which queues a page's links by it;
 * loop.ts asks it of a recrawl's previous pages).
 */
import { isActionLink, looksLikeNonHtml, looksLikeSignIn, pageKey, robotsPath, signInKind } from '../leaf/pages/url.js';
import type { CrawlRun } from './page-step.js';
import type { NotCrawledReason } from '../leaf/report.js';
import { isAllowed } from './robots.js';

/**
 * Why a same-site link is not followed, the first that holds, in order; none: it is queued. The login
 * crawl adds its own rows here (docs/LOGIN-PLAN.md), each with its NotCrawledReason.
 */
const REFUSALS: [NotCrawledReason, (run: Pick<CrawlRun, 'state' | 'inScope' | 'role'>, url: string) => boolean][] = [
  ['other-language', (run, url) => run.state.isOtherLanguage(url)],
  ['out-of-scope', (run, url) => !run.inScope(url)],
  ['not-html', (_run, url) => looksLikeNonHtml(url)],
  // Opening it changes the site (a cart filled): never followed, signed in or not (G-170).
  ['action', (_run, url) => isActionLink(url)],
  // Signed in, the account and admin areas are what the crawl is for; sign-in pages, logout and delete never (G-157).
  ['sign-in', (run, url) => looksLikeSignIn(url) && !(run.role && signInKind(url) === 'admin')],
  // A sign-in by another site that starts on the site (/auth/google): a person's to do, never the crawl's (G-261).
  ['sign-in', (run, url) => run.state.providerStarts.has(pageKey(url))],
  ['robots', (run, url) => !isAllowed(run.state.robots.policy, robotsPath(url))],
];

/** Why a same-site address is not read, as a link or as a page a recrawl asks for again (G-178); null: it is. */
// Decision: G-178
export function refusalOf(run: Pick<CrawlRun, 'state' | 'inScope' | 'role'>, url: string): NotCrawledReason | null {
  return REFUSALS.find(([, refuses]) => refuses(run, url))?.[0] ?? null;
}
