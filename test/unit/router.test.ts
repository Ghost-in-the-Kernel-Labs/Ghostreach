/**
 * The crawl's request router (src/crawl/router.ts) with stand-ins for Playwright's context, routes and requests (item
 * 52, step 5: the crawl specs held it, and Stryker runs none of them): what each kind of request is given, and what
 * the page load it belongs to is told. The real browser's side is test/crawl/router.spec.ts and hostile-crawl.spec.ts.
 */
import type { BrowserContext, Route } from 'playwright';
import { describe, expect, it } from 'vitest';
import { H as crawlH } from '../../src/leaf/heuristics/crawl.js';
import { H as suiteH } from '../../src/leaf/heuristics/suite.js';
import { parseRobots } from '../../src/crawl/robots.js';
import { disallowedDocument, notFetched, routeCrawl } from '../../src/crawl/router.js';
import { CrawlState, type Navigation } from '../../src/crawl/state.js';

const ORIGIN = 'http://site.test';

/** A frame `depth` frames deep: 0 the page itself. */
const frameAt = (depth: number): { parentFrame(): unknown } => ({ parentFrame: () => (depth > 0 ? frameAt(depth - 1) : null) });

interface Asked {
  url?: string;
  type?: string;
  navigation?: boolean;
  depth?: number;
  noFrame?: boolean;
  answer?: { status: number; headers?: Record<string, string>; body?: number } | Error;
  throwOnHeaders?: boolean;
  /** The page the load under way is of (pageKey). */
  loading?: string;
  /** No page load under way: a request of a frame or a worker after its page's load is done. */
  noLoad?: boolean;
  /** The message the router's own error carries. */
  headersError?: string;
}

/** One request through the router: what the route was given (abort, continue or fulfill, and with what), and the load it told. */
async function route(asked: Asked, state = new CrawlState(`${ORIGIN}/`, 8)) {
  const done: string[] = [];
  let handler: ((r: Route) => Promise<void>) | undefined;
  await routeCrawl({ route: async (pattern: string, h: (r: Route) => Promise<void>) => void (handler = pattern === '**/*' ? h : undefined) } as unknown as BrowserContext, state);
  const request = {
    url: () => asked.url ?? `${ORIGIN}/page`,
    resourceType: () => asked.type ?? 'document',
    isNavigationRequest: () => asked.navigation ?? true,
    frame: () => {
      if (asked.noFrame) throw new Error('Frame for this navigation request is not available');
      return frameAt(asked.depth ?? 0);
    },
  };
  const answer = asked.answer instanceof Error ? asked.answer : { status: 200, ...asked.answer };
  const fake = {
    request: () => request,
    abort: async (why?: string) => void done.push(`abort${why ? ` ${why}` : ''}`),
    continue: async () => void done.push('continue'),
    fulfill: async (o: { response?: unknown; body?: string }) => void done.push(o.response ? 'fulfill the answer' : `fulfill empty`),
    fetch: async (options: { maxRedirects?: number }) => {
      done.push(`fetch, ${options.maxRedirects} redirects`);
      if (answer instanceof Error) throw answer;
      return {
        status: () => answer.status,
        headers: () => {
          if (asked.throwOnHeaders) throw new Error(asked.headersError ?? 'headers went\nwith a call log');
          return answer.headers ?? {};
        },
        body: async () => Buffer.alloc(answer.body ?? 10),
      };
    },
  } as unknown as Route;
  // No page load under way: none is begun, and the load handed back is one the router never sees.
  const nav: Navigation = asked.noLoad ? { key: asked.loading ?? 'http://site.test/page', redirect: null, failed: null } : state.navigate(asked.loading ?? 'http://site.test/page');
  await handler?.(fake);
  return { done, nav, state };
}

describe('the crawl\'s router', () => {
  it('images, media, fonts and ad hosts not fetched; a request with no frame passed over', async () => {
    for (const type of ['image', 'media', 'font']) expect((await route({ type, navigation: false })).done).toEqual(['abort']);
    expect((await route({ url: 'https://doubleclick.net/x.js', type: 'script', navigation: false })).done).toEqual(['abort']);
    expect((await route({ noFrame: true })).done).toEqual(['abort']);
    expect(notFetched({ resourceType: () => 'script', url: () => `${ORIGIN}/a.js` } as never)).toBe(false);
  });

  it('a request leading further in than the site refused, said once for its address', async () => {
    const state = new CrawlState(`${ORIGIN}/`, 8);
    state.configure({ inward: async (url) => (url.includes('169.254') ? 'not asked: it leads nowhere a page should' : null) });
    expect((await route({ url: 'http://169.254.169.254/x', type: 'script', navigation: false }, state)).done).toEqual(['abort blockedbyclient']);
    state.configure({ inward: async () => 'a second reason' });
    await route({ url: 'http://169.254.169.254/x', type: 'script', navigation: false }, state);
    // The first reason an address was refused for is the one kept.
    expect([...state.refusedInBrowser]).toEqual([['http://169.254.169.254/x', 'not asked: it leads nowhere a page should']]);
    state.configure({ inward: async () => null });
    expect((await route({ url: `${ORIGIN}/ok.js`, type: 'script', navigation: false }, state)).done).toEqual(['continue']);
  });

  it('a document robots.txt disallows, and a frame deeper than the crawl reads, not loaded; the rest of a page goes as it is', async () => {
    const state = new CrawlState(`${ORIGIN}/`, 8);
    state.readRobots({ policy: parseRobots('User-agent: *\nDisallow: /private', 'SuiteBuilder'), status: 200 });
    expect((await route({ url: `${ORIGIN}/private/x` }, state)).done).toEqual(['abort blockedbyclient']);
    expect(disallowedDocument({ isNavigationRequest: () => false, url: () => `${ORIGIN}/private/x` } as never, ORIGIN, state.robots.policy)).toBe(false);
    expect(disallowedDocument({ isNavigationRequest: () => true, url: () => 'http://other.test/private/x' } as never, ORIGIN, state.robots.policy)).toBe(false);
    expect(disallowedDocument({ isNavigationRequest: () => true, url: () => 'about:blank' } as never, ORIGIN, parseRobots('User-agent: *\nDisallow: /', 'SuiteBuilder'))).toBe(false);
    expect((await route({ depth: crawlH.FRAME_DEPTH + 1 })).done).toEqual(['abort blockedbyclient']);
    expect((await route({ depth: crawlH.FRAME_DEPTH })).done).toEqual(['continue']);
    expect((await route({ depth: 1 })).done).toEqual(['continue']);
    expect((await route({ type: 'script', navigation: false })).done).toEqual(['continue']);
  });

  // The guards' order, pinned before routeRequest is split (G-639, Fable's review of the SRC-14 plan): what is not fetched and
  // what has no frame go first, unrecorded; a request further in than the site is refused, and recorded, before robots.txt or
  // the frame depth is asked (another host noted offline went with `--offline`, 1.3).
  it('the guards in their order: not fetched, no frame, inward (recorded), robots.txt, frame depth', async () => {
    const inward = 'not asked: it leads nowhere a page should';
    const fresh = () => {
      const state = new CrawlState(`${ORIGIN}/`, 8);
      state.configure({ inward: async () => inward });
      state.readRobots({ policy: parseRobots('User-agent: *\nDisallow: /private', 'SuiteBuilder'), status: 200 });
      return state;
    };
    // Inward and disallowed: refused as inward, so the address is recorded.
    const both = fresh();
    expect((await route({ url: `${ORIGIN}/private/x` }, both)).done).toEqual(['abort blockedbyclient']);
    expect([...both.refusedInBrowser]).toEqual([[`${ORIGIN}/private/x`, inward]]);
    // Inward and a frame deeper than the crawl reads: inward too.
    const deep = fresh();
    expect((await route({ url: `${ORIGIN}/deep`, depth: crawlH.FRAME_DEPTH + 1 }, deep)).done).toEqual(['abort blockedbyclient']);
    expect([...deep.refusedInBrowser]).toEqual([[`${ORIGIN}/deep`, inward]]);
    // Not fetched (an image) or with no frame: passed over before the inward question, nothing recorded.
    const image = fresh();
    expect((await route({ url: `${ORIGIN}/a.png`, type: 'image', navigation: false }, image)).done).toEqual(['abort']);
    const closed = fresh();
    expect((await route({ url: `${ORIGIN}/gone`, noFrame: true }, closed)).done).toEqual(['abort']);
    expect([...image.refusedInBrowser, ...closed.refusedInBrowser]).toEqual([]);
  });

  it('a page load: fetched without its redirects, the answer handed on; a page read already not asked again', async () => {
    const plain = await route({});
    expect(plain.done).toEqual(['fetch, 0 redirects', 'fulfill the answer']);
    expect(plain.nav).toEqual({ key: 'http://site.test/page', redirect: null, failed: null });
    const state = new CrawlState(`${ORIGIN}/`, 8);
    state.markRead('http://site.test/other', 'http://site.test/other');
    expect((await route({ url: `${ORIGIN}/other` }, state)).done).toEqual(['fulfill empty']);
    // The page being loaded is fetched, read before or not; an address that is no page's is fetched as it is.
    expect((await route({ url: `${ORIGIN}/other`, loading: 'http://site.test/other' }, state)).done).toEqual(['fetch, 0 redirects', 'fulfill the answer']);
    expect((await route({ url: `${ORIGIN}/new` }, state)).done).toEqual(['fetch, 0 redirects', 'fulfill the answer']);
    expect((await route({ url: 'about:blank' }, state)).done).toEqual(['fetch, 0 redirects', 'fulfill the answer']);
  });

  it('a redirect left for the loop, its address resolved; one to no address, or a site that stops answering, fails the load, said', async () => {
    const moved = await route({ answer: { status: 301, headers: { location: '/new?x=1' } } });
    expect(moved.done).toEqual(['fetch, 0 redirects', 'fulfill empty']);
    expect(moved.nav.redirect).toEqual({ status: 301, location: 'http://site.test/new?x=1' });
    // A 3xx with no Location is an answer like any other.
    expect((await route({ answer: { status: 304 } })).done).toEqual(['fetch, 0 redirects', 'fulfill the answer']);
    // The edges of a redirect: 300 and 399 are, 299 and 400 are answers, Location or not.
    expect((await route({ answer: { status: 300, headers: { location: '/a' } } })).nav.redirect?.status).toBe(300);
    expect((await route({ answer: { status: 399, headers: { location: '/a' } } })).nav.redirect?.status).toBe(399);
    for (const status of [299, 400]) expect((await route({ answer: { status, headers: { location: '/a' } } })).nav.redirect, String(status)).toBeNull();
    const nowhere = await route({ answer: { status: 302, headers: { location: 'http://[' } } });
    expect(nowhere.nav.failed).toBe('answered 302 with a Location that is no address: http://[');
    const long = await route({ answer: { status: 302, headers: { location: `http://[${'x'.repeat(300)}` } } });
    expect(long.nav.failed).toBe(`answered 302 with a Location that is no address: http://[${'x'.repeat(92)}`);
    const gone = await route({ answer: new Error('connect ECONNREFUSED\nwith a call log') });
    expect(gone.done).toEqual(['fetch, 0 redirects', 'fulfill empty']);
    expect(gone.nav.failed).toBe('connect ECONNREFUSED');
  });

  it('a body past what a page is read up to fails the load, said with its size; at the limit, handed on', async () => {
    const big = await route({ answer: { status: 200, body: suiteH.PAGE_BODY_MAX_BYTES + 1 } });
    expect(big.done).toEqual(['fetch, 0 redirects', 'fulfill empty']);
    expect(big.nav.failed).toBe(`answered 50 MB, more than the 50 MB a page is read up to`);
    expect((await route({ answer: { status: 200, body: suiteH.PAGE_BODY_MAX_BYTES } })).done).toEqual(['fetch, 0 redirects', 'fulfill the answer']);
  });

  it('an error the router itself meets fails the load, said, never the crawl', async () => {
    const broken = await route({ throwOnHeaders: true });
    expect(broken.done).toEqual(['fetch, 0 redirects', 'fulfill empty']);
    expect(broken.nav.failed).toBe('the crawl could not handle the answer: headers went');
    // Said in at most 200 characters; and with no load under way, the browser still given its empty page.
    const long = await route({ throwOnHeaders: true, headersError: 'x'.repeat(300) });
    expect(long.nav.failed).toBe(`the crawl could not handle the answer: ${'x'.repeat(200)}`);
    expect((await route({ throwOnHeaders: true, noLoad: true })).done).toEqual(['fetch, 0 redirects', 'fulfill empty']);
  });
});
