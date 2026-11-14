/**
 * The catalogue of checks (G-637): one entry for each rule that can produce a finding (`SITE-nn` in src/group/*.ts), with a plain
 * name, a class, and whether it RAN for a given crawl, decided from the report alone. The audit says what it checked from this
 * (src/project/audit-checked.ts); test/unit/check-catalogue.test.ts holds it equal to the rules that exist, both ways.
 *
 * `reading`: the check reads what a visitor's browser is shown and says what it saw. `security-observation`: it observes the
 * site's own security guards as a visitor's browser is shown them: the response headers a site sends or leaves out (SITE-24), the
 * server software it announces (SITE-25), and the contact it publishes for security reports (SITE-29), whose findings say, in their
 * own why, that an attacker uses what they name (Ghost, 2026-11-07: a review that looks at the site's own guards is blue-team
 * security observation, and says so). `--vulnsec` adds SITE-36 (G-701): the versions the site announces, as public lists name them; `--sec`
 * (item 107, not built) adds more. The class decides which words the audit
 * may use (test/support/banned-words.ts) and what its scope sentence says (src/project/audit-checked.ts).
 *
 * `option`: the flag a check needs to be requested at all (SITE-36 alone: `vulnsec`; every other runs in a default review). An entry whose option this
 * crawl did not request is neither listed nor counted, so a later `--sec` check neither inflates a default review's "did not run" nor
 * advertises itself in it.
 *
 * `ran` is three-valued, because a report says less than it seems to. A rule whose input the crawl did not record DID NOT RUN
 * (no markup read, no site probe, a host not asked). A rule whose evidence is recorded only when it fires, or only when a page
 * had something to say (a page's `load` is absent when nothing noteworthy was seen), could have run and found nothing, or not
 * have run at all (a crawl from before the field): that is `unknown`, said as such and never counted as run.
 */
import type { CrawledPage, CrawlReport } from '../leaf/report.js';
import { twinAskable } from '../leaf/pages/twin-name.js';
import { visitorPages } from './markup-findings.js';

export type CheckClass = 'reading' | 'security-observation';
export type Ran = 'ran' | 'not-run' | 'unknown';

/** How the checks are grouped in the audit's list, by what they look at. */
export const CHECK_GROUPS = {
  links: 'Pages and links',
  markup: 'Markup, accessibility and search',
  loading: 'Loading and speed',
  site: "The site's own addresses, certificate and headers",
} as const;
type CheckGroup = keyof typeof CHECK_GROUPS;

export interface Check {
  /** The finding code the rule gives, as `SITE-02`. */
  code: string;
  /**
   * The function that gives the code, and its file (G-660): where an agent handed a finding goes to read why it fired. For agents
   * only: the audit, a suite's documents and the help never show it (Ghost, 2026-11-08: AUDIT.md and AUDIT.html stay human-readable).
   * test/unit/check-rules.test.ts holds each to the code: the function is in the file, and every place the code is given is inside it.
   */
  rule: string;
  file: `src/group/${string}.ts`;
  /** The option a review must have been asked for to make this check; absent for every check of a default review. */
  option?: string;
  /** What the check looks at, in words a CTO reads: a short noun phrase. */
  name: string;
  group: CheckGroup;
  class: CheckClass;
  /** Whether it ran for this crawl, from the report alone. */
  ran: (report: CrawlReport) => Ran;
  /**
   * When a check that ran looked at only part of what the crawl saw (a cap on how many are asked), how much, in a reader's words:
   * "100 of the 393 addresses seen were asked, the most linked first" (G-663, G-698). Undefined when it looked at all of them.
   */
  covered?: (report: CrawlReport) => string | undefined;
  /**
   * Whether a suite's audit test can re-check one item of this finding, and how (G-748 (1), G-749; docs/AUDIT-TESTS-PLAN.md part 1):
   * `firm`, a pass means the item is fixed; `softer`, a pass is reported with "a softer check: confirm by eye"; `only`, no test can
   * say pass or fail, and why. `check` is the kind of re-check: one request (`http`), one header read (`header`), a body read
   * (`file`), a handshake (`tls`), a connection to one address (`socket`), the page opened and read (`browser`), or listening while
   * it loads (`script-errors`).
   */
  audit: AuditDecision;
}

/** How a suite re-checks an item (G-749): the kinds of check docs/AUDIT-TESTS-PLAN.md part 1 names. */
type AuditCheckKind = 'http' | 'header' | 'file' | 'tls' | 'socket' | 'browser' | 'script-errors';
export type AuditDecision = { recheck: 'firm' | 'softer'; check: AuditCheckKind } | { only: string };
// Decision: G-749
const firm = (check: AuditCheckKind): AuditDecision => ({ recheck: 'firm', check });
const softer = (check: AuditCheckKind): AuditDecision => ({ recheck: 'softer', check });
/** Why a finding no test can re-check stays a finding only (G-748 (1)). */
const ONLY = {
  slow: { only: "a measured slowness is no pass or fail: one run's machine and network decide it" },
  onPurpose: { only: 'an error answered on purpose: there is nothing to fix' },
  otherHosts: { only: "another site's hosts, as one machine's network sees them" },
  listed: { only: 'hiding a version number is not patching it, and the public lists a suite may not ask decide it' },
  chain: { only: 'the certificate chain as one machine sees it: a proxy or antivirus gives the same' },
  unfinished: { only: 'a load that did not finish, its cause not found' },
  unconfirmed: { only: 'unconfirmed by construction: the other site did not answer the crawler' },
  otherSite: { only: 'unconfirmed, and of another site or of no known source' },
} as const satisfies Record<string, AuditDecision>;

const yes = (ran: boolean): Ran => (ran ? 'ran' : 'not-run');
/** A page of the site that answered and is not a copy of one already read: the pages the rules over answers, redirects and titles look at (findings.ts filters the same way). */
const pagesRead = (r: CrawlReport) => r.pages.some((p) => p.status !== null && !p.offSite && !p.duplicateOf);
/** A rule that reads what the pages answered (status, redirects, titles, canonical links): it ran when any page of the site answered. */
const onPages = (r: CrawlReport): Ran => yes(pagesRead(r));
/** The page carries the reader's output: a reader's output is recorded on every page it read, so its absence means it did not run. */
const markupOf = (field: keyof Pick<CrawledPage, 'markup' | 'structure'>) => (r: CrawlReport): Ran => yes(visitorPages(r).some((p) => p[field]));
/** A page's `load` is kept only when something was seen, so a crawl with none could have seen nothing: unknown, not run. */
const loadData = (r: CrawlReport): Ran => (visitorPages(r).some((p) => p.load) ? 'ran' : pagesRead(r) ? 'unknown' : 'not-run');
const https = (r: CrawlReport) => r.origin.startsWith('https://');
/** A rule that can fire only on an https site (a downgrade, a plain-http request from an https page, headers a browser acts on over https): not run on an http one. */
const onHttps = (rule: (r: CrawlReport) => Ran) => (r: CrawlReport): Ran => (https(r) ? rule(r) : 'not-run');
/** Evidence that is recorded only when the rule fires proves it ran; its absence proves nothing. */
const evidence = (found: (r: CrawlReport) => boolean) => (r: CrawlReport): Ran => (found(r) ? 'ran' : pagesRead(r) ? 'unknown' : 'not-run');
const asked = (field: 'certificate' | 'http' | 'sitemap' | 'securityTxt') => (r: CrawlReport): Ran => yes(r.site?.[field] !== undefined);

/** The other name is asked after a probe, by the one condition the probe asks by (src/pages/twin-name.ts). */
const twinAsked = (r: CrawlReport) => r.site !== undefined && twinAskable(new URL(r.origin).hostname, r.options?.offline === true);

/** The check of links to other sites: asked, or not asked (offline, no other site reached), or recorded only when there were links. */
function externalLinks(r: CrawlReport): Ran {
  const e = r.site?.external;
  if (e) return yes(!e.offline && !e.unreachable);
  return r.site ? 'unknown' : 'not-run';
}

/**
 * The chain is tested by the request that asks robots.txt over https (src/crawl/robots-fetch.ts): Node's TLS refuses an incomplete
 * chain, and then robots.txt is asked once more relaxed and `certificateChain: 'incomplete'` is recorded (G-609). So an answer for
 * robots.txt (`status` not null: any answer, a 404 or a 5xx too) means the strict request got through the handshake, the chain
 * was complete, or it was incomplete and the flag says so: the check ran either way, whatever the report's age. No answer (a
 * refused relaxed read, an unreachable site) or an http site means it did not.
 */
function chainChecked(r: CrawlReport): Ran {
  return yes(r.robots?.certificateChain !== undefined || (https(r) && r.robots?.status != null));
}

/**
 * "N of the M <what> seen were asked", when fewer were asked than seen (G-663); undefined when every one was. Never "N ... checked":
 * after a check's name ("Images that do not load: 60 of the 92 images checked") it read as 60 failing (thehatchgrp.com, G-698).
 */
const partOf = (asked: number, seen: number, what: string, order = '') => (asked < seen ? `${asked} of the ${seen} ${what} seen were asked${order}` : undefined);
/** The outside links asked (one never asked, as a private address, is not counted), of those seen: the most linked are asked first. */
const outsideCovered = (r: CrawlReport) => {
  const e = r.site?.external;
  return e && !e.offline && !e.unreachable ? partOf(e.answers.filter((a) => !a.notAsked).length, e.seen, 'addresses', ', the most linked first') : undefined;
};
/** The images asked, of those the pages showed. */
const imagesCovered = (r: CrawlReport) => (r.site?.images ? partOf(r.site.images.asked, r.site.images.seen, 'images', ", the site's own first") : undefined);

/** Every rule that can produce a finding, in code order. */
export const CHECKS = [
  { code: 'SITE-01', rule: 'appErrorFinding', file: 'src/group/findings.ts', name: 'Pages that answer an error yet draw content', group: 'links', class: 'reading', audit: firm('http'), ran: onPages },
  { code: 'SITE-02', rule: 'brokenLinkFindings', file: 'src/group/link-findings.ts', name: 'Links that answer an error', group: 'links', class: 'reading', audit: firm('http'), ran: onPages },
  { code: 'SITE-03', rule: 'redirectsOf', file: 'src/group/link-findings.ts', name: 'Links that redirect before they arrive', group: 'links', class: 'reading', audit: firm('http'), ran: onPages },
  { code: 'SITE-04', rule: 'titleFinding', file: 'src/group/title-finding.ts', name: 'Page titles that are shared or missing', group: 'links', class: 'reading', audit: softer('browser'), ran: onPages },
  { code: 'SITE-05', rule: 'softNotFoundFinding', file: 'src/group/findings.ts', name: 'An address that cannot exist but answers as a page', group: 'links', class: 'reading', audit: firm('http'), ran: (r) => yes(r.notFound?.status != null) },
  { code: 'SITE-06', rule: 'deadAddressFinding', file: 'src/group/findings.ts', name: 'Addresses of the site that do not answer', group: 'site', class: 'reading', audit: firm('socket'), ran: (r) => yes((r.addresses ?? []).length > 0) },
  { code: 'SITE-07', rule: 'markupFindings', file: 'src/group/markup-findings.ts', name: 'Links and buttons with nothing for a screen reader to say', group: 'markup', class: 'reading', audit: firm('browser'), ran: markupOf('markup') },
  { code: 'SITE-08', rule: 'markupFindings', file: 'src/group/markup-findings.ts', name: 'Form fields without a label', group: 'markup', class: 'reading', audit: firm('browser'), ran: markupOf('markup') },
  { code: 'SITE-09', rule: 'markupFindings', file: 'src/group/markup-findings.ts', name: 'Images with no address', group: 'markup', class: 'reading', audit: firm('browser'), ran: markupOf('markup') },
  { code: 'SITE-10', rule: 'markupFindings', file: 'src/group/markup-findings.ts', name: 'Placeholder text left on pages', group: 'markup', class: 'reading', audit: softer('browser'), ran: markupOf('markup') },
  { code: 'SITE-11', rule: 'phoneFinding', file: 'src/group/markup-findings.ts', name: 'The viewport setting for phones', group: 'markup', class: 'reading', audit: softer('browser'), ran: markupOf('markup') },
  { code: 'SITE-12', rule: 'canonicalFinding', file: 'src/group/markup-findings.ts', name: 'Canonical links that point somewhere else', group: 'markup', class: 'reading', audit: softer('file'), ran: onPages },
  { code: 'SITE-13', rule: 'markupFindings', file: 'src/group/markup-findings.ts', name: 'Images without alt text', group: 'markup', class: 'reading', audit: firm('browser'), ran: markupOf('markup') },
  { code: 'SITE-14', rule: 'markupFindings', file: 'src/group/markup-findings.ts', name: 'The language each page declares', group: 'markup', class: 'reading', audit: firm('browser'), ran: markupOf('markup') },
  { code: 'SITE-15', rule: 'headingFinding', file: 'src/group/markup-findings.ts', name: 'The main heading of each page', group: 'markup', class: 'reading', audit: firm('browser'), ran: markupOf('structure') },
  { code: 'SITE-16', rule: 'deadAnchorFinding', file: 'src/group/markup-findings.ts', name: 'Links to a part of the page that is not there', group: 'markup', class: 'reading', audit: firm('browser'), ran: markupOf('markup') },
  { code: 'SITE-17', rule: 'descriptionFinding', file: 'src/group/markup-findings.ts', name: 'Descriptions for search results', group: 'markup', class: 'reading', audit: softer('browser'), ran: markupOf('markup') },
  { code: 'SITE-18', rule: 'chainFinding', file: 'src/group/markup-findings.ts', name: 'Chains of redirects', group: 'links', class: 'reading', audit: firm('http'), ran: onPages },
  { code: 'SITE-19', rule: 'copyrightFinding', file: 'src/group/markup-findings.ts', name: 'The year in the copyright notice', group: 'markup', class: 'reading', audit: softer('browser'), ran: markupOf('markup') },
  { code: 'SITE-20', rule: 'loadFindings', file: 'src/group/load-findings.ts', name: 'Scripts, style sheets and data requests that fail to load', group: 'loading', class: 'reading', audit: softer('http'), ran: loadData },
  { code: 'SITE-21', rule: 'scriptErrorFinding', file: 'src/group/script-errors.ts', name: 'Errors thrown by the site\'s own scripts', group: 'loading', class: 'reading', audit: softer('script-errors'), ran: loadData },
  { code: 'SITE-22', rule: 'slowFinding', file: 'src/group/load-findings.ts', name: 'Pages slow to answer or to load', group: 'loading', class: 'reading', audit: ONLY.slow, ran: loadData },
  { code: 'SITE-23', rule: 'loadFindings', file: 'src/group/load-findings.ts', name: 'Requests over plain http from an https page', group: 'loading', class: 'reading', audit: softer('browser'), ran: onHttps(loadData) },
  { code: 'SITE-24', rule: 'headerFindings', file: 'src/group/load-findings.ts', name: 'Response headers that browsers act on', group: 'site', class: 'security-observation', audit: firm('header'), ran: onHttps(loadData) },
  { code: 'SITE-25', rule: 'headerFindings', file: 'src/group/load-findings.ts', name: 'Server software and version announced in headers', group: 'site', class: 'security-observation', audit: firm('header'), ran: loadData },
  { code: 'SITE-26', rule: 'certificateFinding', file: 'src/group/probe-findings.ts', name: "The certificate's end date, name and trust", group: 'site', class: 'reading', audit: firm('tls'), ran: asked('certificate') },
  { code: 'SITE-27', rule: 'httpRedirectFinding', file: 'src/group/probe-findings.ts', name: 'Whether the http address sends visitors to https', group: 'site', class: 'reading', audit: firm('http'), ran: asked('http') },
  { code: 'SITE-28', rule: 'sitemapFinding', file: 'src/group/probe-findings.ts', name: 'The sitemap', group: 'site', class: 'reading', audit: firm('file'), ran: asked('sitemap') },
  { code: 'SITE-29', rule: 'securityTxtFinding', file: 'src/group/probe-findings.ts', name: 'A contact for security reports (security.txt)', group: 'site', class: 'security-observation', audit: firm('file'), ran: asked('securityTxt') },
  { code: 'SITE-30', rule: 'brokenImagesFinding', file: 'src/group/probe-findings.ts', name: 'Images that do not load', group: 'links', class: 'reading', audit: softer('http'), ran: (r) => (r.site?.images ? 'ran' : r.site ? 'unknown' : 'not-run'), covered: imagesCovered },
  { code: 'SITE-31', rule: 'twinNameFinding', file: 'src/group/probe-findings.ts', name: 'One site answering at two names', group: 'site', class: 'reading', audit: firm('http'), ran: (r) => yes(twinAsked(r)) },
  { code: 'SITE-32', rule: 'downgradeFinding', file: 'src/group/link-findings.ts', name: 'Links that send visitors from https to http', group: 'links', class: 'reading', audit: firm('http'), ran: onHttps(onPages) },
  { code: 'SITE-33', rule: 'goneOf', file: 'src/group/findings.ts', name: 'Links to other sites that lead nowhere', group: 'links', class: 'reading', audit: softer('http'), ran: externalLinks, covered: outsideCovered },
  { code: 'SITE-34', rule: 'brokenLinkFindings', file: 'src/group/link-findings.ts', name: 'Links that answer an error on purpose', group: 'links', class: 'reading', audit: ONLY.onPurpose, ran: onPages },
  { code: 'SITE-35', rule: 'failedElsewhereFinding', file: 'src/group/load-findings.ts', name: "Requests to other sites' hosts that fail", group: 'loading', class: 'reading', audit: ONLY.otherHosts, ran: evidence((r) => r.site?.failedHosts !== undefined || visitorPages(r).some((p) => p.load?.failedElsewhere)) },
  // Requested only by suite audit --vulnsec, and only when at least one list was read (src/cli/commands/audit.ts): asked for, it read the versions the pages announce.
  { code: 'SITE-36', rule: 'listedVersionFinding', file: 'src/group/listed-versions.ts', option: 'vulnsec', name: 'Announced versions that public lists name', group: 'site', class: 'security-observation', audit: ONLY.listed, ran: onPages },
  { code: 'SITE-37', rule: 'chainFinding', file: 'src/group/probe-findings.ts', name: "The certificate chain, as the crawler's machine sees it", group: 'site', class: 'reading', audit: ONLY.chain, ran: chainChecked },
  { code: 'SITE-38', rule: 'unfinishedFinding', file: 'src/group/load-findings.ts', name: 'Pages that did not finish loading', group: 'loading', class: 'reading', audit: ONLY.unfinished, ran: evidence((r) => visitorPages(r).some((p) => p.load?.unfinished)) },
  { code: 'SITE-39', rule: 'unansweredExternalFinding', file: 'src/group/findings.ts', name: 'Links to other sites that did not answer the crawler', group: 'links', class: 'reading', audit: ONLY.unconfirmed, ran: externalLinks, covered: outsideCovered },
  { code: 'SITE-40', rule: 'otherSiteLoadFinding', file: 'src/group/other-site-load.ts', name: 'What failed for the crawler on other sites, or from no known source', group: 'loading', class: 'reading', audit: ONLY.otherSite, ran: evidence((r) => visitorPages(r).some((p) => p.load?.failed || p.load?.scriptErrors || p.load?.failedOtherSite || p.load?.scriptErrorsOtherSite || p.load?.scriptErrorsUnknownSource)) },
  // An older crawl (before 2026-11-08) kept these fields in `unlabelled`, so they were checked, under SITE-08 (G-665).
  { code: 'SITE-41', rule: 'markupFindings', file: 'src/group/markup-findings.ts', name: 'Form fields whose only label is a placeholder', group: 'markup', class: 'reading', audit: firm('browser'), ran: markupOf('markup') },
] as const satisfies readonly Check[];

/** The code of a rule in the catalogue: what a finding's `code` is, so a rule without an entry does not compile. */
export type CheckCode = (typeof CHECKS)[number]['code'];
