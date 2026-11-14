/**
 * suite audit (G-134, G-633): an automated review of a site, its findings read from a crawl, as one page its owner can read
 * (AUDIT.html, self-contained: no script, no file beside it) and no suite. The findings are the
 * grouping's (src/group/findings.ts), the same ones every build says first and every suite's
 * KNOWN-ISSUES.md lists; this only says them to a person who will never open a test.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CrawlReport } from '../leaf/report.js';
import { siteFindings } from '../findings/findings.js';
import { counting, LOOK_INTRO, LOOK_TITLE, linksToLookAt, lookFrom, type LinkToLook } from './links-to-look.js';
import type { SiteFinding } from '../findings/types.js';
import { issuesIn, ranked } from '../findings/finding-order.js';
import { roleOf, shownPath } from '../leaf/pages/url.js';
import { findingAddress } from '../leaf/pages/finding-address.js';
import { H } from '../leaf/heuristics/java-suite.js';
import { PRODUCT_TOKEN } from '../leaf/report.js';
import { errorsApart, pageCounts } from './page-counts.js';
import { auditChecked, auditScope, checksRan, onlyReadings } from './audit-checked.js';
import { CHECKS } from '../findings/check-catalogue.js';

/**
 * What a short audit (suite audit --short, G-142) tells its reader about the free short audit's limit. The
 * service that runs the CLI holds the limit (it knows the account); this is its sentence, said once.
 */
export const FREE_SCAN_LIMIT = 'The free short audit is limited to one per month per Google account.';

/**
 * What both audits say in their own words (G-633): a machine's review, never a claim of security (test/unit/audit.test.ts bans the
 * words), and each fact it states follows the report's (test/unit/audit-truth.test.ts).
 */
// Decision: G-633
export const auditHeading = (host: string): string => `Automated site review: ${host}`;

/** How a text and a literal are written in a file: HTML escapes both, Markdown escapes the one and fences the other. */
export interface Say {
  text: (s: string) => string;
  code: (s: string) => string;
}

/** The report's facts, which an older or partial report may lack. */
const factsOf = (report: CrawlReport): Partial<CrawlReport> => report;


/** What follows "N pages of <origin>" under the heading: a read that signed in says how (a form was sent, or a saved session was used), else that nothing was sent. */
// Decision: G-633
export function auditReadBy(report: CrawlReport, day: string, say: Say): string {
  const ok = (factsOf(report).signIns ?? []).filter((x) => x.ok);
  const by = `read on ${day} by Suite Builder's crawler in a real browser, logged out`;
  const end = auditScope(report, CHECKS);
  const roles = (kept: typeof ok) => say.text([...new Set(kept.map((x) => x.role))].join(', '));
  if (!ok.length) return `${by}, as a first-time visitor sees them. Nothing was sent, bought or signed in to. ${end}`;
  // The pages behind a sign-in are counted as the heading counts: those that answered.
  const behind = report.pages.filter((p) => p.status !== null && roleOf(p.url) !== null).length;
  const sessions = ok.filter((x) => x.session);
  const forms = ok.filter((x) => !x.session);
  if (!forms.length) return `${by}, then signed in as ${roles(sessions)} with a saved session (${n(behind, 'page')} behind it). No form was sent. ${end}`;
  if (!sessions.length) return `${by}, then signed in as ${roles(forms)} (${n(behind, 'page')} behind the sign-in). The only form sent was the sign-in. ${end}`;
  return `${by}, then signed in as ${roles(sessions)} with a saved session and as ${roles(forms)} through the sign-in form (${n(behind, 'page')} behind the sign-ins). The only form sent was the sign-in. ${end}`;
}

const SEVERITY_WORDS = 'Major: lets a visitor or a search engine down now. Minor: worth fixing. Info: said for the record; counts against nothing.';

/** The severities, and whether the pages a finding lists may be a sample: only a read that did not end of itself may have missed more. */
// Decision: G-633
export function auditSeverities(report: CrawlReport): string {
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
    'session-lost': 'The read stopped early: the sign-in ended.',
  };
  const count = (...why: string[]) => (r.notCrawled ?? []).filter((x) => why.includes(x.reason)).length;
  const [left, robots] = [count('unread', 'stopped', 'page-limit'), count('robots')];
  // Past H.NOT_CRAWLED_MAX addresses are only counted (notCrawledLeft), so a listed count is a lower bound.
  const least = r.notCrawledLeft ? 'At least ' : '';
  const signedIn = (r.signIns ?? []).some((x) => x.ok);
  const refused = report.pages.filter((p) => p.status === 401 || p.status === 403 || p.status === 429).length;
  return [
    r.stopReason ? early[r.stopReason] : undefined,
    left ? `${least}${n(left, 'address', 'addresses')} ${left === 1 ? 'was' : 'were'} not read.` : undefined,
    robots ? `${least}${n(robots, 'address', 'addresses')} ${robots === 1 ? 'was' : 'were'} left unread: robots.txt disallows ${robots === 1 ? 'it' : 'them'}.` : undefined,
    refused ? `${n(refused, 'page')} answered 401, 403 or 429, which ${signedIn ? 'the read' : 'a read as a first-time visitor'} ${signedIn ? 'could not' : 'cannot'} get past.` : undefined,
  ].filter((x): x is string => x !== undefined);
}

/** What a review that found nothing says first: how many checks ran, over how many pages (G-637); never a claim about a check that did not run. */
// Decision: G-637
function noneFound(report: CrawlReport, read: number): string {
  const ran = checksRan(report, CHECKS);
  return ran ? `None of the ${n(ran, 'check')} that ran found anything on the ${n(read, 'page')} it read.` : `No check ran on the ${n(read, 'page')} it read.`;
}

/** A review that found nothing says what it checked and what it could not do, never that every page was fine. */
// Decision: G-633
export function auditNothing(report: CrawlReport): { title: string; body: string } {
  const { read } = auditCounts(report, []);
  const said = noneFound(report, read);
  const of = (factsOf(report).signIns ?? []).some((x) => x.ok) ? 'the site as it is served' : 'the public site';
  return { title: 'Nothing to report', body: [said, ...readLimits(report), `That is what an automated read of ${of} can say${onlyReadings(report, CHECKS) ? '; it is not a security test.' : '.'}`].join(' ') };
}

/** The footer of a read whose User-Agent names the crawler. */
export const AUDIT_FOOTER = "Read by Suite Builder's crawler, which identifies itself in its User-Agent and obeys robots.txt.";

/** The footer for this read: under --user-agent it names the one used, not one that identifies the crawler. */
// Decision: G-633
export function auditFooter(report: CrawlReport, say: Say): string {
  const ua = factsOf(report).options?.userAgent;
  if (ua === undefined || ua.includes(PRODUCT_TOKEN)) return AUDIT_FOOTER;
  return `Read by Suite Builder's crawler, which used ${ua.trim() ? `the User-Agent ${say.code(ua)}` : "the browser's own User-Agent"} and obeys robots.txt.`;
}

/** What a short audit shows: the H.SHORT_FINDINGS most critical findings, and how much it found in all (G-193). */
// Decision: G-193
export function shortView(findings: SiteFinding[]): { top: SiteFinding[]; issues: number; kinds: number; major: number; minor: number } {
  const all = ranked(findings);
  const counted = counting(all);
  return {
    top: all.filter((f) => !f.unconfirmed).slice(0, H.SHORT_FINDINGS), // G-655: what the crawler could not confirm never leads
    issues: counted.reduce((n, f) => n + issuesIn(f), 0),
    kinds: counted.length,
    major: all.filter((f) => f.severity === 'major').reduce((n, f) => n + issuesIn(f), 0),
    minor: all.filter((f) => f.severity === 'minor').reduce((n, f) => n + issuesIn(f), 0),
  };
}

/** What --fail-on takes: the least severe finding that fails the audit. */
export const FAIL_ON = ['major', 'minor'] as const;
type FailOn = (typeof FAIL_ON)[number];

/** True when a finding is at least as severe as --fail-on asks. */
export function failsAudit(findings: SiteFinding[], failOn: FailOn | undefined): boolean {
  if (!failOn) return false;
  return findings.some((f) => f.severity === 'major' || (failOn === 'minor' && f.severity === 'minor'));
}

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
function checkedHtml(report: CrawlReport): string {
  const { summary, groups, note } = auditChecked(report, CHECKS);
  const list = groups.map((g) => `<h3>${esc(g.title)}</h3><ul>${g.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`).join('');
  return `<section class="checked"><h2>What this review checked</h2><p>${esc(summary)}</p><details><summary>The checks, by kind</summary>${list}${note ? `<p class="says">${esc(note)}</p>` : ''}</details></section>`;
}

/** What both audits say first: the site's host, how many findings are major and minor, how many pages answered. */
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

/** The page: the site, when and how it was read, the links that need a look, the counts, then each finding, the most serious first. */
// Decision: G-134
export function auditHtml(report: CrawlReport, findings: SiteFinding[], when = new Date(), short = false): string {
  const { host, major, minor, read, apart } = auditCounts(report, findings);
  const view = shortView(findings);
  const shown = short ? view.top : ranked(findings);
  const nothing = auditNothing(report);
  const body = findings.length
    ? shown.map(findingHtml).join('\n')
    : `<section class="finding none"><h2>${nothing.title}</h2><p>${esc(nothing.body)}</p></section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Site audit: ${esc(host)}</title>
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
<p class="sub">${read} page${read === 1 ? '' : 's'} of ${esc(report.origin)}${apart}, ${auditReadBy(report, when.toISOString().slice(0, 10), { text: esc, code: esc })}</p>
${linksToLookHtml(linksToLookAt(ranked(findings)))}<div class="counts"><div class="count major"><b>${major}</b>major</div><div class="count minor"><b>${minor}</b>minor</div></div>
<p class="sub">${auditSeverities(report)}</p>
${checkedHtml(report)}
${short ? `<section class="finding short"><h2>A short review</h2><p>${esc(shortSaid(report, findings))}</p><p>The full audit lists every one of them, on every page, with why it matters and the fix.</p><p>${esc(FREE_SCAN_LIMIT)}</p></section>` : ''}
${body}
<footer>${auditFooter(report, { text: esc, code: esc })}</footer>
</main></body></html>
`;
}

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** What the crawler could not confirm, counted apart from the issues (G-668): "2 unconfirmed, listed last in the full audit ..."; "" when none. */
// Decision: G-668
function unconfirmedSaid(findings: SiteFinding[]): string {
  const count = findings.filter((f) => f.unconfirmed).reduce((sum, f) => sum + issuesIn(f), 0);
  return count ? `Not counted: ${count} unconfirmed, listed last in the full audit (other sites may turn an automated visitor away).` : '';
}

/** What a short review found, in one or two sentences: the total, then which it shows (G-193). */
// Decision: G-193
export function shortSaid(report: CrawlReport, findings: SiteFinding[]): string {
  const { read } = auditCounts(report, findings);
  const v = shortView(findings);
  const apart = unconfirmedSaid(findings);
  if (!v.issues) return [noneFound(report, read), apart].filter(Boolean).join(' ');
  const split = [v.major ? `${v.major} major` : '', v.minor ? `${v.minor} minor` : ''].filter(Boolean).join(', ');
  const shows = v.kinds <= v.top.length ? (v.kinds === 1 ? 'Here it is.' : 'Here they are, the most critical first.') : `Here are the ${v.top.length} most critical.`;
  return [`The audit read ${n(read, 'page')} and found ${n(v.issues, 'issue')} (${split}) of ${n(v.kinds, 'kind')}. ${shows}`, apart].filter(Boolean).join(' ');
}

/** The site's findings; the same list for a suite's audit, a site's and the Markdown. */
export function auditFindings(report: CrawlReport): SiteFinding[] {
  return siteFindings(report);
}

/** Audits a crawl: its findings, and AUDIT.html written into dir. */
export function writeAudit(report: CrawlReport, dir: string, crawled: Date, short = false): { file: string; findings: SiteFinding[] } {
  const findings = auditFindings(report);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'AUDIT.html');
  writeFileSync(file, auditHtml(report, findings, crawled, short));
  return { file, findings };
}
