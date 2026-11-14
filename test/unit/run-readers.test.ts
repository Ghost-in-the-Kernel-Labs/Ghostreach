/**
 * One reader's failure is the page's, never the crawl's (Fable's review of 2026-10-11, B3): a reader that
 * throws is named on the page, with its name (G-659), and the readers after it still read. Deterministic, where a page that
 * navigates itself mid-read (test/crawl/hostile-page.spec.ts) depends on timing.
 */
import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import type { CrawledPage } from '../../src/leaf/report.js';
import { runReaders, type ReadContext } from '../../src/crawl/readers/index.js';

describe('the readers, one failing', () => {
  it('records its error on the page, once, and runs the rest', async () => {
    const entry = { url: 'http://x.test/', finalUrl: 'http://x.test/', status: 200, redirects: [], title: '', contentType: 'text/html', depth: 0, fingerprint: null } as CrawledPage;
    const ctx = { origin: 'http://x.test', bannerButton: null, links: [] } as ReadContext;
    const lost = async () => {
      throw new Error('page.evaluate: Execution context was destroyed, most likely because of a navigation\n    at somewhere');
    };
    const after = { name: 'title', read: async (_p: Page, e: CrawledPage) => void (e.title = 'Read after') };
    await runReaders([{ name: 'headings', read: lost }, after, { name: 'headings', read: lost }, { name: 'markup', read: lost }], {} as Page, entry, ctx);
    expect(entry.title).toBe('Read after');
    // Once per reader and reason; the same reason from another reader is its own line, so each names the component that met it.
    expect(entry.readerErrors).toEqual([
      'page.evaluate: Execution context was destroyed, most likely because of a navigation (the headings reader)',
      'page.evaluate: Execution context was destroyed, most likely because of a navigation (the markup reader)',
    ]);
    expect(entry.error).toBeUndefined();
  });

});
