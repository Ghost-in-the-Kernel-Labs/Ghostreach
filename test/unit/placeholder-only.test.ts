/**
 * A field named only by its placeholder is its own finding, minor (G-665, TODO 132 box 3b). Ghost, 2026-11-08: SITE-08 "minor for a
 * field with a placeholder, said as no visible label". On irthsolutions.com the footer's email field had a placeholder, which a
 * screen reader reads out, yet the audit said it announced "edit text" (major); the filter select beside it had neither, and is.
 */
import { describe, expect, it } from 'vitest';
import type { CrawledPage, PageMarkup } from '../../src/leaf/report.js';
import { markupFindings } from '../../src/findings/markup-findings.js';
import { page, report } from '../support/review-reports.js';

const FINE = { lang: 'en', viewport: 'width=device-width, initial-scale=1', description: 'A page.' };
const at = (path: string, markup: Partial<PageMarkup>): CrawledPage => page(path, 200, { fingerprint: { hash: path, paths: ['div'] }, markup: { ...FINE, ...markup } } as Partial<CrawledPage>);
const one = (pages: CrawledPage[], code: string) => markupFindings(report(pages)).find((f) => f.code === code);

describe('a field named by its placeholder alone (G-665)', () => {
  const pages = [
    at('/', { placeholderOnly: { count: 1, first: ['<input name="email">'] } }),
    at('/about', { placeholderOnly: { count: 1, first: ['<input name="email">'] } }),
    at('/resources', { placeholderOnly: { count: 1, first: ['<input name="email">'] }, unlabelled: { count: 1, first: ['<select class="select">'] } }),
  ];

  it('is SITE-41, minor, said as no visible label, once for a field on every page', () => {
    const f = one(pages, 'SITE-41');
    expect(f).toMatchObject({ severity: 'minor', title: '1 form field on 3 pages has no visible label, only a placeholder' });
    expect(f?.why).toContain('A screen reader reads the placeholder out');
    expect(f?.where).toHaveLength(1);
  });

  it('a field with neither stays SITE-08, major, and its why no longer speaks of a placeholder', () => {
    const f = one(pages, 'SITE-08');
    expect(f).toMatchObject({ severity: 'major', title: '1 form field on 1 page has no label' });
    expect(f?.why).not.toMatch(/placeholder/i);
  });

  it('an older crawl, with placeholder fields still in unlabelled, reads as before: SITE-08, no SITE-41', () => {
    const old = [at('/', { unlabelled: { count: 2, first: ['<input name="email">', '<select class="select">'] } })];
    expect(one(old, 'SITE-08')?.severity).toBe('major');
    expect(one(old, 'SITE-41')).toBeUndefined();
  });
});
