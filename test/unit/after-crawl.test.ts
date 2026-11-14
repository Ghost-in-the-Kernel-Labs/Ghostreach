/**
 * What the crawl asks once its pages are read (src/crawl/after-crawl.ts), on a fake request client that counts what it
 * is asked: the sitemap robots.txt names is the one asked, and every other site's link is asked once (G-333). The second look
 * always runs (GR-003), so the run carries a fake browser that reads each page again as it was.
 */
import type { Browser } from 'playwright';
import { describe, expect, it } from 'vitest';
import { afterCrawl } from '../../src/crawl/after-crawl.js';
import type { CrawlSettings } from '../../src/crawl/loop.js';
import type { CrawlRun } from '../../src/crawl/page-step.js';
import { CrawlState } from '../../src/crawl/state.js';

/** A browser for the second look: each page answers 200 with the headings it had, so nothing reads differently. */
const browser = (): Browser => {
  const page = {
    goto: async () => ({ status: () => 200 }),
    url: () => 'http://site.test/',
    evaluate: async () => ({ headings: ['Home'], skipped: [] }),
    waitForLoadState: async () => undefined,
    close: async () => undefined,
    context: () => context,
  };
  const context = { route: async () => undefined, on: () => undefined, newPage: async () => page, close: async () => undefined };
  return { newContext: async () => context } as unknown as Browser;
};

/** A crawl of http://site.test/ with one page and one link to another site, afterCrawl run on it. */
async function ran(sitemaps?: string[], images?: string[], seen: { state?: CrawlState } = {}, redirects: Record<string, string> = {}): Promise<string[]> {
  const state = new CrawlState('http://site.test/', 5);
  state.addPage({ url: 'http://site.test/', finalUrl: 'http://site.test/', status: 200, redirects: [], title: 'Home', headings: ['Home'] } as never);
  state.addLink('a link to another site', { from: 'http://site.test/', to: 'http://a.dev/x', external: true } as never);
  state.readRobots({ policy: { ...state.robots.policy, ...(sitemaps ? { sitemaps } : {}) }, status: 200 } as never);
  const asked: string[] = [];
  const answer = (method: string) => async (url: string) => {
    asked.push(`${method} ${url}`);
    const to = redirects[url];
    return { status: () => (to ? 302 : 200), headers: () => (to ? { location: to } : {}), text: async () => '', url: () => url };
  };
  const context = { request: { get: answer('GET'), head: answer('HEAD') } } as never;
  // The images were shown on the page (readers/images.ts): only those are asked (G-737, slice 8).
  if (images) state.noteShownImages(images);
  const run = { state, frontier: { leftovers: () => [] }, log: () => undefined, readDeadlineMs: 1000, ...(images ? { watch: { imagesSeen: () => new Map(images.map((u) => [u, '/'])) } } : {}) } as unknown as CrawlRun;
  const settings = {
    options: { startUrl: 'http://site.test/', resolve: async () => ['93.184.216.34'] },
    delayMs: 0, settleMs: 0, timeout: 1000, log: () => undefined,
  } as unknown as CrawlSettings;
  await afterCrawl(run, context, browser(), settings);
  seen.state = state;
  return asked;
}

describe('what the crawl asks after its pages (G-333)', () => {
  it('asks the other site\'s link, once', async () => {
    expect((await ran()).filter((a) => a.includes('a.dev'))).toEqual(['HEAD http://a.dev/x']);
  });

  it('asks the sitemap robots.txt names, else /sitemap.xml', async () => {
    const maps = (asked: string[]) => asked.filter((a) => /map/.test(a));
    expect(maps(await ran(['http://site.test/maps/main.xml']))).toEqual(['GET http://site.test/maps/main.xml']);
    expect(maps(await ran())).toEqual(['GET http://site.test/sitemap.xml']);
  });

  it('asks the images the pages showed, the site\'s and another host\'s (G-335)', async () => {
    const images = ['http://site.test/a.png', 'http://cdn.test/b.png'];
    const imagesAsked = (asked: string[]) => asked.filter((a) => /\.png$/.test(a));
    expect(imagesAsked(await ran(undefined, images))).toEqual(['HEAD http://site.test/a.png', 'HEAD http://cdn.test/b.png']);
  });

  it('asks the sitemap robots.txt names on another host; with none named, the site\'s own (G-335)', async () => {
    const maps = (asked: string[]) => asked.filter((a) => /\.xml$/.test(a));
    expect(maps(await ran(['https://cdn.test/main.xml']))).toEqual(['GET https://cdn.test/main.xml']);
    // With no Sitemap: line there is no invented one: every address asked is an address.
    const seen: { state?: CrawlState } = {};
    expect((await ran(undefined, undefined, seen)).every((a) => /^(GET|HEAD) http:\/\/[a-z.]+\//.test(a))).toBe(true);
    expect(seen.state?.site?.sitemap).toMatchObject({ url: 'http://site.test/sitemap.xml', status: 200 });
  });

  it('a redirect of the site\'s own image, sitemap or security.txt to another host is followed (G-335)', async () => {
    const redirects = {
      'http://site.test/a.png': 'http://cdn.test/a.png',
      'http://site.test/sitemap.xml': 'http://cdn.test/s.xml',
      'http://site.test/.well-known/security.txt': 'http://cdn.test/security.txt',
    };
    const onCdn = (asked: string[]) => asked.filter((a) => a.includes('cdn.test'));
    expect(onCdn(await ran(undefined, ['http://site.test/a.png'], {}, redirects)).length).toBeGreaterThan(2);
  });
});
