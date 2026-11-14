/**
 * A sentence that gives a credential is a marker in a saved page and in the crawl report (TODO 71), as an email address
 * is email@example.com (G-197). The values are made up and shaped like no real key or password. The parent's saved-page cases
 * (`savedPageWithoutCredentials`, never copied: no page is saved) were dropped at 1.4.
 */
import { describe, expect, it } from 'vitest';
import { markCredentialsIn } from '../../src/crawl/credentials-entry.js';
import type { CrawledPage } from '../../src/leaf/report.js';
import { CREDENTIAL_MARKER, markCredentials } from '../../src/leaf/pages/credential-text.js';

// Made up, and written in two pieces so the key scan (scripts/checks/secrets.py) never stops on its own fixture.
const KEY = ['Your API key:', 'FAKE-KEY-4417-NOT-REAL'].join(' ');

describe('markCredentials', () => {
  it('replaces the sentence that gives a credential, and nothing else, spacing kept', () => {
    expect(markCredentials('Welcome. Password: hunter2 Next step. Then log out.')).toBe(`Welcome. ${CREDENTIAL_MARKER} Then log out.`);
    expect(markCredentials(KEY)).toBe(CREDENTIAL_MARKER);
    expect(markCredentials('Welcome.  The password is Pa55word!\nThen log out.')).toBe(`Welcome.  ${CREDENTIAL_MARKER}\nThen log out.`);
  });

  it('keeps the words of a page that only names a password, and a text already marked is the same text', () => {
    for (const kept of ['Password', 'Forgot password?', 'Your password is required', 'Reset your password. Then sign in.', '', '  ']) expect(markCredentials(kept), kept).toBe(kept);
    expect(markCredentials(markCredentials(KEY))).toBe(CREDENTIAL_MARKER);
  });
});

describe('a page with a very long text', () => {
  it('is read in one pass: words that begin an instruction, 60000 of them, take a moment and not minutes', () => {
    const long = 'enter x '.repeat(60000);
    const started = Date.now();
    expect(markCredentials(long)).toBe(long);
    expect(Date.now() - started).toBeLessThan(3000);
    // The value and what it is for are within 200 characters of each other, in one sentence.
    expect(markCredentials(`Enter admin ${'and so on '.repeat(10)}for the password`)).toBe(CREDENTIAL_MARKER);
    expect(markCredentials(`Enter admin ${'and so on '.repeat(40)}for the password`)).toContain('Enter admin');
  });
});

describe("a page's report entry", () => {
  const control = (words: string[], form?: string) => ({ kind: 'text field', words, region: 'main' as const, ...(form ? { form } : {}), ...(form ? { options: [form] } : {}), xpath: "//input[@id='k']", stability: 'Strong' as const });
  const frame = (key: string) => ({ path: ['f'], url: null, sameSite: true, shown: true, title: key, width: 1, height: 1, headings: [key, 'Password'], links: [{ href: '/', text: key }], controls: [control([key, 'Password'], key)] });
  const entryWith = (key: string) =>
    ({
      url: 'http://x.test/a', finalUrl: 'http://x.test/a', status: 200, redirects: [], title: 'Account', contentType: 'text/html', depth: 0, fingerprint: null,
      headings: [key, 'Password'], skippedHeadings: [key], structure: { h1: [key], main: true }, controls: [control([key, 'Password'], key)],
      seen: [{ role: 'link', name: key }], secondLook: { headings: [key] },
      late: { afterMs: 1, seen: [{ role: 'link', name: key }], controls: [control([key], key)] },
      markup: { lang: 'en', viewport: null, description: key, placeholder: { count: 1, first: [key] }, unnamed: { count: 2, first: [key, 'x'] } },
      load: { scriptErrors: { count: 1, first: [key] }, failed: { count: 1, first: ['/a.js (404)'] } },
      frames: [frame(key), { path: ['g'], url: 'http://x.test/g', sameSite: true, shown: true, title: null, width: 1, height: 1 }],
    }) as unknown as CrawledPage;

  it('has the marker in each of its words, and the rest of the entry as it was', () => {
    const entry = entryWith(KEY);
    markCredentialsIn(entry);
    expect(entry).toEqual(entryWith(CREDENTIAL_MARKER));
    expect(entry.headings).toEqual([CREDENTIAL_MARKER, 'Password']);
  });

  it('leaves a page that names a password as it was, and one with only what the reader left (no title, no words)', () => {
    const kept = entryWith('Forgot password?');
    markCredentialsIn(kept);
    expect(kept).toEqual(entryWith('Forgot password?'));
    const bare = { url: 'u', finalUrl: 'u', status: 200, redirects: [], title: '', contentType: null, depth: 0, fingerprint: null } as CrawledPage;
    markCredentialsIn(bare);
    expect(bare).toStrictEqual({ url: 'u', finalUrl: 'u', status: 200, redirects: [], title: '', contentType: null, depth: 0, fingerprint: null });
    // A markup with no description and a load with no samples: nothing is made up for them.
    const sparse = { ...bare, markup: { lang: null, viewport: null, description: null }, load: { firstByteMs: 200 } } as CrawledPage;
    markCredentialsIn(sparse);
    expect(sparse).toStrictEqual({ ...bare, markup: { lang: null, viewport: null, description: null }, load: { firstByteMs: 200 } });
  });
});
