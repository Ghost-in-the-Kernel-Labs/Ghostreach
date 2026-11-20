/**
 * The crawl marks what a page gave as a credential in its report entry when the page has been read (TODO 71), on fakes: a
 * browser page that is only an object, the title it answers and the load samples the watch reports. The same in a real
 * browser, signed in, in three frameworks: test/crawl/login-crawl.spec.ts. The made-up key is shaped like no real one.
 */
import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import { readSignInPage, visit, type CrawlRun } from '../../src/crawl/page-step.js';
import { readLinks } from '../../src/crawl/readers/links.js';
import { secondLook } from '../../src/crawl/second-look.js';
import { CrawlState } from '../../src/crawl/state.js';
import type { CrawledPage } from '../../src/leaf/report.js';
import type { Browser } from 'playwright';

const ORIGIN = 'http://site.test';
// Made up, and written in two pieces so the key scan (scripts/checks/secrets.py) never stops on its own fixture.
const KEY = ['Your API key:', 'FAKE-KEY-4417-NOT-REAL'].join(' ');

describe('a page read by the crawl', () => {
  async function visited(title: string, watch: unknown) {
    const state = new CrawlState(`${ORIGIN}/`, 8);
    const page = {
      isClosed: () => false,
      url: () => `${ORIGIN}/`,
      goto: async () => ({ status: () => 200, headers: () => ({ 'content-type': 'text/html' }) }),
      title: async () => title,
      waitForLoadState: async () => undefined,
      evaluate: async () => {
        throw new Error('not a browser');
      },
    } as unknown as Page;
    const run = { page, state, frontier: { add: () => undefined, recordSample: () => undefined, recordLinks: () => undefined }, inScope: () => true, log: () => undefined, timeout: 1000, settleMs: 0, maxConsecutiveErrors: 5, readDeadlineMs: 1000, watch } as unknown as CrawlRun;
    expect(await visit(run, { url: `${ORIGIN}/`, depth: 0 } as never)).toBe('next');
    return state.pages[0];
  }

  it('has the marker for a sentence that gives a credential in its title and in what its load reported, and its words that name a password as they were', async () => {
    const watch = { reset: () => undefined, read: async () => ({ scriptErrors: { count: 1, first: [KEY] }, failed: { count: 1, first: ['/app.js (404)'] } }) };
    const entry = await visited(`  Account.   ${KEY} `, watch);
    expect(entry.title).toBe('Account. [credential removed]');
    expect(entry.load).toEqual({ scriptErrors: { count: 1, first: ['[credential removed]'] }, failed: { count: 1, first: ['/app.js (404)'] } });
    const kept = await visited('Forgot password?', { reset: () => undefined, read: async () => undefined });
    expect(kept.title).toBe('Forgot password?');
    expect('load' in kept).toBe(false);
    // A crawl that watches no load (the watch is optional) has none to mark.
    const unwatched = await visited('Forgot password?', undefined);
    expect('load' in unwatched).toBe(false);
  });
});

describe('a sign-in link opened to read its form', () => {
  it('has the title, which is evidence of an admin form, with the marker for a sentence that gives a credential', async () => {
    const state = new CrawlState(`${ORIGIN}/`, 8);
    const form = { form: null, username: null, password: { xpath: '//input[@id="p"]', words: ['Password'] }, submit: null };
    const page = {
      isClosed: () => false,
      url: () => `${ORIGIN}/staff`,
      goto: async () => ({ status: () => 200 }),
      title: async () => ` Admin sign in.  ${KEY} `,
      waitForLoadState: async () => undefined,
      evaluate: async (script: unknown) => (typeof script === 'string' && script.includes('__forecursorLoginForms') ? [form] : []),
    } as unknown as Page;
    await readSignInPage({ page, state, log: () => undefined, timeout: 1000, settleMs: 0 } as unknown as CrawlRun, `${ORIGIN}/staff`);
    expect(state.loginForms.map((f) => [f.role, f.evidence])).toEqual([['admin', ['words "Admin sign in. [credential removed]"']]]);
  });
});

describe('a sign-in link opened a second time', () => {
  const opened = async (failures: number) => {
    const state = new CrawlState(`${ORIGIN}/`, 8);
    const gotos: string[] = [];
    let failed = 0;
    const page = {
      isClosed: () => false,
      url: () => `${ORIGIN}/staff`,
      goto: async (url: string) => {
        gotos.push(url);
        if (url !== 'about:blank' && failed < failures) { failed++; throw new Error('page.goto: Timeout 1000ms exceeded.'); }
        return { status: () => 200 };
      },
      title: async () => 'Sign in',
      waitForLoadState: async () => undefined,
      evaluate: async () => [],
    } as unknown as Page;
    await readSignInPage({ page, state, log: () => undefined, timeout: 1000, settleMs: 0 } as unknown as CrawlRun, `${ORIGIN}/staff`);
    return gotos;
  };

  it('starts the first try on the page as it is, and the second, after a timeout, from an empty page', async () => {
    expect(await opened(0)).toEqual([`${ORIGIN}/staff`]);
    expect(await opened(1)).toEqual([`${ORIGIN}/staff`, 'about:blank', `${ORIGIN}/staff`]);
    // Tried once more only once: a second timeout leaves the page unread.
    expect(await opened(2)).toEqual([`${ORIGIN}/staff`, 'about:blank', `${ORIGIN}/staff`]);
  });
});

describe('the second look', () => {
  const entry = (over: Partial<CrawledPage>) => ({ url: `${ORIGIN}/a`, finalUrl: `${ORIGIN}/a`, status: 200, redirects: [], headings: ['Form'], ...over }) as unknown as CrawledPage;
  const browserShowing = (headings: string[]): Browser => {
    const page = {
      waitForLoadState: async () => undefined,
      goto: async () => ({ status: () => 200 }),
      url: () => `${ORIGIN}/a`,
      evaluate: async (script: unknown) => (typeof script === 'function' || (typeof script === 'string' && script.includes('collectHeadings')) ? { headings, skipped: [] } : null),
      close: async () => undefined,
      context: () => context,
    };
    const context = { route: async () => undefined, on: () => undefined, newPage: async () => page, close: async () => undefined };
    return { newContext: async () => context } as unknown as Browser;
  };
  const options = { userAgent: 'test', delayMs: 0, settleMs: 0, timeout: 1000, log: () => undefined, origin: ORIGIN, robots: { allowed: () => true } as never };

  it('has the marker in the headings it sets and in the words it finds the first reading kept, and says no credential in its log', async () => {
    const said: string[] = [];
    const page = entry({ headings: [KEY] });
    const looked = await secondLook(browserShowing([KEY, 'Other']), [page], { ...options, log: (m: string) => said.push(m) });
    expect(looked).toEqual({ looked: 1, differed: 1 });
    expect(page.secondLook).toEqual({ headings: ['[credential removed]', 'Other'] });
    expect(page.headings).toEqual(['[credential removed]']);
    expect(said.join('\n')).not.toContain('FAKE-KEY');
    expect(said.filter((m) => m.includes('read differently'))).toEqual(['  /a read differently: new headings appeared']);
  });

  it('says in its log which headings were not there the second time, the one that gave a credential as the marker', async () => {
    const said: string[] = [];
    const page = entry({ headings: [KEY, 'Old'] });
    await secondLook(browserShowing(['Other']), [page], { ...options, log: (m: string) => said.push(m) });
    expect(page.secondLook).toEqual({ headings: ['Other'] });
    expect(said.filter((m) => m.includes('read differently'))).toEqual(['  /a read differently: "[credential removed]", "Old" not there the second time']);
  });

  it('does not take a heading that gives a credential for a change: the same page twice reads the same', async () => {
    const page = entry({ headings: ['[credential removed]'] });
    expect(await secondLook(browserShowing([KEY]), [page], options)).toEqual({ looked: 1, differed: 0 });
    expect(page.secondLook).toBeUndefined();
  });
});

describe('the readers', () => {
  const link = (text: string) => ({ href: '/a', resolved: `${ORIGIN}/a`, text, hidden: false, region: 'main', trigger: { tag: 'button', text }, innerTriggers: [{ href: '/b', text }], newTab: false });

  it('a link has the marker for the sentence that gives a credential in its words, the opener of its dropdown too; one that names a password as it was', async () => {
    const page = { evaluate: async () => [link(KEY), link('Forgot password?'), { ...link('x'), trigger: null, innerTriggers: [] }] } as unknown as Page;
    const read = await readLinks(page);
    expect(read.map((l) => l.text)).toEqual(['[credential removed]', 'Forgot password?', 'x']);
    expect(read[0].trigger).toEqual({ tag: 'button', text: '[credential removed]' });
    expect(read[0].innerTriggers).toEqual([{ href: '/b', text: '[credential removed]' }]);
    expect(read[2].trigger).toBeNull();
  });
});
