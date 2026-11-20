/**
 * The crawl's request router lets a page's request to another host go and records nothing of it (G-333, G-335; src/crawl/crawler.ts),
 * on a browser that is a fake: a crawl of an address nobody answers, during whose robots.txt request a page's script asks another
 * host. The parent's offline half (another host recorded) went with `--offline` at 1.3 (docs/CUT.md).
 */
import type { Browser, Route } from 'playwright';
import { describe, expect, it } from 'vitest';
import { crawl } from '../../src/crawl/crawler.js';

async function crawled() {
  let handler: ((r: Route) => Promise<void>) | undefined;
  const fed: string[] = [];
  const feed = async () => {
    const request = { url: () => 'https://tags.test/gtm.js', resourceType: () => 'script', isNavigationRequest: () => false, frame: () => ({ parentFrame: () => null }) };
    await handler?.({ request: () => request, abort: async () => void fed.push('abort'), continue: async () => void fed.push('continue') } as unknown as Route);
  };
  const refuse = async () => {
    await feed();
    throw new Error('connection refused');
  };
  const context = {
    on: () => undefined,
    close: async () => undefined,
    route: async (_pattern: string, h: (r: Route) => Promise<void>) => void (handler = h),
    newPage: async () => ({}),
    request: { get: refuse, head: refuse },
  };
  const browser = { newContext: async () => context } as unknown as Browser;
  const report = await crawl({ startUrl: 'http://127.0.0.1:9/', browser, robotsRetryWaitMs: 0, resolve: async () => ['93.184.216.34'], lookup: async () => [] });
  return { report, fed };
}

describe('the crawl\'s router and another host', () => {
  it('a page\'s request to another host is let go, and nothing is recorded', async () => {
    const { report, fed } = await crawled();
    expect(fed).toEqual(['continue']);
    expect(report.site).toBeUndefined();
  });
});
