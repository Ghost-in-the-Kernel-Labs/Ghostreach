/**
 * ghostreach <site> against the parent's fixture site, in real Chromium (TODO 1.5, 1.6; REV-05, REV-06, REV-07): the one command,
 * run as the salesperson runs it (no flag, the crawl's own pace), writes its review into <data>/<host>-<date>/; its findings, in
 * order, are the parent's for the same fixture (test/golden/fixture-site.findings.json), and its AUDIT.html the parent's
 * (test/golden/fixture-site.AUDIT.html) but for the differences test/support/audit-golden.ts names, both recorded by the parent's
 * own code (scripts/parent-findings.mjs). The live crawl against the parent's page is the behaviour proof of the copy's cuts and
 * of src/crawl/state.ts's split (J-014).
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

const PARENT = readFileSync(join(process.cwd(), 'test/golden/fixture-site.findings.json'), 'utf8');
/** The text with the fixture's random port replaced, as the parent's golden crawl names its origin. */
const portable = (text: string, site: FixtureSite) => text.split(site.origin).join('http://fixture.test');

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
  expect(await main([`${site.origin}/`], data)).toBe(0);

  // The day the crawl started (a run across midnight UTC names the first day).
  const day = readdirSync(data).length === 1 && readdirSync(data)[0] === `127.0.0.1-${today()}` ? today() : before;
  const folder = join(data, `127.0.0.1-${day}`);
  expect(readdirSync(data)).toEqual([`127.0.0.1-${day}`]);
  // REV-06: the crawl kept beside the audit, and nothing else written.
  expect(readdirSync(folder).sort()).toEqual(['127.0.0.1.crawl.json', 'AUDIT.html', 'findings.json', 'summary.json']);

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
  const written = auditedCrawl(join(folder, '127.0.0.1.crawl.json'));
  expect(html).toBe(auditHtml(written, siteFindings(written), new Date(`${day}T12:00:00Z`)));
  const golden = join(data, 'fixture.test.crawl.json');
  writeFileSync(golden, portable(crawlText, site));
  const normalised = auditedCrawl(golden);
  expect(asParent(auditHtml(normalised, siteFindings(normalised), GOLDEN_WHEN))).toBe(parentAudit());
  // The crawler kept to robots.txt and never asked for the PDF, as the parent's does.
  expect(site.pagePaths().filter((p) => p.startsWith('/private/') || p.endsWith('.pdf'))).toEqual([]);
});
