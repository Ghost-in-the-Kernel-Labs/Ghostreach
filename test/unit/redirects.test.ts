/** What each redirect hop means for the page being loaded (src/crawl/redirects.ts). */
import { describe, expect, it } from 'vitest';
import { judgeRedirect, MAX_REDIRECTS } from '../../src/crawl/redirects.js';

const site = 'https://example.com';
const hop = (url: string) => ({ url, status: 301 });

describe('a redirect hop', () => {
  it('is followed on the same site', () => {
    expect(judgeRedirect([hop(`${site}/old`)], `${site}/new`, site, false)).toEqual({ follow: `${site}/new` });
    expect(judgeRedirect([hop(`${site}/old`)], `${site}/new#top`, site, false)).toEqual({ follow: `${site}/new` });
  });

  it('stops on something that is not a web address', () => {
    expect(judgeRedirect([hop(`${site}/mail`)], 'mailto:someone@example.com', site, false)).toEqual({ error: 'redirects to a non-web URL: mailto:someone@example.com' });
  });

  it('stops on a loop, and after too many hops', () => {
    expect(judgeRedirect([hop(`${site}/a`), hop(`${site}/b`)], `${site}/a`, site, false)).toEqual({ error: 'redirect loop' });
    const many = Array.from({ length: MAX_REDIRECTS + 1 }, (_, i) => hop(`${site}/${i}`));
    expect(judgeRedirect(many, `${site}/next`, site, false)).toEqual({ error: `more than ${MAX_REDIRECTS} redirects` });
    expect(judgeRedirect(many.slice(1), `${site}/next`, site, false)).toEqual({ follow: `${site}/next` });
  });

  it('never leaves the site, unless the start page itself moved (then the site lives there)', () => {
    expect(judgeRedirect([hop(`${site}/partner`)], 'https://other.example/', site, false)).toEqual({ offSite: true });
    expect(judgeRedirect([hop('http://example.com/')], 'https://www.example.com/', 'http://example.com', true)).toEqual({
      follow: 'https://www.example.com/',
      movedTo: 'https://www.example.com',
    });
  });
});
