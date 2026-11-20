import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main, parse } from '../../src/cli/main.js';
import { doctorLines, recommended, settingsFile, thisMachine } from '../../src/project/settings.js';
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
  it("says the machine's memory and the reviews at once it uses, recommended for this computer, and why; no JSON to write (launch fixes 9)", async () => {
    const data = mkdtempSync(join(tmpdir(), 'ghostreach-doctor-'));
    const machine = { totalBytes: 16 * GB, freeBytes: 6 * GB, cores: 8 };
    try {
      expect(doctorLines(data, machine)).toEqual([
        'This computer has 16.0 GB of memory, 6.0 GB of it free now, and 8 processor cores.',
        'Reviews at once: 4, recommended for this computer (one for each 1 GB free and each 2 cores, whichever is fewer, from 1 to 5).',
      ]);
      // The settings file still has the last word, and the doctor says what it uses and why.
      writeFileSync(settingsFile(data), '{"reviewsAtOnce": 2}');
      expect(doctorLines(data, machine)).toEqual([
        'This computer has 16.0 GB of memory, 6.0 GB of it free now, and 8 processor cores.',
        `Reviews at once: 2, as ${settingsFile(data)} asks (4 is recommended for this computer).`,
      ]);
      writeFileSync(settingsFile(data), '{"reviewsAtOnce": "two"}');
      expect(doctorLines(data, machine)[1]).toBe(
        "Reviews at once: 4, recommended for this computer (one for each 1 GB free and each 2 cores, whichever is fewer, from 1 to 5). settings.json's reviewsAtOnce is not a number, so 4 reviews run at once, recommended for this computer.",
      );
      rmSync(settingsFile(data));
      vi.spyOn(console, 'log').mockImplementation(() => {});
      expect(await main(['doctor'], data)).toBe(0);
      expect(said()).toHaveLength(4);
      // TODO 5.1: Node.js and Chromium first, each ready or missing with the command that fixes it.
      expect(said()[0]).toMatch(/^Node\.js \d+\.\d+\.\d+: /);
      expect(said()[1]).toMatch(/^Chromium, the browser the review drives: (installed\.|not installed\. Run: npx playwright@\d+\.\d+\.\d+ install chromium)$/);
      expect(said()[2]).toMatch(/^This computer has \d+\.\d GB of memory, \d+\.\d GB of it free now, and \d+ processor cores?\.$/);
      // No one is asked to hand-write JSON, and its N is this machine's recommendation (free memory moves, so within one).
      expect(said().join('\n')).not.toContain('{');
      const n = Number(/^Reviews at once: ([1-5]), recommended for this computer/.exec(said()[3])?.[1]);
      expect(Math.abs(n - recommended(thisMachine()))).toBeLessThanOrEqual(1);
      // The doctor only reads: nothing is written into the data folder.
      expect(readdirSync(data)).toEqual([]);
    } finally {
      rmSync(data, { recursive: true, force: true });
    }
  });
});

describe('ghostreach <site> and --help (GR-003: no flag; GR-018)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('--help is the one option, and lists every command, where the reviews are kept and how the page stops; exits 0', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await main(['--help'], '/home/someone/Ghostreach')).toBe(0);
    const help = said();
    expect(help.filter((line) => /^ {2}ghostreach/.test(line)).map((line) => line.trim().split(/ {2,}/)[0])).toEqual([
      'ghostreach', 'ghostreach <site>', 'ghostreach doctor', 'ghostreach shortcut', 'ghostreach serve', 'ghostreach --help',
    ]);
    expect(help).toContain('Reviews are saved in /home/someone/Ghostreach');
    expect(help.some((line) => line.includes('Ctrl+C'))).toBe(true);
    // TODO 2.5: the PDF is the one artefact; the help names no other file of the review's folder.
    expect(help.join('\n')).toContain('PDF');
    expect(help.join('\n')).not.toMatch(/AUDIT\.html|\.json/);
    // The word help says the same.
    vi.mocked(console.log).mockClear();
    expect(await main(['help'], '/home/someone/Ghostreach')).toBe(0);
    expect(said()).toEqual(help);
  });
  it('any other option is refused with the list, and exits 1', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await main(['--short', 'example.com'])).toBe(1);
    expect(said()).toContain('  ghostreach --help          This list (ghostreach help too)');
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
