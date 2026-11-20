/**
 * What the second look says of the links and controls that appeared after a page had settled (TODO 38), and that it says
 * no credential a page gave in a name (TODO 71). The late reader is a fake: it answers what a browser's list would.
 */
import type { Browser } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import type { CrawledPage } from '../../src/leaf/report.js';
import { secondLook } from '../../src/crawl/second-look.js';

// Made up, and written in two pieces so the key scan (scripts/checks/secrets.py) never stops on its own fixture.
const KEY = ['Your API key:', 'FAKE-KEY-4417-NOT-REAL'].join(' ');
const late = (names: string[]) => ({ afterMs: 1, seen: names.map((name) => ({ role: 'link', name })) });
/** The lines about what appeared late: the look says others (what it looked at). */
const late_ = (m: string) => m.includes('appeared after');
let answer: ReturnType<typeof late> | null = null;

vi.mock('../../src/crawl/readers/late', () => ({ readLate: async () => answer }));

const ORIGIN = 'http://x.test';
const browser = (): Browser => {
  const page = {
    goto: async () => ({ status: () => 200 }),
    url: () => `${ORIGIN}/a`,
    evaluate: async (script: unknown) => (typeof script === 'function' || (typeof script === 'string' && script.includes('collectHeadings')) ? { headings: ['Form'], skipped: [] } : null),
    waitForLoadState: async () => undefined,
    close: async () => undefined,
    context: () => context,
  };
  const context = { route: async () => undefined, on: () => undefined, newPage: async () => page, close: async () => undefined };
  return { newContext: async () => context } as unknown as Browser;
};
const entry = () => ({ url: `${ORIGIN}/a`, finalUrl: `${ORIGIN}/a`, status: 200, redirects: [], headings: ['Form'] }) as unknown as CrawledPage;
const options = (said: string[]) => ({ userAgent: 'test', delayMs: 0, settleMs: 5, timeout: 1000, log: (m: string) => said.push(m), origin: ORIGIN, robots: { allowed: () => true } as never });

describe('the second look, of what appeared late', () => {
  it('says the first three, and how many more, with no credential in a name; the report has the marker', async () => {
    answer = late([KEY, 'Menu', 'Help', 'Contact']);
    const said: string[] = [];
    const page = entry();
    await secondLook(browser(), [page], options(said));
    expect(said.filter(late_)).toEqual(['  /a: 4 links or controls appeared after it had settled (link "[credential removed]", link "Menu", link "Help", ...)']);
    expect(page.late?.seen.map((s) => s.name)).toEqual(['[credential removed]', 'Menu', 'Help', 'Contact']);
  });

  it('says three without a "more" after them', async () => {
    answer = late(['Menu', 'Help', 'Contact']);
    const said: string[] = [];
    await secondLook(browser(), [entry()], options(said));
    expect(said.filter(late_)).toEqual(['  /a: 3 links or controls appeared after it had settled (link "Menu", link "Help", link "Contact")']);
  });

  it('says one in the singular, and a page with nothing late says nothing', async () => {
    answer = late(['Menu']);
    const said: string[] = [];
    await secondLook(browser(), [entry()], options(said));
    expect(said.filter(late_)).toEqual(['  /a: 1 link or control appeared after it had settled (link "Menu")']);
    answer = late([]);
    const none: string[] = [];
    const page = entry();
    await secondLook(browser(), [page], options(none));
    expect(none.filter(late_)).toEqual([]);
    expect(page.late).toEqual({ afterMs: 1, seen: [] });
  });
});
