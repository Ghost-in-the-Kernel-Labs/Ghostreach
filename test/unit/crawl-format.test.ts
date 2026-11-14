/**
 * crawl.json is the contract between the layers: versioned and checked on reading. The parent's document of it (docs/CRAWL-FORMAT.md)
 * was not copied, and its two cases went with it (1.4, docs/CUT.md); the saved reports read are the made-up fixtures' (test/golden/).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPORT_VERSION } from '../../src/leaf/report.js';
import { readCrawlReport } from '../../src/crawl/report-read.js';

const root = join(__dirname, '../..');

describe('the crawl report format', () => {
  it('reads every saved report', () => {
    for (const f of ['test/golden/fixture-site.crawl.json', 'test/golden/frames-site.crawl.json', 'test/golden/library-site.crawl.json']) {
      expect(readCrawlReport(readFileSync(join(root, f), 'utf8'), f).pages.length, f).toBeGreaterThan(0);
    }
  });

  it('refuses a newer version, something that isn\'t a report, and a broken file, saying why', () => {
    const newer = JSON.stringify({ tool: 'suite-builder', reportVersion: REPORT_VERSION + 1, pages: [], edges: [] });
    expect(() => readCrawlReport(newer, 'x.crawl.json')).toThrow(`x.crawl.json was made by a newer Suite Builder (report version ${REPORT_VERSION + 1}; this one reads up to ${REPORT_VERSION}). Update Suite Builder, or crawl the site again with this one.`);
    expect(() => readCrawlReport('{"kind":"templates"}', 'x.json')).toThrow(/^x\.json is not a crawl report\.$/);
    expect(() => readCrawlReport('{', 'x.json')).toThrow('Could not read a crawl report from x.json');
  });
});
