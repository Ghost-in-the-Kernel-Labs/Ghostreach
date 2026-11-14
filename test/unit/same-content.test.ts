/**
 * The crawl summary's "Same page at two addresses" line (src/crawl/report.ts): pages the crawl's rules
 * could not tell apart, error pages left out (HANDOFF.md, site-b.example 2026-09-30: its 404 pages were
 * named as one page at several addresses, though each is a broken link already reported).
 */
import { describe, expect, it } from 'vitest';
import type { CrawledPage } from '../../src/leaf/report.js';
import { sameContentLine } from '../../src/crawl/report-read.js';

const page = (path: string, status: number, sameAs?: string): CrawledPage => ({
  url: `https://x.test${path}`,
  finalUrl: `https://x.test${path}`,
  status,
  redirects: [],
  title: 'A page',
  contentType: 'text/html',
  depth: 1,
  fingerprint: null,
  ...(sameAs ? { sameContentAs: `https://x.test${sameAs}` } : {}),
});

describe('the "Same page at two addresses" line', () => {
  it('names pages read alike at two addresses', () => {
    expect(sameContentLine({ pages: [page('/gear', 200), page('/print/gear', 200, '/gear')] })).toBe(
      'Same page at two addresses (no redirect or canonical link says so): /print/gear = /gear',
    );
  });

  it('leaves out pages that answered an error, on either side', () => {
    const pages = [page('/missing-a', 404), page('/missing-b', 404, '/missing-a'), page('/gone', 410, '/missing-a'), page('/ok', 200, '/missing-a')];
    expect(sameContentLine({ pages })).toBeNull();
  });

  it('says nothing when no page was read twice', () => {
    expect(sameContentLine({ pages: [page('/', 200)] })).toBeNull();
  });

  it('names five, then counts the rest', () => {
    const pages = [page('/a', 200), ...Array.from({ length: 7 }, (_, i) => page(`/a${i}`, 200, '/a'))];
    expect(sameContentLine({ pages })).toMatch(/\/a4 = \/a, and 2 more$/);
  });
});
