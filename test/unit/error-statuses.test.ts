/**
 * Which error statuses are a visitor's error page (G-743 (2)): a link the site wrote that answers 409 is as broken as one that
 * answers 404. xoveconsulting.com's contact page answered 409 with its content, linked from every page's header, and was in no
 * finding (the corpus run of 2026-11-11, XO1): the audit said "Nothing to report". A login or a bar (401, 403), a page that wants
 * another method (405), and what the crawler meets as a bot (408, 429, 499, a bot wall's 999) are not; a 400 is the request's.
 * Made-up pages.
 */
import { describe, expect, it } from 'vitest';
import type { CrawledPage } from '../../src/leaf/report.js';
import { siteFindings } from '../../src/findings/findings.js';
import { answeredOnPurpose, isBrokenStatus } from '../../src/findings/on-purpose.js';
import { ORIGIN, page, report } from '../support/review-reports.js';

describe('a visitor\'s error status is a broken link (G-743 (2))', () => {
  it('a 409 page with content, linked from every page\'s header, is SITE-02', () => {
    const pages: CrawledPage[] = [page('/'), page('/about'), page('/services'), page('/contact.php', 409)];
    const edges = ['/', '/about', '/services'].map((from) => ({ from: `${ORIGIN}${from}`, to: `${ORIGIN}/contact.php`, text: 'Contact', region: 'header' }));
    const site02 = siteFindings(report(pages, { edges } as never)).find((f) => f.code === 'SITE-02');
    expect(site02?.where.map((w) => [new URL(w.url).pathname, w.says.split(';')[0]])).toEqual([['/contact.php', 'answered 409']]);
  });

  it('every 4xx a visitor gets as an error page, and 5xx; not a login, a bar, another method, the crawler\'s, nor a bot wall', () => {
    const broken = [404, 410, 409, 418, 422, 423, 425, 500, 503, 599];
    const not = [401, 403, 405, 407, 408, 429, 451, 499, 400, 999, 200, 301, null];
    expect(broken.filter((status) => !isBrokenStatus({ status }))).toEqual([]);
    expect(not.filter((status) => isBrokenStatus({ status }))).toEqual([]);
  });

  it('a link to a page showing what a 409 looks like is one on purpose, as a 404\'s is (SITE-34)', () => {
    expect(answeredOnPurpose(409, '/status/409', [])).toBe('its address names the status it answers (409 in /status/409)');
    expect(answeredOnPurpose(409, '/x', ['409 Conflict'])).toBe('its own words name the status it answers ("409 Conflict")');
  });
});
