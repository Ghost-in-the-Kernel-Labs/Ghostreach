/**
 * SITE-22 withheld under load (TODO 3.5, GR-014): a review whose crawl ran beside another review has no finding on slow pages,
 * lists the check as not timed and says why before its findings; a review that ran alone is the page it always was (1.6's golden,
 * test/unit/audit-golden.test.ts), SITE-22 and all. The parent's fixture crawl, one page made slow (a first byte of 3 s).
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditHtml, writeAudit } from '../../src/audit/audit.js';
import { siteFindings } from '../../src/findings/findings.js';
import { auditedCrawl } from '../../src/project/crawl.js';
import type { CrawlReport } from '../../src/leaf/report.js';
import { ALONGSIDE } from '../../src/leaf/words.js';

const root = resolve(new URL('../../', import.meta.url).pathname);
const DAY = new Date('2026-11-14T12:00:00Z');
const NOT_TIMED = 'Pages slow to answer or to load: not timed';

/** The fixture crawl with its start page answering after 3 s: SITE-22 when timed. */
function slowCrawl(): CrawlReport {
  const report = auditedCrawl(join(root, 'test/golden/fixture-site.crawl.json'));
  const [start, ...rest] = report.pages;
  return { ...report, pages: [{ ...start, load: { ...start.load, firstByteMs: 3000 } }, ...rest] };
}

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const folder = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'ghostreach-alongside-'));
  made.push(dir);
  return dir;
};

describe('SITE-22 under load (TODO 3.5, GR-014)', () => {
  it('a review that ran alone reports SITE-22, and its page is the page it always was', () => {
    const report = slowCrawl();
    const { file, findings } = writeAudit(report, folder(), DAY);
    expect(findings.map((f) => f.code)).toContain('SITE-22');
    const html = readFileSync(file, 'utf8');
    expect(html).toBe(auditHtml(report, siteFindings(report), DAY));
    expect(html).not.toContain(ALONGSIDE);
    expect(html).not.toContain('not timed');
  });

  it('a review that ran alongside another withholds SITE-22 alone, lists it as not timed, and says so before its findings', () => {
    const report = slowCrawl();
    const alone = writeAudit(report, folder(), DAY).findings;
    const { file, findings } = writeAudit(report, folder(), DAY, true);
    expect(findings).toEqual(alone.filter((f) => f.code !== 'SITE-22'));
    const html = readFileSync(file, 'utf8');
    const said = html.indexOf(ALONGSIDE);
    expect(said).toBeGreaterThan(0);
    // REV-03: said before every result it qualifies, the counts, the links that need a look and the findings among them.
    for (const result of ['<div class="counts">', '<section class="checked">', '<section class="finding ']) expect(said, result).toBeLessThan(html.indexOf(result));
    expect(html).toContain(NOT_TIMED);
    expect(html).toContain('1 was not timed.');
    expect(html).not.toContain('<span class="code">SITE-22</span>');
  });

  it('withholds nothing but SITE-22: a crawl with no slow page gives the same findings either way', () => {
    const report = auditedCrawl(join(root, 'test/golden/fixture-site.crawl.json'));
    expect(writeAudit(report, folder(), DAY, true).findings).toEqual(writeAudit(report, folder(), DAY).findings);
  });
});
