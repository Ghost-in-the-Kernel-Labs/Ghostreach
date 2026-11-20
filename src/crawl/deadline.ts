/**
 * A page's reading, kept to a deadline (the hostile review's H4, G-268). A page whose script never stops after it
 * loads (for (;;) {}) keeps its renderer busy, and the page's every evaluate, its title too, never answers: one
 * page hung the crawl for good. Past READ_DEADLINE_MS the tab is closed, which ends every call waiting on it; the
 * page is recorded as read in part, saying why, and the crawl goes on in a fresh tab of the same context.
 */
import type { Page } from 'playwright';
import { abandonReading } from './abandoned.js';
import { LoadWatch } from './load-watch.js';
import type { CrawledPage } from '../leaf/report.js';
import type { CrawlRun } from './page-step.js';

/** A promise kept after `ms`, and its timer, to clear. */
function after(ms: number): { done: Promise<'late'>; clear: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const done = new Promise<'late'>((resolve) => (timer = setTimeout(() => resolve('late'), ms)));
  return { done, clear: () => clearTimeout(timer) };
}

/** How long a closing tab is waited on, and then what was reading it: closed, both end at once. Not a heuristic: only a bound. */
const CLOSE_WAIT_MS = 10_000; // not a heuristic: a bound on a close that ends calls at once

/**
 * `work` on `page`, kept to `ms`: null when it finished in time; else the page is closed (which ends every call
 * waiting on it), the work waited on a moment more, and a fresh page of the same context given back.
 */
// Decision: G-268
export async function givenUp(page: Page, work: Promise<unknown>, ms: number): Promise<Page | null> {
  const deadline = after(ms);
  const outcome = await Promise.race([work.then(() => 'done' as const, () => 'done' as const), deadline.done]);
  deadline.clear();
  if (outcome === 'done') return null;
  const context = page.context();
  const bound = after(CLOSE_WAIT_MS);
  await Promise.race([page.close({ runBeforeUnload: false }).catch(() => undefined), bound.done]);
  await Promise.race([work.catch(() => undefined), bound.done]);
  bound.clear();
  return context.newPage();
}

/** What is said of a page given up at the deadline. */
export const givenUpWhy = (ms: number) => `still busy ${Math.round(ms / 1000)} s after it loaded (a script that never stops): left, and the next page read in a fresh tab`;

/**
 * A fresh tab when the one the crawl reads in has closed under it: a page that took its tab down (a body of 100 MB of
 * spaces once did) left every page after it failing on the closed tab (item 52, step 4). False when the tab is open;
 * 'gone' when no tab can be had, the browser itself gone.
 */
async function freshTabIfClosed(run: CrawlRun): Promise<boolean | 'gone'> {
  if (!run.page.isClosed()) return false;
  const fresh = await run.page.context().newPage().catch(() => null);
  if (!fresh) return 'gone';
  run.page = fresh;
  if (run.watch) run.watch = new LoadWatch(run.page, run.watch.imagesSeen());
  run.log('  the tab the page before was read in had closed (the page took it down): the next page read in a fresh tab');
  return true;
}

/** True when the browser is gone: the crawl stops, keeping what it read, rather than failing every page after (item 52, step 4). */
export async function browserGone(run: CrawlRun): Promise<boolean> {
  if ((await freshTabIfClosed(run)) !== 'gone') return false;
  run.state.stop('too-many-errors');
  run.log('  the browser the crawl reads in is gone: the crawl stops, keeping what it read');
  return true;
}

/** True when the reading finished within the deadline; false when the tab was given up and replaced, the page said read in part. */
// Decision: G-268
export async function readWithin(run: CrawlRun, entry: CrawledPage, reading: Promise<void>): Promise<boolean> {
  const fresh = await givenUp(run.page, reading, run.readDeadlineMs);
  if (!fresh) return true;
  // Its readers run on (a promise cannot be cancelled): the role questions write nothing of what they learn after this (G-501).
  abandonReading(entry);
  const why = givenUpWhy(run.readDeadlineMs);
  entry.readerErrors = [...(entry.readerErrors ?? []), why];
  run.log(`  ${why}`);
  run.page = fresh;
  if (run.watch) run.watch = new LoadWatch(fresh, run.watch.imagesSeen());
  return false;
}
