/**
 * The second look marks a field whose value it reads differently (G-322), with a browser that is only an object: the page
 * answers the three things the look asks of it. test/crawl/prefilled.spec.ts runs the same in a real browser.
 */
import type { Browser } from 'playwright';
import { describe, expect, it } from 'vitest';
import type { CrawledPage, PageControl } from '../../src/leaf/report.js';
import { secondLook } from '../../src/crawl/second-look.js';

const field = (value: string | undefined): PageControl => ({ kind: 'text field', words: ['Token'], region: 'main', xpath: "//input[@id='t']", stability: 'Strong', ...(value === undefined ? {} : { value }) });

/** A browser whose page, opened at any address, shows `headings` and the controls `again`. */
function browserShowing(headings: string[], again: PageControl[]): Browser {
  const page = {
    waitForLoadState: async () => {},
    goto: async () => ({ status: () => 200 }),
    url: () => 'http://x.test/form',
    // The headings reader is a function, the controls and consent readers are scripts.
    evaluate: async (script: unknown) => (typeof script === 'function' || (typeof script === 'string' && script.includes('collectHeadings')) ? { headings, skipped: [] } : String(script).includes('__forecursorControls') ? again : null),
    close: async () => undefined,
    context: () => context,
  };
  const context = { route: async () => undefined, on: () => undefined, newPage: async () => page, close: async () => undefined };
  return { newContext: async () => context } as unknown as Browser;
}

const entry = (over: Partial<CrawledPage>) => ({ url: 'http://x.test/form', finalUrl: 'http://x.test/form', status: 200, redirects: [], headings: ['Form'], ...over }) as unknown as CrawledPage;
const options = { userAgent: 'test', delayMs: 0, settleMs: 0, timeout: 1000, log: () => undefined, origin: 'http://x.test', robots: { allowed: () => true } as never };

describe('the second look marks the fields whose value it reads differently', () => {
  it('marks a value that differs, and only that one', async () => {
    const page = entry({ controls: [field('visit-1'), { ...field('same'), xpath: '//b' }] });
    await secondLook(browserShowing(['Form'], [field('visit-2'), { ...field('same'), xpath: '//b' }]), [page], options);
    expect(page.controls?.map((c) => c.changes)).toEqual([true, undefined]);
  });

  it('marks nothing when the second reading is the same', async () => {
    const page = entry({ controls: [field('a')] });
    await secondLook(browserShowing(['Form'], [field('a')]), [page], options);
    expect(page.controls?.[0].changes).toBeUndefined();
  });

  it('reads a page that has no controls without marking anything, and still notes its headings', async () => {
    const page = entry({});
    const looked = await secondLook(browserShowing(['Other'], [field('a')]), [page], options);
    expect(looked).toEqual({ looked: 1, differed: 1 });
    expect(page.secondLook).toEqual({ headings: ['Other'] });
    expect(page.controls).toBeUndefined();
  });
});
