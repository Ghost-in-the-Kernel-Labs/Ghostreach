import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../src/cli/main.js';
import { reviewFolder, reviewSummary } from '../../src/project/review.js';
import { readCrawlReport } from '../../src/crawl/report-read.js';
import { siteFindings } from '../../src/findings/findings.js';

const said = (): string[] => vi.mocked(console.log).mock.calls.map((c) => String(c[0]));

describe('ghostreach <site> (GR-003: no flag)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('with no site, prints what it takes and exits 1', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await main([])).toBe(1);
    expect(said()).toEqual(['ghostreach <site>: reviews the site and writes its Suite Builder PDF. Nothing else is typed.']);
  });
  it('--help is the one option, and exits 0 with the same sentence', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await main(['--help'])).toBe(0);
    expect(said()[0]).toMatch(/^ghostreach <site>/);
    // TODO 2.5: the PDF is the one artefact; the help names no other file of the review's folder.
    expect(said()[0]).toContain('PDF');
    expect(said()[0]).not.toMatch(/AUDIT\.html|\.json/);
  });
  it('any other option is refused as a missing site', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await main(['--short', 'example.com'])).toBe(1);
  });
  it('a word that is not a web address is refused before anything is crawled or written', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const data = mkdtempSync(join(tmpdir(), 'ghostreach-main-'));
    try {
      for (const typed of ['demoqa', 'ftp://example.com/', 'mailto:someone@example.com']) expect(await main([typed], data)).toBe(1);
      expect(said()[0]).toBe('"demoqa" is not a web address. Name a site like www.example.com.');
      expect(readdirSync(data)).toEqual([]);
    } finally {
      rmSync(data, { recursive: true, force: true });
    }
  });
});

describe('the review folder and its summary (REV-06)', () => {
  it('is <data>/<host>-<date>, and a second review that day gets -2, then -3: no crawl is overwritten', () => {
    const data = mkdtempSync(join(tmpdir(), 'ghostreach-folder-'));
    try {
      expect(reviewFolder(data, 'example.com', '2026-11-14')).toBe(join(data, 'example.com-2026-11-14'));
      mkdirSync(join(data, 'example.com-2026-11-14'));
      expect(reviewFolder(data, 'example.com', '2026-11-14')).toBe(join(data, 'example.com-2026-11-14-2'));
      mkdirSync(join(data, 'example.com-2026-11-14-2'));
      expect(reviewFolder(data, 'example.com', '2026-11-14')).toBe(join(data, 'example.com-2026-11-14-3'));
      expect(existsSync(join(data, 'example.com-2026-11-14-3'))).toBe(false);
    } finally {
      rmSync(data, { recursive: true, force: true });
    }
  });
  it("holds the host, the date, the pages read, the count by severity and the count by code, in the findings' order", () => {
    const file = 'test/golden/fixture-site.crawl.json';
    const report = readCrawlReport(readFileSync(file, 'utf8'), file);
    const findings = siteFindings(report);
    const summary = reviewSummary(report, findings, '2026-11-14');
    expect(summary).toEqual({
      host: 'fixture.test',
      date: '2026-11-14',
      pagesRead: 13,
      bySeverity: { major: 2, minor: 4, info: 0 },
      byCode: { 'SITE-02': 1, 'SITE-11': 1, 'SITE-17': 1, 'SITE-03': 1, 'SITE-28': 1, 'SITE-29': 1 },
    });
    expect(Object.keys(summary.byCode)).toEqual(findings.map((f) => f.code));
  });
});
