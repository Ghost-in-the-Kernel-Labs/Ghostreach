/**
 * What an audit says it checked (G-637), built from the catalogue of checks (src/group/check-catalogue.ts): the scope sentence,
 * and the list of the checks that ran, grouped, with the ones that did not run said as not run. The audit page (audit.ts) calls these.
 *
 * Every parameter `catalogue` defaults to the real one: a test passes its own. Every check of the catalogue is a review's: none is
 * asked for apart (GR-003: no flag).
 */
import type { CrawlReport } from '../leaf/report.js';
import { CHECKS, CHECK_GROUPS, type Check, type CheckClass, type Ran } from '../findings/check-catalogue.js';

/** Each check of this review with whether it ran for this crawl. */
function verdicts(report: CrawlReport, catalogue: readonly Check[]): { check: Check; ran: Ran }[] {
  return catalogue.map((check) => ({ check, ran: check.ran(report) }));
}

/** How many checks ran: the N of "None of the N checks that ran found anything". */
export const checksRan = (report: CrawlReport, catalogue: readonly Check[] = CHECKS): number => verdicts(report, catalogue).filter((v) => v.ran === 'ran').length;

/** The classes of the checks that ran: what the review did, and so what it may say it did. */
export function classesRan(report: CrawlReport, catalogue: readonly Check[] = CHECKS): Set<CheckClass> {
  return new Set(verdicts(report, catalogue).filter((v) => v.ran === 'ran').map((v) => v.check.class));
}

/**
 * The review's scope, in one or two sentences, from the classes that ran. A review of readings only says it does not test
 * security; one that ran security-observation checks says what it observes and that it sends and attacks nothing, and never
 * says it does not test security. The read is never signed in (GR-003): the site it reads is the public one. Never calls the
 * site secure, safe or clean.
 */
// Decision: G-637
export function auditScope(report: CrawlReport, catalogue: readonly Check[] = CHECKS): string {
  const reads = 'This review reads the public site as it is served.';
  if (!classesRan(report, catalogue).has('security-observation')) return `${reads} It makes only the checks listed below (a check that did not run on this crawl is marked), and it does not test security.`;
  return `${reads} It also observes the site's own security guards, as a visitor's browser sees them. It sends nothing and attacks nothing.`;
}

/** True when only readings ran: the review says, as it always has, that it is not a security test. */
export const onlyReadings = (report: CrawlReport, catalogue: readonly Check[] = CHECKS): boolean => !classesRan(report, catalogue).has('security-observation');

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What the review checked, as data the page prints: one sentence, then the checks by group. */
export interface Checked {
  /** "Of 37 checks, 33 ran on this crawl; 2 did not run and 2 could not be confirmed." */
  summary: string;
  /** Each group's title with how many of its checks ran, and a line for each check: its name, said as not run or not confirmed when it was. */
  groups: { title: string; lines: string[] }[];
  /** What "not confirmed" means, when any is. */
  note: string;
}

/** What the review checked on this crawl. A check that did not run is listed, never left out. */
// Decision: G-637
export function auditChecked(report: CrawlReport, catalogue: readonly Check[] = CHECKS): Checked {
  const all = verdicts(report, catalogue);
  const count = (ran: Ran) => all.filter((v) => v.ran === ran).length;
  const [ran, notRun, unknown] = [count('ran'), count('not-run'), count('unknown')];
  const rest = [notRun ? `${notRun} did not run` : '', unknown ? `${unknown} could not be confirmed` : ''].filter(Boolean).join(' and ');
  const summary = rest ? `Of ${plural(all.length, 'check')}, ${ran} ran on this crawl; ${rest}.` : `All ${plural(all.length, 'check')} ran on this crawl.`;
  const said: Record<Ran, string> = { ran: '', 'not-run': ': not run', unknown: ': not confirmed' };
  const groups = Object.entries(CHECK_GROUPS).flatMap(([key, name]) => {
    const own = all.filter((v) => v.check.group === key);
    const title = `${name} (${own.filter((v) => v.ran === 'ran').length} of ${own.length} ran)`;
    // A check that ran over part of what was seen says how much (G-663): "100 of the 393 addresses seen were asked" (G-698), never a plain "ran".
    const part = (v: (typeof own)[number]) => (v.ran === 'ran' && v.check.covered?.(report)) || '';
    return own.length ? [{ title, lines: own.map((v) => `${v.check.name}${said[v.ran]}${part(v) ? `: ${part(v)}` : ''}`) }] : [];
  });
  const note = unknown ? 'Not confirmed: the crawl file records what such a check saw only when it saw something, so it cannot show whether the check ran and found nothing, or did not run.' : '';
  return { summary, groups, note };
}
