/**
 * The second look (docs/STRATEGIES-PLAN.md): after the crawl, pages are loaded once more, in a fresh browser context (no cookies, like a generated test starting), and
 * its headings read again. A page that shows something else the second time (an A/B test, a random
 * banner, a counter) records what it showed. Each page is then watched H.LATE_LOOK_MS more, for links and
 * controls drawn only after it had settled (readers/late.ts, TODO 38). The crawl records; the model decides
 * what that means for the suite (src/model/checks.ts, src/group/unread.ts).
 *
 * Polite like the crawl: the same delay between loads, pages already allowed by robots.txt, images
 * and fonts not downloaded, at most H.SECOND_LOOK_MAX_PAGES. A page that lands somewhere else, or
 * fails, the second time is left as it was read.
 */
import { newCrawlContext } from './context.js';
import { openPage } from './open.js';
import type { Browser, Page } from 'playwright';
import { givenUp, givenUpWhy } from './deadline.js';
import { H } from '../leaf/heuristics/crawl.js';
import { addressPath, urlPattern } from '../leaf/pages/url.js';
import { collectHeadingsOf, unseenHeadings } from './readers/headings.js';
import { CONSENT_SELECTORS, consentBannerOn } from './readers/consent.js';
import type { CrawledPage } from '../leaf/report.js';
import { seenHeadings } from './report-read.js';
import { disallowedDocument, notFetched } from './router.js';
import type { RobotsPolicy } from './robots.js';
import { readLate } from './readers/late.js';
import { readControls } from './readers/controls.js';
import { markCredentials } from '../leaf/pages/credential-text.js';
import { markCredentialsIn } from './credentials-entry.js';
import { markChangingValues } from './values.js';
import { settlePage } from './settle.js';
import { pageKey } from '../leaf/pages/url.js';

export interface SecondLookOptions {
  userAgent: string;
  delayMs: number;
  settleMs: number;
  timeout: number;
  log: (message: string) => void;
  /** The site and its robots.txt: a frame of an address it disallows is not asked for the second time either. */
  origin: string;
  robots: RobotsPolicy;
  /** How long one page may take before its tab is given up (G-268). Default H.READ_DEADLINE_MS. */
  readDeadlineMs?: number;
  /** The crawl's browser guard (G-270): a request it refuses is not sent the second time either. */
  inward?: (url: string) => Promise<string | null>;
}

/**
 * The pages a second look loads, in crawl order, at most H.SECOND_LOOK_MAX_PAGES: every page read,
 * except that an address pattern with a fixed part (/pokedex/*: a family's) gets two, which show
 * whether its headings change as well as all of them would. Top-level pages (/about, /abtest) share
 * the pattern /* and nothing else: each is its own.
 */
function secondLookPages(pages: readonly CrawledPage[]): CrawledPage[] {
  const read = pages.filter((p) => p.headings && !p.duplicateOf && !p.offSite && !p.error && p.status !== null && p.status < 400);
  const looks = new Map<string, number>();
  const chosen: CrawledPage[] = [];
  for (const p of read) {
    const pattern = urlPattern(p.finalUrl);
    const fixed = pattern.split('?')[0].split('/').some((s) => s && s !== '*' && s !== '{n}');
    const key = fixed ? pattern : addressPath(p.finalUrl);
    if ((looks.get(key) ?? 0) >= 2) continue;
    looks.set(key, (looks.get(key) ?? 0) + 1);
    chosen.push(p);
    if (chosen.length >= H.SECOND_LOOK_MAX_PAGES) break;
  }
  return chosen;
}

/** Looks at each page again; sets `secondLook` on those that read differently. Returns how many did. */
// Decision: G-024
export async function secondLook(browser: Browser, pages: readonly CrawledPage[], options: SecondLookOptions): Promise<{ looked: number; differed: number }> {
  const chosen = secondLookPages(pages);
  if (!chosen.length) return { looked: 0, differed: 0 };
  options.log('');
  options.log(`Second look at ${chosen.length} page${chosen.length === 1 ? '' : 's'}, in a fresh browser, for what changes between visits:`);
  const context = await newCrawlContext(browser, options.userAgent);
  let differed = 0;
  try {
    await context.route('**/*', async (route) => {
      // The crawl's browser guard too (G-270): nothing further in than the site, the second time either.
      const inward = options.inward ? await options.inward(route.request().url()).catch(() => null) : null;
      return notFetched(route.request()) || inward || disallowedDocument(route.request(), options.origin, options.robots) ? route.abort() : route.continue();
    });
    let page = await context.newPage();
    const deadline = options.readDeadlineMs ?? H.READ_DEADLINE_MS;
    for (const [i, entry] of chosen.entries()) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      // Progress like the crawl's own: a quiet minute reads as a hang (Ghost, 2026-09-29).
      options.log(`[${i + 1}/${chosen.length}] second look: ${entry.finalUrl}`);
      // A page that never stops is given up at the deadline, as in the crawl (G-268): its first reading stands.
      const fresh = await givenUp(page, lookAgain(page, entry, options).then((d) => (differed += d ? 1 : 0)), deadline);
      if (fresh) {
        page = fresh;
        options.log(`  ${givenUpWhy(deadline)}; its first reading stands`);
      }
    }
  } finally {
    await context.close();
  }
  return { looked: chosen.length, differed };
}

/** One page looked at again: true when it read differently, its second reading set on it; false otherwise, or when unreachable. */
async function lookAgain(page: Page, entry: CrawledPage, options: SecondLookOptions): Promise<boolean> {
  try {
    const address = entry.finalUrl;
    const response = await openPage(page, address, options.timeout);
    if (!response || response.status() >= 400 || pageKey(page.url()) !== pageKey(address)) return false;
    // Scrolled through as the first read was (G-747): a section drawn only when scrolled to is not gone the second time.
    await settlePage(page, options.settleMs);
    const { headings, skipped } = await collectHeadingsOf(page);
    // A field that holds another value this time (a token, a time) is marked: a test does not check its value (G-322).
    if (entry.controls) markChangingValues(entry.controls, await readControls(page));
    // Not watched when no settle is given (settleMs 0: a test's).
    const late = options.settleMs > 0 ? await readLate(page, entry) : null;
    if (late) entry.late = late;
    // Before anything is said of what it read: the log is a file someone keeps (TODO 71).
    markCredentialsIn(entry);
    if (entry.late?.seen.length) {
      const names = entry.late.seen.map((l) => `${l.role} "${l.name}"`);
      options.log(`  ${new URL(entry.finalUrl).pathname}: ${names.length} link${names.length === 1 ? '' : 's'} or control${names.length === 1 ? '' : 's'} appeared after it had settled (${names.slice(0, 3).join(', ')}${names.length > 3 ? ', ...' : ''})`);
    }
    const banner = await consentBannerOn(page, CONSENT_SELECTORS);
    const now = seenHeadings(unseenHeadings(headings, skipped, banner?.headings ?? [])) ?? [];
    const before = seenHeadings(entry) ?? [];
    // As the entry's own headings were (they are marked), or the same page twice would read differently.
    const marked = now.map(markCredentials);
    if (sameSet(marked, before)) return false;
    entry.secondLook = { headings: marked };
    const gone = before.filter((h) => !marked.includes(h));
    options.log(`  ${new URL(entry.finalUrl).pathname} read differently: ${gone.map((h) => `"${h}"`).join(', ') || 'new headings'} ${gone.length ? 'not there the second time' : 'appeared'}`);
    return true;
  } catch {
    // Unreachable the second time: the first reading stands.
    return false;
  }
}

function sameSet(a: string[], b: string[]): boolean {
  const s = new Set(a);
  return a.length === b.length && b.every((x) => s.has(x));
}
