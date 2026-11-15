/**
 * The audit (G-134, G-633): an automated review of a site, its findings read from a crawl, as one page its owner can read
 * (AUDIT.html, self-contained: no script, no file beside it) and no suite. The findings are the parent's grouping's
 * (src/findings/findings.ts); this says them to a person who will never open a test. One audit, the full one: no option
 * shortens, gates or adds to it (GR-003).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CrawlReport } from '../leaf/report.js';
import { siteFindings } from '../findings/findings.js';
import { LOOK_INTRO, LOOK_TITLE, linksToLookAt, lookFrom, type LinkToLook } from './links-to-look.js';
import type { SiteFinding } from '../findings/types.js';
import { ranked } from '../findings/finding-order.js';
import { shownPath } from '../leaf/pages/url.js';
import { findingAddress } from '../leaf/pages/finding-address.js';
import { ALONGSIDE, BYLINE } from '../leaf/words.js';
import { errorsApart, pageCounts } from './page-counts.js';
import { auditChecked, auditScope, checksRan, onlyReadings } from './audit-checked.js';
import { CHECKS, type Check } from '../findings/check-catalogue.js';

/**
 * What the audit says in its own words (G-633): a machine's review, never a claim of security (test/unit/audit.test.ts bans the
 * words), and each fact it states follows the report's (test/unit/audit-truth.test.ts).
 */
// Decision: G-633
const auditHeading = (host: string): string => `Automated site review: ${host}`;

/** The report's facts, which an older or partial report may lack. */
const factsOf = (report: CrawlReport): Partial<CrawlReport> => report;


/** What follows "N pages of <origin>" under the heading: who read it, when, and that nothing was sent (the read never signs in, GR-003). */
// Decision: G-633
function auditReadBy(report: CrawlReport, day: string, catalogue: readonly Check[]): string {
  return `read on ${day} by Suite Builder's crawler in a real browser, logged out, as a first-time visitor sees them. Nothing was sent, bought or signed in to. ${auditScope(report, catalogue)}`;
}

const SEVERITY_WORDS = 'Major: lets a visitor or a search engine down now. Minor: worth fixing. Info: said for the record; counts against nothing.';

/** The severities, and whether the pages a finding lists may be a sample: only a read that did not end of itself may have missed more. */
// Decision: G-633
function auditSeverities(report: CrawlReport): string {
  const ended = factsOf(report).stopReason;
  const sure = ended === 'page-limit' || ended === 'saturated';
  const reach = ended === 'complete' ? '.' : `; the read ${sure ? 'is a sample of a big' : 'may be a sample of the'} site, so a finding can reach further than it lists.`;
  return `${SEVERITY_WORDS} Each finding lists every page the read saw it on${reach}`;
}

/** What the read could not do, from the report: how it ended, what it left unread, what refused it. */
// Decision: G-633
function readLimits(report: CrawlReport): string[] {
  const r = factsOf(report);
  const early: Partial<Record<CrawlReport['stopReason'], string>> = {
    'rate-limited': 'The read stopped early because the site answered 429 (too many requests).',
    'too-many-errors': 'The read stopped early after several pages in a row failed to load, or the browser it read in closed.',
    'page-limit': 'The read stopped at its page limit.',
    saturated: 'The read stopped when pages in a row taught nothing new: the rest is more of the same.',
  };
  const count = (...why: string[]) => (r.notCrawled ?? []).filter((x) => why.includes(x.reason)).length;
  const [left, robots] = [count('unread', 'stopped', 'page-limit'), count('robots')];
  // Past H.NOT_CRAWLED_MAX addresses are only counted (notCrawledLeft), so a listed count is a lower bound.
  const least = r.notCrawledLeft ? 'At least ' : '';
  const refused = report.pages.filter((p) => p.status === 401 || p.status === 403 || p.status === 429).length;
  return [
    r.stopReason ? early[r.stopReason] : undefined,
    left ? `${least}${n(left, 'address', 'addresses')} ${left === 1 ? 'was' : 'were'} not read.` : undefined,
    robots ? `${least}${n(robots, 'address', 'addresses')} ${robots === 1 ? 'was' : 'were'} left unread: robots.txt disallows ${robots === 1 ? 'it' : 'them'}.` : undefined,
    refused ? `${n(refused, 'page')} answered 401, 403 or 429, which a read as a first-time visitor cannot get past.` : undefined,
  ].filter((x): x is string => x !== undefined);
}

/** What a review that found nothing says first: how many checks ran, over how many pages (G-637); never a claim about a check that did not run. */
// Decision: G-637
function noneFound(report: CrawlReport, read: number, catalogue: readonly Check[]): string {
  const ran = checksRan(report, catalogue);
  return ran ? `None of the ${n(ran, 'check')} that ran found anything on the ${n(read, 'page')} it read.` : `No check ran on the ${n(read, 'page')} it read.`;
}

/** A review that found nothing says what it checked and what it could not do, never that every page was fine. */
// Decision: G-633
function auditNothing(report: CrawlReport, catalogue: readonly Check[]): { title: string; body: string } {
  const { read } = auditCounts(report, []);
  const said = noneFound(report, read, catalogue);
  return { title: 'Nothing to report', body: [said, ...readLimits(report), `That is what an automated read of the public site can say${onlyReadings(report, catalogue) ? '; it is not a security test.' : '.'}`].join(' ') };
}

/**
 * The page's title (TODO 1.6): the parent's, with the name a prospect reads the review under, Suite Builder's, never this
 * program's (ROADMAP §1). One of the two lines in which this page differs from the parent's (test/unit/audit-golden.test.ts).
 */
const auditTitle = (host: string): string => `Site audit: ${host} | Suite Builder`;

/**
 * The footer: the crawler names itself in its User-Agent, always (GR-003: no other is given); then who prepared the review, in the
 * words of the PDF's cover (ROADMAP 2.4). The other line in which this page differs from the parent's (TODO 1.6).
 */
export const AUDIT_FOOTER = `Read by the forecursor crawler, which identifies itself in its User-Agent and obeys robots.txt. ${BYLINE}.`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One finding: its severity and code, title, why, fix, and every page that shows it. */
function findingHtml(f: SiteFinding): string {
  const pages = f.where.map((w) => `<li><a href="${esc(w.url)}">${esc(w.offSite ? findingAddress(w) : shownPath(w.url))}</a> <span class="says">${esc(w.says)}</span></li>`).join('');
  return `<section class="finding ${f.severity}"><h2><span class="badge">${f.severity}</span> <span class="code">${f.code}</span> ${esc(f.title)}</h2>
<p><strong>Why it matters.</strong> ${esc(f.why)}</p>
<p><strong>Likely fix.</strong> ${esc(f.fix)}</p>
<details${f.where.length <= 12 ? ' open' : ''}><summary>${f.where.length} ${esc(f.where.length === 1 ? (f.listed?.[0] ?? 'page') : (f.listed?.[1] ?? 'pages'))}${f.unlisted ? ' listed' : ''}</summary><ul>${pages}</ul>${f.unlisted ? `<p class="unlisted">${esc(f.unlisted)}</p>` : ''}${f.repeated ? `<p class="unlisted">${esc(f.repeated)}</p>` : ''}</details></section>`;
}

/** The links that need a look (item 71, G-351): first in the page, before the counts, every one named; nothing when there are none. */
// Decision: G-351
function linksToLookHtml(links: LinkToLook[]): string {
  if (!links.length) return '';
  const rows = links.map((l) => `<li><code>${esc(l.address)}</code> <span class="says">${esc(l.answer)}; ${esc(lookFrom(l))}; ${esc(l.why)} (${esc(l.codes.join(', '))})</span></li>`).join('');
  return `<section class="finding look"><h2>${LOOK_TITLE} (${links.length})</h2><p>${esc(LOOK_INTRO)}</p><ul>${rows}</ul></section>\n`;
}

/** What the review checked, as the HTML page has it: the count said at once, the checks by group in a closed list a keyboard opens. */
// Decision: G-637
function checkedHtml(report: CrawlReport, catalogue: readonly Check[]): string {
  const { summary, groups, note } = auditChecked(report, catalogue);
  const list = groups.map((g) => `<h3>${esc(g.title)}</h3><ul>${g.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`).join('');
  return `<section class="checked"><h2>What this review checked</h2><p>${esc(summary)}</p><details><summary>The checks, by kind</summary>${list}${note ? `<p class="says">${esc(note)}</p>` : ''}</details></section>`;
}

/** What the audit says first: the site's host, how many findings are major and minor, how many pages answered. */
export function auditCounts(report: CrawlReport, findings: SiteFinding[]): { host: string; major: number; minor: number; read: number; apart: string } {
  // The pages read, as the crawl's summary and the grouping count them; the addresses that answered an error apart (G-747).
  const pages = pageCounts(report);
  return {
    host: new URL(report.origin).hostname,
    major: findings.filter((f) => f.severity === 'major').length,
    minor: findings.filter((f) => f.severity === 'minor').length,
    read: pages.read,
    apart: errorsApart(pages),
  };
}

/**
 * The page: the site, when and how it was read, the links that need a look, the counts, then each finding, the most serious first.
 * `alongside` (GR-014): the crawl ran beside another review; the page says so before its findings and lists SITE-22 as not timed.
 */
// Decision: G-134, GR-014
export function auditHtml(report: CrawlReport, findings: SiteFinding[], when = new Date(), alongside = false): string {
  const { host, major, minor, read, apart } = auditCounts(report, findings);
  const catalogue = alongside ? untimedChecks(CHECKS) : CHECKS;
  const nothing = auditNothing(report, catalogue);
  const body = findings.length
    ? ranked(findings).map(findingHtml).join('\n')
    : `<section class="finding none"><h2>${nothing.title}</h2><p>${esc(nothing.body)}</p></section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(auditTitle(host))}</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1d1b;--dim:#6b6a65;--line:#e4e1d8;--major:#b3261e;--minor:#9a6700;--ok:#1a7f37;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--fg:#ecebe6;--dim:#a19f97;--line:#33322e;--major:#ff8a80;--minor:#e3b341;--ok:#56d364;--card:#1e1e1b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}h1{font-size:1.7rem;margin:0 0 4px}.sub{color:var(--dim);margin:0 0 24px}
.counts{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 28px}.count{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;min-width:120px}
.count b{display:block;font-size:1.6rem}.count.major b{color:var(--major)}.count.minor b{color:var(--minor)}
.finding{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--line);border-radius:10px;padding:16px 20px;margin:0 0 16px}
.finding.short,.finding.owner{border-left-color:var(--dim)}.finding.look{border-left-color:var(--major)}.finding.major{border-left-color:var(--major)}.finding.minor{border-left-color:var(--minor)}.finding.none{border-left-color:var(--dim)}
.finding h2{font-size:1.1rem;margin:0 0 10px}.badge{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;border-radius:5px;color:var(--card);vertical-align:2px}
.major .badge{background:var(--major)}.minor .badge{background:var(--minor)}.info .badge{background:var(--dim)}.code{color:var(--dim);font-weight:500}
ul{padding-left:20px;margin:8px 0 0}li{margin:2px 0;overflow-wrap:anywhere}.says{color:var(--dim)}a{color:inherit}
summary{cursor:pointer;color:var(--dim)}.checked{margin:0 0 24px}.checked h2{font-size:1.1rem;margin:0 0 6px}.checked h3{font-size:.95rem;margin:12px 0 0}footer{color:var(--dim);font-size:.85rem;margin-top:32px;border-top:1px solid var(--line);padding-top:12px}
</style></head><body><main>
<h1>${esc(auditHeading(host))}</h1>
<p class="sub">${read} page${read === 1 ? '' : 's'} of ${esc(report.origin)}${apart}, ${auditReadBy(report, when.toISOString().slice(0, 10), catalogue)}</p>
${alongside ? `<p class="sub alongside">${esc(ALONGSIDE)}</p>\n` : ''}${linksToLookHtml(linksToLookAt(ranked(findings)))}<div class="counts"><div class="count major"><b>${major}</b>major</div><div class="count minor"><b>${minor}</b>minor</div></div>
<p class="sub">${auditSeverities(report)}</p>
${checkedHtml(report, catalogue)}

${body}
<footer>${AUDIT_FOOTER}</footer>
</main></body></html>
`;
}

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The finding that is a timing (SITE-22, slow pages): what a crawl run beside another review cannot take (GR-014). */
const TIMED = 'SITE-22';

/** The catalogue as a review whose crawl ran beside another says it: the timing check not timed, every other as it is. */
// Decision: GR-014
function untimedChecks(catalogue: readonly Check[]): Check[] {
  return catalogue.map((c) => (c.code === TIMED ? { ...c, ran: () => 'not-timed' as const } : c));
}

/** The site's findings; without SITE-22 when the crawl ran beside another review (GR-014), the rest as they are. */
// Decision: GR-014
function auditFindings(report: CrawlReport, alongside: boolean): SiteFinding[] {
  const findings = siteFindings(report);
  return alongside ? findings.filter((f) => f.code !== TIMED) : findings;
}

/**
 * Audits a crawl: its findings, and AUDIT.html written into dir. `alongside` (GR-014): the crawl ran beside another review, so
 * SITE-22 is withheld, its check said as not timed, and the page says so before its findings (ALONGSIDE); false, the parent's page.
 */
export function writeAudit(report: CrawlReport, dir: string, crawled: Date, alongside = false): { file: string; findings: SiteFinding[] } {
  const findings = auditFindings(report, alongside);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'AUDIT.html');
  writeFileSync(file, auditHtml(report, findings, crawled, alongside));
  return { file, findings };
}
