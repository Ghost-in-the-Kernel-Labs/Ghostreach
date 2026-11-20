/**
 * What a page draws after it has settled (TODO 38): on the second look, the browser's list of links and
 * controls is taken once the page is quiet and again H.LATE_LOOK_MS later. What is listed only the second
 * time appeared late: a control the first visit read too early to see. The controls reader reads the page
 * again then, so what it can reach is recorded; the rest is said, with where it lives. It records; it decides
 * nothing.
 */
import type { Page } from 'playwright';
import { H } from '../../leaf/heuristics/crawl.js';
import { notRecorded, recordedWords } from '../../leaf/pages/recorded.js';
import type { CrawledPage, PageControl } from '../../leaf/report.js';
import { readControls } from './controls.js';
import { listSeen, locateSeen, seenKey } from './seen.js';

/**
 * What appeared on a settled page within H.LATE_LOOK_MS (`seen` empty: nothing did), and how many entries past
 * the cap on either list were not compared; null when the browser would not say, so the page was not watched.
 */
export async function readLate(page: Page, entry: Pick<CrawledPage, 'controls' | 'frames'>): Promise<CrawledPage['late'] | null> {
  const before = await listSeen(page);
  if (!before) return null;
  await page.waitForTimeout(H.LATE_LOOK_MS);
  const after = await listSeen(page);
  if (!after) return null;
  const listed = new Set(before.seen.map(seenKey));
  const appeared = after.seen.filter((s) => !listed.has(seenKey(s)));
  const left = Math.max(before.left, after.left);
  const watched = { afterMs: H.LATE_LOOK_MS, seen: appeared, ...(left ? { left } : {}) };
  if (!appeared.length) return watched;
  // Read now, the controls the first visit did not record that are what the browser listed only late.
  const known = recordedWords(entry.controls, [], entry.frames).controls;
  const now = await readControls(page).catch(() => [] as PageControl[]);
  const controls = now.filter((c) => {
    const words = recordedWords([c], [], []);
    return words.controls.every((w) => !known.includes(w)) && appeared.some((a) => notRecorded([a], words).length === 0);
  });
  await locateSeen(page, notRecorded(appeared, recordedWords([...(entry.controls ?? []), ...controls], [], entry.frames)));
  return controls.length ? { ...watched, controls } : watched;
}
