/**
 * The audit golden (TODO 1.6): the parent's AUDIT.html for its fixture crawl, written by the parent's own code at the pinned commit
 * (scripts/parent-findings.mjs ... audit), and the differences this program's page is allowed against it, each named. Read by
 * test/unit/audit-golden.test.ts (the parent's crawl) and test/crawl/ghostreach.spec.ts (a live crawl of the fixture).
 */
import { readFileSync } from 'node:fs';

export const GOLDEN_AUDIT = new URL('../golden/fixture-site.AUDIT.html', import.meta.url);

/** The parent's page, as recorded. */
export const parentAudit = (): string => readFileSync(GOLDEN_AUDIT, 'utf8');

/** The day the golden page says the site was read (scripts/parent-findings.mjs's AUDIT_DAY). */
export const GOLDEN_WHEN = new Date('2026-11-14T12:00:00Z');

/**
 * Each allowed difference, as [this program's text, the parent's text]: the title line and the footer (ROADMAP 1.6), and the named
 * losses of docs/CUT.md the fixture reaches (LOOK_INTRO's last sentence; SITE-35's parenthesis is never reached by the fixture).
 */
export const ALLOWED: ReadonlyArray<{ what: string; ours: string; parent: string }> = [
  { what: 'the title line', ours: '<title>Site audit: fixture.test | Suite Builder</title>', parent: '<title>Site audit: fixture.test</title>' },
  {
    what: 'the footer',
    ours: "<footer>Read by the forecursor crawler, which identifies itself in its User-Agent and obeys robots.txt. Prepared with Suite Builder, Ghost in the Kernel Labs.</footer>",
    parent: "<footer>Read by Suite Builder's crawler, which identifies itself in its User-Agent and obeys robots.txt.</footer>",
  },
  {
    what: "LOOK_INTRO's last sentence (docs/CUT.md, named losses)",
    ours: 'nothing here is cleared by a rule.</p>',
    parent: "nothing here is cleared by a rule. A link leaves this list only when the team lists it, with the status it answers, in the suite's expected-links block.</p>",
  },
];

/** This program's page with each allowed difference put back as the parent has it; every one must be found exactly once. */
export function asParent(html: string): string {
  let page = html;
  for (const { what, ours, parent } of ALLOWED) {
    const at = page.split(ours).length - 1;
    if (at !== 1) throw new Error(`${what}: found ${at} times in this program's page, not once`);
    page = page.replace(ours, () => parent);
  }
  return page;
}
