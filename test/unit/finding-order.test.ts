/**
 * One order for the site's findings (TODO 135, M1): `siteFindings` returns them in G-668's order, the audit's, so the suite's
 * "Links that need a look", KNOWN-ISSUES.md and the audit read one list in one order.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CrawlReport } from '../../src/leaf/report.js';
import { siteFindings } from '../../src/findings/findings.js';
import { ranked } from '../../src/findings/finding-order.js';

const fixture = (): CrawlReport => JSON.parse(readFileSync(join(__dirname, '../golden/fixture-site.crawl.json'), 'utf8'));

describe('one order for the findings', () => {
  it('siteFindings returns them as the audit ranks them', () => {
    const found = siteFindings(fixture());
    expect(found.length).toBeGreaterThan(3);
    expect(found.map((f) => f.code)).toEqual(ranked(found).map((f) => f.code));
  });

  it('within a severity, the finding on more pages leads, not the one found first (G-668)', () => {
    const minor = siteFindings(fixture()).filter((f) => f.severity === 'minor' && !f.unconfirmed && !f.where.some((w) => w.link));
    const sizes = minor.map((f) => f.where.length);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });
});
