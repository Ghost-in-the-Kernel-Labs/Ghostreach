/**
 * The audit (G-134, src/audit/audit.ts): the findings as one page for a site's owner. The findings themselves are
 * test/unit/findings.test.ts's. The parent's cases of the Markdown audit, KNOWN-ISSUES.md, the short audit, `--fail-on` and the
 * audit of a saved crawl or suite were not carried (1.4, docs/CUT.md).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CrawledPage, CrawlReport } from '../../src/leaf/report.js';
import { siteFindings } from '../../src/findings/findings.js';
import { AUDIT_FOOTER, auditHtml } from '../../src/audit/audit.js';
import { auditedCrawl } from '../../src/project/crawl.js';
import { ranked } from '../../src/findings/finding-order.js';
import type { SiteFinding } from '../../src/findings/types.js';
import { BANNED, bannedIn, literals, offences } from '../support/banned-words.js';
import { CHECKS } from '../../src/findings/check-catalogue.js';

const ORIGIN = 'https://shop.test';
const page = (path: string, status: number, h1: string, title: string) =>
  ({ url: `${ORIGIN}${path}`, finalUrl: `${ORIGIN}${path}`, status, redirects: [], title, contentType: 'text/html', depth: 1, fingerprint: { hash: path, paths: ['div'] }, headings: [h1], structure: { h1: [h1], main: true } }) as CrawledPage;
const crawl = (pages: CrawledPage[]) => ({ startUrl: `${ORIGIN}/`, origin: ORIGIN, pages, edges: pages.slice(1).map((p) => ({ from: `${ORIGIN}/`, to: p.url })) }) as CrawlReport;

const broken = crawl([page('/', 200, 'Shop', 'Shop'), page('/<sale>', 404, 'Not found', 'Not found'), page('/a', 200, 'About', 'Shop')]);
/** The made-up fixture site's crawl, as the parent's build saved it (test/golden/). */
const fixtureCrawl = JSON.parse(readFileSync(join(__dirname, '../golden/fixture-site.crawl.json'), 'utf8')) as CrawlReport;

describe('a link to another site shows its host (Ghost, 2026-11-05, G-455)', () => {
  const dead = (url: string) => ({ url, finalUrl: url, status: 404, redirects: [], title: 'Gone', contentType: 'text/html', depth: 1, fingerprint: { hash: url, paths: ['div'] }, headings: ['Gone'] }) as CrawledPage;
  const both = {
    ...crawl([page('/', 200, 'Shop', 'Shop'), dead(`${ORIGIN}/link/recipes/1`)]),
    edges: [{ from: `${ORIGIN}/`, to: `${ORIGIN}/link/recipes/1` }, { from: `${ORIGIN}/`, to: 'https://zipongo.example.org/link/recipes/1072?a=1', external: true }, { from: `${ORIGIN}/`, to: 'https://evil.example.net/`<b>x', external: true }],
    site: { external: { seen: 2, answers: [{ url: 'https://zipongo.example.org/link/recipes/1072?a=1', status: 404 }, { url: 'https://evil.example.net/%60%3Cb%3Ex', status: 404 }] } },
  } as unknown as CrawlReport;
  const findings = siteFindings(both);

  it('AUDIT.html: the same, escaped', () => {
    const html = auditHtml(both, findings);
    expect(html).toContain('>/link/recipes/1</a>');
    expect(html).toContain('>https://zipongo.example.org/link/recipes/1072?a=1</a>');
  });
});

describe('the audit page', () => {
  it('names the site and the date, counts by severity, and gives each finding its why, fix and pages, escaped', () => {
    const html = auditHtml(broken, siteFindings(broken), new Date('2026-10-03T12:00:00Z'));
    expect(html).toContain('<title>Site audit: shop.test | Suite Builder</title>');
    expect(html).toContain('<h1>Automated site review: shop.test</h1>');
    expect(html).toContain('2 pages of https://shop.test (and 1 address that answered an error), read on 2026-10-03 by Suite Builder\'s crawler in a real browser, logged out, as a first-time visitor sees them. Nothing was sent, bought or signed in to. This review reads the public site as it is served. It makes only the checks listed below (a check that did not run on this crawl is marked), and it does not test security.');
    expect(html).toContain('Major: lets a visitor or a search engine down now. Minor: worth fixing.'); // defined on the first screen, above the findings
    expect(html.indexOf('Major: lets')).toBeLessThan(html.indexOf('SITE-02</span>'));
    expect(html).toContain('<div class="count major"><b>1</b>major</div><div class="count minor"><b>1</b>minor</div>');
    expect(html).toContain('<span class="code">SITE-02</span> 1 broken link');
    expect(html).toContain('<strong>Likely fix.</strong> Point each link at a page that exists');
    expect(html).toContain('/&lt;sale&gt;'); // a page's address, escaped
    expect(html).not.toMatch(/<script|<link|src="http/); // one file, nothing fetched
  });

  it('shows each address with its query: two pages on one path are told apart (as atos.net\'s dynatrace page and its ?page=2)', () => {
    const f = { code: 'SITE-15', severity: 'minor', title: 't', why: '', fix: '', where: [{ url: `${ORIGIN}/p`, says: 'a' }, { url: `${ORIGIN}/p?page=2`, says: 'b' }] } as SiteFinding;
    const html = auditHtml(crawl([page('/', 200, 'Shop', 'Shop')]), [f]);
    expect(html).toContain('>/p</a>');
    expect(html).toContain('>/p?page=2</a>');
  });

  it('says plainly when there is nothing', () => {
    const clean = crawl([page('/', 200, 'Shop', 'Shop'), page('/a', 200, 'About', 'About')]);
    const html = auditHtml(clean, siteFindings(clean));
    expect(html).toContain('<h2>Nothing to report</h2>');
    expect(html).toContain('None of the 9 checks that ran found anything on the 2 pages it read. That is what an automated read of the public site can say; it is not a security test.');
    expect(html).not.toContain('Nothing found');
  });
});

const finding = (code: string, severity: 'major' | 'minor', pages: number) =>
  ({ code, severity, title: code, why: '', fix: '', where: Array.from({ length: pages }, (_, i) => ({ url: `${ORIGIN}/${code}/${i}`, says: '' })) }) as SiteFinding;

describe('the most critical first (G-193)', () => {
  const findings = [finding('SITE-03', 'minor', 40), finding('SITE-02', 'major', 3), finding('SITE-04', 'minor', 2), finding('SITE-06', 'major', 1)];

  it('ranks major before minor, then by how many pages a finding reaches', () => {
    expect(ranked(findings).map((f) => f.code)).toEqual(['SITE-02', 'SITE-06', 'SITE-03', 'SITE-04']);
  });

  it('the audit lists every finding in rank order', () => {
    const full = auditHtml(broken, findings);
    expect(full.indexOf('SITE-06</span>')).toBeLessThan(full.indexOf('SITE-03</span>'));
  });
});

describe('the audit never calls a result secure, clean or passed (item 107, G-633)', () => {
  // The audit's own words only: a finding here has empty why and fix, so a quoted browser or site text (SITE-27's "Not secure")
  // is not in the page. A banned word is a claim about the site the read cannot make.
  const clean = crawl([page('/', 200, 'Shop', 'Shop'), page('/a', 200, 'About', 'About')]);
  const found = [finding('SITE-02', 'major', 2), finding('SITE-03', 'minor', 1)];

  it('the heading, subtitle, counts, nothing-to-report text and footer, with findings and without', () => {
    const day = new Date('2026-10-03T12:00:00Z');
    const pages = [auditHtml(clean, [], day), auditHtml(broken, found, day)];
    for (const text of pages) {
      expect(text).toContain('This review reads the public site as it is served. It makes only the checks listed below (a check that did not run on this crawl is marked), and it does not test security.');
      expect(text).not.toMatch(BANNED);
      expect(text).not.toMatch(/nothing wrong/i);
      // Said once, above the findings, and the footer is the crawler's sentence only (restoring the old one fails).
      expect(text.split('Major: lets').length - 1).toBe(1);
      expect(text).toContain("<footer>Read by the forecursor crawler, which identifies itself in its User-Agent and obeys robots.txt. Prepared with Suite Builder, Ghost in the Kernel Labs.</footer>");
      expect(text).toContain('Info: said for the record; counts against nothing.');
    }
    expect(AUDIT_FOOTER).toBe("Read by the forecursor crawler, which identifies itself in its User-Agent and obeys robots.txt. Prepared with Suite Builder, Ghost in the Kernel Labs.");
  });

  it('the checker catches each banned word', () => {
    for (const word of ['secure', 'Passed', 'healthy', 'clean', 'compliant', 'no issues', 'vulnerability', 'vulnerable']) expect(`A ${word} site`, word).toMatch(BANNED);
    expect('Nothing to report').not.toMatch(BANNED);
  });
});

describe('every finding the audit can state is free of the banned words (G-633)', () => {
  // Only the browser's own words are let through, by exact text: nothing else hides a banned word between quotation marks.
  const BROWSER_WORDS = ['"Not secure"', '("not secure")'];
  // Literals in those files that are internal keys, never shown: the load findings' kind.
  const INTERNAL = new Set(['insecure']);
  const unquoted = (s: string) => BROWSER_WORDS.reduce((rest, w) => rest.split(w).join(''), s);

  const ruleFiles = () => {
    const dir = join(__dirname, '../../src/findings');
    return readdirSync(dir).filter((n) => n.endsWith('.ts') && /code: '(?:SITE|PROBE|LOAD)-/.test(readFileSync(join(dir, n), 'utf8'))).map((n) => ({ name: n, source: readFileSync(join(dir, n), 'utf8') }));
  };

  it('every string in every file of src/findings that states a finding, whatever the way the title, why or fix is built', () => {
    const files = ruleFiles();
    expect(files.map((f) => f.name)).toEqual(expect.arrayContaining(['findings.ts', 'load-findings.ts', 'markup-findings.ts', 'probe-findings.ts']));
    const all = files.flatMap((f) => literals(f.source).map((t) => ({ file: f.name, t })));
    expect(all.length).toBeGreaterThan(400); // the parser found the strings, not nothing
    // The whole ban holds for every string of these files, the strictest reading: no rule's own wording uses `vulnerab`, though the
    // rules of the site's own guards (class security-observation) would be let (G-637; the scoped allowance is audit-checked.test.ts's).
    // The parent's SITE-36 was not copied (1.3).
    expect(CHECKS.filter((c) => c.class === 'security-observation').map((c) => c.code)).toEqual(['SITE-24', 'SITE-25', 'SITE-29']);
    expect(all.filter(({ t }) => !INTERNAL.has(t) && bannedIn(unquoted(t)))).toEqual([]);
  });

  it('and every finding the saved crawls give, rendered as the audit does', () => {
    const codes = new Set<string>();
    const files = readdirSync(join(__dirname, '../golden')).filter((n) => n.endsWith('.crawl.json'));
    // The made-up fixtures' crawls: the parent's fourth (api-site, an API document's) is the suite side's, not copied.
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const name of files) {
      const found = siteFindings(auditedCrawl(join(__dirname, '../golden', name)));
      for (const f of found) codes.add(f.code);
      expect(found.flatMap((f) => offences({ ...f, title: unquoted(f.title), why: unquoted(f.why), fix: unquoted(f.fix) })), name).toEqual([]);
    }
    expect(codes.size).toBeGreaterThan(6); // the crawls trigger many rules, not a few
  });

  it('and the findings of the fixture crawl with failing pages, slow loads, errors and plain http added, which reach many more rules', () => {
    const c = JSON.parse(JSON.stringify(fixtureCrawl)) as CrawlReport;
    const origin = new URL(c.pages[0]!.url).origin;
    const base = c.pages.find((p) => p.status === 200)!;
    const sample = { count: 2, first: ['/a.js (404)'] };
    for (const p of c.pages) if (p.status === 200) p.load = { failed: sample, failedElsewhere: sample, scriptErrors: { count: 1, first: ['boom'] }, insecure: sample, loadMs: 9000, firstByteMs: 7000, unfinished: { afterMs: 5000 }, headers: { server: 'nginx/1.0', 'x-powered-by': 'PHP/5' } };
    c.pages.push({ ...base, url: `${origin}/g1`, finalUrl: `${origin}/g1`, status: 410, load: undefined }, { ...base, url: `${origin}/e1`, finalUrl: `${origin}/e1`, status: 500, load: undefined }, { ...base, url: `${origin}/t1`, finalUrl: `${origin}/t1`, title: '', headings: [], structure: { h1: [], main: false } });
    const found = siteFindings(c);
    expect(new Set(found.map((f) => f.code)).size).toBeGreaterThanOrEqual(14);
    expect(found.flatMap((f) => offences({ ...f, title: unquoted(f.title), why: unquoted(f.why), fix: unquoted(f.fix) }))).toEqual([]);
  });

  it("the scan sees a banned word anywhere, in quotation marks too, and lets only the browser's own words through", () => {
    expect(BANNED.test(unquoted('goes over plain http from a secure page'))).toBe(true);
    expect(BANNED.test(unquoted('says "secure" in its own words'))).toBe(true);
    expect(BANNED.test(unquoted('browsers mark the page "Not secure", and refuse'))).toBe(false);
    expect(BANNED.test(unquoted('and warn about the rest ("not secure"); what'))).toBe(false);
    expect(literals("const a = c ? `x ${y} secure` : 'p' + 'q';")).toEqual(['x ', ' secure', 'p', 'q']);
  });
});
