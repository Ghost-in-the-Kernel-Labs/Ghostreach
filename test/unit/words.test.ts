import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { auditHtml } from '../../src/audit/audit.js';
import { siteFindings } from '../../src/findings/findings.js';
import { auditedCrawl } from '../../src/project/crawl.js';
import type { CrawlReport } from '../../src/leaf/report.js';
import { BANNED_PHRASES, REVIEW_WORDS, bannedIn } from '../../src/leaf/words.js';

/** A crawl of one page that answered, nothing else asked: enough for the audit page to be written. */
const BARE_REPORT = {
  tool: 'suite-builder', reportVersion: 0, startUrl: 'https://example.com/', origin: 'https://example.com',
  options: { maxPages: 300, delayMs: 1000, userAgent: 'SuiteBuilder', maxConsecutiveErrors: 3 },
  robots: { url: 'https://example.com/robots.txt', status: 404, source: 'none', crawlDelaySeconds: null },
  stopReason: 'complete', pages: [{ url: 'https://example.com/', finalUrl: 'https://example.com/', status: 200, redirects: [], depth: 0, title: 'Home' }], edges: [], notCrawled: [],
} as unknown as CrawlReport;

describe('the words a prospect may read (P-08)', () => {
  it('passes a sentence written in the review vocabulary', () => {
    expect(bannedIn('The review lists 3 major findings and 2 minor findings. Nothing to report on the sitemap.')).toEqual([]);
  });
  it('names every banned phrase a sentence carries, in catalogue order', () => {
    expect(bannedIn('We ran a scan and found defects; here is what is wrong.')).toEqual(['what is wrong', 'defects', 'scan']);
  });
  it('matches a phrase whole, so a word inside another word is not a hit', () => {
    expect(bannedIn('The scanner vocabulary is kept out; a scandal is a different word.')).toEqual([]);
    expect(bannedIn('Problematic markup')).toEqual([]);
  });
  it('matches without regard to case', () => {
    expect(bannedIn('DEFECT on the home page')).toEqual(['defect']);
  });
  it('keeps the review vocabulary and the banned list disjoint', () => {
    for (const word of REVIEW_WORDS) expect(bannedIn(word)).toEqual([]);
    expect(new Set(BANNED_PHRASES).size).toBe(BANNED_PHRASES.length);
  });
});

describe('a phrase split across white space', () => {
  it('is still the phrase', () => {
    expect(bannedIn('what   is\twrong here')).toEqual(['what is wrong']);
  });
  it('is not the phrase when its words are run together', () => {
    expect(bannedIn('whatiswrong')).toEqual([]);
  });
});

// TODO 1.3 (GR-003): the parent's short audit told its reader of a free limit in one sentence (`FREE_SCAN_LIMIT`). The flag is
// stripped and the sentence with it: no source holds it, by name or by its words, and the audit page never says it.
describe('the free-scan sentence, stripped with --short', () => {
  const SENTENCE = /free short audit|one per month per Google account/i;
  const root = new URL('../../', import.meta.url);
  const sources = fs.readdirSync(new URL('src/', root), { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts')).map((f) => `src/${f.replace(/\\/g, '/')}`);
  it('is in no file under src/, by name or by its words', () => {
    expect(sources.filter((f) => /FREE_SCAN_LIMIT/.test(fs.readFileSync(new URL(f, root), 'utf8')) || SENTENCE.test(fs.readFileSync(new URL(f, root), 'utf8')))).toEqual([]);
  });
  it('is not on the audit page, with findings or without', () => {
    const finding = { code: 'SITE-04', severity: 'minor', title: 'Two pages share a title', why: 'w', fix: 'f', where: [{ url: 'https://example.com/a', says: 's' }] } as never;
    for (const findings of [[], [finding]]) expect(auditHtml(BARE_REPORT, findings, new Date('2026-11-14'))).not.toMatch(SENTENCE);
  });
  it('the check finds the sentence where it is (planted)', () => {
    expect('The free short audit is limited to one per month per Google account.').toMatch(SENTENCE);
  });
});

// TODO 1.4: the parent's suite-words.test.ts (G-636) held a delivered suite's documents and the audit's files to the review
// vocabulary. A suite is not Ghostreach's; its subject here is the audit page, as the made-up fixtures' crawls render it, every
// finding in, read with the parent's own list (test/support/prospect-words.ts at a4c8045): a verdict on the site, a line that judges
// its team, and "scan". The leaf's BANNED_PHRASES is stricter ("problem" alone): SITE-29's why says "a security problem", so the
// page fails it; which gives way is a question for the ruling grade (J-017), and the PDF's text is held to the leaf's list later.
const PARENT_BANNED = /what is wrong|wrong with|nothing wrong|\bdefects?\b|problems? found|the site is broken|nobody (?:looks after|checked)|thinking less/i;
const SCAN = /\bscan/i;
describe('the audit page, in the review vocabulary (the parent\'s suite-words, G-636)', () => {
  const golden = new URL('../golden/', import.meta.url);
  const crawls = fs.readdirSync(golden).filter((n) => n.endsWith('.crawl.json'));
  const page = (name: string): string => {
    const report = auditedCrawl(new URL(name, golden).pathname);
    return auditHtml(report, siteFindings(report), new Date('2026-11-14'));
  };
  it('reads the fixtures\' crawls, not none, each with findings', () => {
    expect(crawls.length).toBeGreaterThanOrEqual(3);
    for (const name of crawls) expect(page(name), name).toContain('<span class="code">SITE-');
  });
  it.each(crawls)('%s: the audit page says nothing of what is wrong, a defect, or the team, and never "scan"', (name) => {
    const html = page(name);
    expect(PARENT_BANNED.exec(html)?.[0]).toBeUndefined();
    expect(SCAN.exec(html)?.[0]).toBeUndefined();
  });
  it('the check finds each where it is (planted)', () => {
    for (const word of ['What is wrong', 'wrong with the site', 'nothing wrong', 'defect', 'Defects', '3 problems found', 'the site is broken', 'nobody looks after it', 'nobody checked', 'thinking less of it']) expect(PARENT_BANNED.test(page(crawls[0]).replace('</h1>', ` ${word}</h1>`)), word).toBe(true);
    expect(SCAN.test(page(crawls[0]).replace('</h1>', ' a short scan</h1>'))).toBe(true);
    expect(PARENT_BANNED.test('a wrong username or password; When something goes wrong; 2 broken links; nothing to report; a finding about the site')).toBe(false);
  });
});
