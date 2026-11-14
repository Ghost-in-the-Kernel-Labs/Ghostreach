import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main, parse } from '../../src/cli/main.js';
import { doctorLines, recommended, settingsFile } from '../../src/project/settings.js';
import { reviewFolder, reviewSummary } from '../../src/project/review.js';
import { readCrawlReport } from '../../src/crawl/report-read.js';
import { siteFindings } from '../../src/findings/findings.js';

const said = (): string[] => vi.mocked(console.log).mock.calls.map((c) => String(c[0]));

const GB = 1024 ** 3;

describe('ghostreach doctor (TODO 3.4, GR-008)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is a word, alone; no option beginning -- comes with it (GR-003)', () => {
    expect(parse(['doctor'])).toBe('doctor');
    expect([['doctor', 'example.com'], ['--doctor'], ['doctor', '--n=5']].filter((argv) => parse(argv) !== null)).toEqual([]);
  });
  it('recommends one review for each 1 GB free and each 2 cores, whichever is fewer, from 1 to 5', () => {
    expect(recommended({ totalBytes: 16 * GB, freeBytes: 8 * GB, cores: 8 })).toBe(4);
    expect(recommended({ totalBytes: 16 * GB, freeBytes: 2.5 * GB, cores: 8 })).toBe(2);
    expect(recommended({ totalBytes: 64 * GB, freeBytes: 40 * GB, cores: 32 })).toBe(5);
    expect(recommended({ totalBytes: 4 * GB, freeBytes: 0.3 * GB, cores: 1 })).toBe(1);
  });
  it("says the machine's memory, the number it recommends, what is set, and where to set it, in plain words", async () => {
    const data = mkdtempSync(join(tmpdir(), 'ghostreach-doctor-'));
    try {
      expect(doctorLines(data, { totalBytes: 16 * GB, freeBytes: 6 * GB, cores: 8 })).toEqual([
        'This computer has 16.0 GB of memory, 6.0 GB of it free now, and 8 processor cores.',
        'Recommended: 4 reviews at once (one for each 1 GB free and each 2 cores, whichever is fewer, from 1 to 5).',
        'Set now: 3 at once, the default.',
        `To change it, write {"reviewsAtOnce": 4} in ${settingsFile(data)} and start ghostreach serve again.`,
      ]);
      vi.spyOn(console, 'log').mockImplementation(() => {});
      expect(await main(['doctor'], data)).toBe(0);
      expect(said()).toHaveLength(4);
      expect(said()[0]).toMatch(/^This computer has \d+\.\d GB of memory, \d+\.\d GB of it free now, and \d+ processor cores?\.$/);
      expect(said()[1]).toMatch(/^Recommended: [1-5] reviews? at once/);
      // The doctor only reads: nothing is written into the data folder.
      expect(readdirSync(data)).toEqual([]);
    } finally {
      rmSync(data, { recursive: true, force: true });
    }
  });
});

describe('ghostreach <site> (GR-003: no flag)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('with no site, prints what it takes and exits 1', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await main([])).toBe(1);
    expect(said()).toEqual(['ghostreach <site>: reviews the site and writes its Suite Builder PDF. ghostreach serve: opens the reviews in the browser. ghostreach doctor: says how many sites this computer can review at once. Nothing else is typed.']);
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
