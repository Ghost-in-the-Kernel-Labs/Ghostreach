import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { auditHtml } from '../../src/audit/audit.js';
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
