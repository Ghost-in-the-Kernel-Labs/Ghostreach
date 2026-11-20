/**
 * Why the crawl does not read a same-site address (lifted out of page-step.ts, which queues a page's links by it).
 */
import { isActionLink, looksLikeNonHtml, looksLikeSignIn, pageKey, robotsPath } from '../leaf/pages/url.js';
import type { CrawlRun } from './page-step.js';
import type { NotCrawledReason } from '../leaf/report.js';
import { isAllowed } from './robots.js';

/** Why a same-site link is not followed, the first that holds, in order; none: it is queued. */
const REFUSALS: [NotCrawledReason, (run: Pick<CrawlRun, 'state'>, url: string) => boolean][] = [
  ['other-language', (run, url) => run.state.isOtherLanguage(url)],
  ['not-html', (_run, url) => looksLikeNonHtml(url)],
  // Opening it changes the site (a cart filled): never followed (G-170).
  ['action', (_run, url) => isActionLink(url)],
  // The crawl reads the public site: sign-in pages, account areas, logout and delete never (G-157).
  ['sign-in', (_run, url) => looksLikeSignIn(url)],
  // A sign-in by another site that starts on the site (/auth/google): a person's to do, never the crawl's (G-261).
  ['sign-in', (run, url) => run.state.providerStarts.has(pageKey(url))],
  ['robots', (run, url) => !isAllowed(run.state.robots.policy, robotsPath(url))],
];

/** Why a same-site address is not read as a link (G-178); null: it is. */
// Decision: G-178
export function refusalOf(run: Pick<CrawlRun, 'state'>, url: string): NotCrawledReason | null {
  return REFUSALS.find(([, refuses]) => refuses(run, url))?.[0] ?? null;
}
