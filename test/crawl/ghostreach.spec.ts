/**
 * ghostreach <site> against the parent's fixture site, in real Chromium (TODO 1.5, 1.6; REV-05, REV-06, REV-07): the one command,
 * run as the salesperson runs it (no flag, the crawl's own pace), writes its review into <data>/<host>-<date>/; its findings, in
 * order, are the parent's for the same fixture (test/golden/fixture-site.findings.json), and its AUDIT.html the parent's
 * (test/golden/fixture-site.AUDIT.html) but for the differences test/support/audit-golden.ts names, both recorded by the parent's
 * own code (scripts/parent-findings.mjs). The live crawl against the parent's page is the behaviour proof of the copy's cuts and
 * of src/crawl/state.ts's split (J-014). Its PDF (TODO 2.3) is US Letter (GR-006) on every page, and the tests' PDF reader
 * (test/support/pdf-text.ts) recovers every finding heading of the page from it; its cover and footer carry the brand (TODO 2.4).
 */
import { test, expect } from 'playwright/test';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../../src/cli/main.js';
import { startFixtureSite, type FixtureSite } from '../fixture-site/server.js';
import { GOLDEN_WHEN, asParent, parentAudit } from '../support/audit-golden.js';
import { auditHtml } from '../../src/audit/audit.js';
import { siteFindings } from '../../src/findings/findings.js';
import { auditedCrawl } from '../../src/project/crawl.js';
import { pdfName } from '../../src/project/review.js';
import { pdfPages, squeezed } from '../support/pdf-text.js';
import { ADDRESS, BYLINE } from '../../src/leaf/words.js';
import { auditChecked } from '../../src/audit/audit-checked.js';
import { CHECKS } from '../../src/findings/check-catalogue.js';
import { DEFAULT_USER_AGENT } from '../../src/leaf/report.js';

/** The length of the parent's catalogue of checks at the pin (its src/group/check-catalogue.ts at a4c8045), SITE-36 among them. */
const PARENT_CHECKS = 41;

const PARENT = readFileSync(join(process.cwd(), 'test/golden/fixture-site.findings.json'), 'utf8');
/** The text with the fixture's random port replaced, as the parent's golden crawl names its origin. */
const portable = (text: string, site: FixtureSite) => text.split(site.origin).join('http://fixture.test');

/** An HTML fragment's text: its tags dropped and the audit's escapes (`esc`) read back. */
const textOf = (fragment: string) =>
  fragment.replace(/<[^>]*>/g, '').replace(/&(lt|gt|quot|amp);/g, (_, e: string) => ({ lt: '<', gt: '>', quot: '"', amp: '&' })[e] ?? '');

/** The files of a review's folder the program keeps for its own use (REV-06), never named to the salesperson (TODO 2.5). */
const UNNAMED = /AUDIT\.html|findings\.json|summary\.json|\.crawl\.json/;

/** Runs the command as the salesperson does, keeping every line it prints: its exit code and the lines. */
async function run(argv: string[], into: string): Promise<{ code: number; lines: string[] }> {
  const lines: string[] = [];
  const log = console.log;
  console.log = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
  try {
    return { code: await main(argv, into), lines };
  } finally {
    console.log = log;
  }
}

let site: FixtureSite | undefined;
let data: string | undefined;
test.afterEach(async () => {
  await site?.close();
  if (data) rmSync(data, { recursive: true, force: true });
});

test('ghostreach <site>: the review written under <data>/<host>-<date>/, its findings the parent\'s, in order', async () => {
  test.setTimeout(240_000);
  site = await startFixtureSite();
  data = mkdtempSync(join(tmpdir(), 'ghostreach-data-'));
  const today = () => new Date().toISOString().slice(0, 10);
  const before = today();
  const { code, lines } = await run([`${site.origin}/`], data);
  expect(code).toBe(0);

  // The day the crawl started (a run across midnight UTC names the first day).
  const day = readdirSync(data).length === 1 && readdirSync(data)[0] === `127.0.0.1-${today()}` ? today() : before;
  const folder = join(data, `127.0.0.1-${day}`);
  expect(readdirSync(data)).toEqual([`127.0.0.1-${day}`]);
  // REV-06: the crawl kept beside the audit, and nothing else written.
  expect(readdirSync(folder).sort()).toEqual(['127.0.0.1 site review.pdf', '127.0.0.1.crawl.json', 'AUDIT.html', 'findings.json', 'summary.json']);
  // TODO 2.5: the PDF is the one artefact. Of the folder's files, the salesperson is shown the PDF's path alone, on the last line.
  const pdf = join(folder, '127.0.0.1 site review.pdf');
  expect(lines.at(-1)).toMatch(/^The review of 127\.0\.0\.1: 6 findings \(2 major, 4 minor\), \d+ pages read\. /);
  expect(lines.at(-1)?.endsWith(`read. ${pdf}`)).toBe(true);
  for (const line of lines) {
    expect(line).not.toMatch(UNNAMED);
    expect(line.split(pdf).join('')).not.toContain(folder);
  }

  // REV-07: the findings, in order and word for word, are the parent's for the fixture.
  const findings = portable(readFileSync(join(folder, 'findings.json'), 'utf8'), site);
  expect(JSON.parse(findings).map((f: { code: string }) => f.code)).toEqual(JSON.parse(PARENT).map((f: { code: string }) => f.code));
  expect(findings).toBe(PARENT);

  const summary = JSON.parse(readFileSync(join(folder, 'summary.json'), 'utf8'));
  expect(summary).toEqual({
    host: '127.0.0.1',
    date: day,
    pagesRead: summary.pagesRead,
    bySeverity: { major: 2, minor: 4, info: 0 },
    byCode: { 'SITE-02': 1, 'SITE-11': 1, 'SITE-17': 1, 'SITE-03': 1, 'SITE-28': 1, 'SITE-29': 1 },
  });
  const html = readFileSync(join(folder, 'AUDIT.html'), 'utf8');
  // The pages read, as the audit page counts them (the parent's fixture: 13, and the 404 apart).
  expect(html).toContain(`<p class="sub">13 pages of ${site.origin} (and 1 address that answered an error), `);
  expect(html).toContain('<title>Site audit: 127.0.0.1 | Suite Builder</title>');
  expect(html).toContain(`read on ${day} by Suite Builder's crawler`);
  expect(html).toContain('<span class="code">SITE-02</span> 1 broken link');
  // TODO 1.6: the page is the parent's for its fixture. What must vary is normalised as the parent normalises its own fixture crawl
  // (its test/support/fixture-sites.ts): the random origin, port included, written as http://fixture.test in the crawl, and the page
  // rendered from that crawl dated the golden day. The page itself is not normalised: the audit asks the host's shape (SITE-31 is
  // not asked of an address in numbers), so 127.0.0.1 written as fixture.test in the page would differ in "What this review checked".
  // The crawl file is not the parent's byte for byte (the suite's fields cut, the stripped flags' options, the settle the bare
  // defaults take): the page is what is compared. The page written is the crawl's, rendered on the day the crawl started.
  const crawlText = readFileSync(join(folder, '127.0.0.1.crawl.json'), 'utf8');
  // GR-017: what the site's owner reads in its log: every request names forecursor, the not-found probe under its name too;
  // and the crawl file says who wrote it.
  expect([...new Set(site.requests.map((r) => r.userAgent))]).toEqual([DEFAULT_USER_AGENT]);
  expect(site.requests.filter((r) => r.path.includes('no-such-page')).map((r) => r.path)).toEqual([expect.stringMatching(/^\/forecursor-no-such-page-[0-9a-f]{8}$/)]);
  expect(JSON.parse(crawlText).tool).toBe('forecursor');
  const written = auditedCrawl(join(folder, '127.0.0.1.crawl.json'));
  expect(html).toBe(auditHtml(written, siteFindings(written), new Date(`${day}T12:00:00Z`)));
  const golden = join(data, 'fixture.test.crawl.json');
  writeFileSync(golden, portable(crawlText, site));
  const normalised = auditedCrawl(golden);
  expect(asParent(auditHtml(normalised, siteFindings(normalised), GOLDEN_WHEN))).toBe(parentAudit());
  // TODO 2.3: the PDF, at US Letter on every page (GR-006: 612 by 792 points), its text holding every finding's heading as the
  // page writes it (the links that need a look among them), in order; the severity badge apart, which CSS upper-cases in print.
  expect(pdfName('127.0.0.1')).toBe('127.0.0.1 site review.pdf');
  const pages = pdfPages(readFileSync(join(folder, pdfName('127.0.0.1'))));
  expect(pages.length).toBeGreaterThan(1);
  expect(pages.map(({ width, height }) => [width, height])).toEqual(pages.map(() => [612, 792]));
  const headings = [...html.matchAll(/<section class="finding [^"]*"><h2>(.*?)<\/h2>/g)].map(([, h]) => squeezed(textOf(h.replace(/<span class="badge">[^<]*<\/span>/, ''))));
  expect(headings.length).toBe(7);
  const text = squeezed(pages.map((p) => p.text).join('\n'));
  let from = 0;
  for (const heading of headings) {
    const at = text.indexOf(heading, from);
    expect(at, heading).toBeGreaterThanOrEqual(0);
    from = at + heading.length;
  }
  // TODO 2.6: "What this review checked" closes the PDF, after the last finding, its list open: every check of the catalogue
  // (G-637) listed, in the page's order and words, and so the parent's catalogue less its SITE-36, which was not copied (1.3).
  const checkedAt = text.indexOf('What this review checked', from);
  expect(checkedAt, 'after the last finding').toBeGreaterThanOrEqual(0);
  const { summary: said, groups } = auditChecked(written);
  const checkLines = groups.flatMap((g) => [g.title, ...g.lines]).map(squeezed);
  let at = text.indexOf(squeezed(said), checkedAt);
  expect(at, said).toBeGreaterThanOrEqual(0);
  let listed = 0;
  for (const line of checkLines) {
    const found = text.indexOf(line, at);
    expect(found, line).toBeGreaterThanOrEqual(0);
    at = found + line.length;
    if (!groups.some((g) => squeezed(g.title) === line)) listed += 1;
  }
  expect(listed).toBe(CHECKS.length);
  expect(listed).toBe(PARENT_CHECKS - 1);
  expect(CHECKS.map((c) => c.code)).not.toContain('SITE-36');
  // TODO 2.4: the brand. The cover first, naming the wordmark, the site, the day, the byline and Ghost's address (GR-012); the
  // address in the footer of every page; this program's name on none (the data folder's name is ours, and never printed).
  const cover = squeezed(pages[0].text);
  for (const part of ['Suite Builder', '127.0.0.1', day, BYLINE, ADDRESS]) expect(cover, part).toContain(part);
  pages.forEach((p, i) => expect(p.text, `page ${i + 1}`).toContain(ADDRESS));
  expect(text).not.toMatch(/ghostreach/i);
  // The crawler kept to robots.txt and never asked for the PDF, as the parent's does.
  expect(site.pagePaths().filter((p) => p.startsWith('/private/') || p.endsWith('.pdf'))).toEqual([]);
});

test('ghostreach <site> that does not answer: no review, and no file of the folder named (TODO 2.5)', async () => {
  test.setTimeout(120_000);
  site = await startFixtureSite();
  const origin = site.origin;
  await site.close();
  site = undefined;
  data = mkdtempSync(join(tmpdir(), 'ghostreach-data-'));
  const { code, lines } = await run([`${origin}/`], data);
  expect(code).toBe(2);
  expect(lines.at(-1)).toMatch(/^No review was written: .*\.$/);
  for (const line of lines) {
    expect(line).not.toMatch(UNNAMED);
    expect(line).not.toContain(data);
  }
});
