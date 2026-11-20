/**
 * What the audit says it checked (G-637, src/audit/audit-checked.ts): the list of the checks that ran, below the counts line, from
 * the one catalogue; the scope sentence, generated from the classes that ran by the one function both writers
 * call; and the banned words scoped by class (a `reading` finding never says `vulnerab`, a security-observation one may; the
 * framing never does). The real catalogue has no security-observation entry, so a test-only one stands in. The parent's cases of
 * the Markdown audit (`--md`), a signed-in review (`--login`) and a check asked for by an option (`--vulnsec`, `--sec`) were not
 * carried (1.4, docs/CUT.md): AUDIT.html is the one file.
 */
import { describe, expect, it } from 'vitest';
import { CHECKS, type Check } from '../../src/findings/check-catalogue.js';
import { siteFindings } from '../../src/findings/findings.js';
import { auditHtml } from '../../src/audit/audit.js';
import { auditChecked, auditScope, classesRan, onlyReadings } from '../../src/audit/audit-checked.js';
import { BANNED, bannedIn, offences } from '../support/banned-words.js';
import { DAY, ORIGIN, page, report } from '../support/review-reports.js';

/** A check of the class that does not exist yet: never in the real catalogue. */
const guards = (ran: Check['ran']): Check => ({ code: 'SEC-01', rule: 'guardsFinding', file: 'src/group/guards.ts', name: 'Guards the browser enforces', group: 'site', class: 'security-observation', audit: { recheck: 'firm', check: 'browser' }, ran });
const ranAlways = guards(() => 'ran');
const DEFAULT_SCOPE = 'This review reads the public site as it is served. It makes only the checks listed below (a check that did not run on this crawl is marked), and it does not test security.';
const GUARDS_SCOPE = "This review reads the public site as it is served. It also observes the site's own security guards, as a visitor's browser sees them. It sends nothing and attacks nothing.";
/** Every response header the guards check looks for, sent: so the page has no finding for them. */
const GUARD_HEADERS = { 'strict-transport-security': 'max-age=1', 'content-security-policy': "default-src 'self'", 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff' };
const answered = report([page('/'), page('/a')]);
const both = (r: ReturnType<typeof report>): { html: string } => ({ html: auditHtml(r, siteFindings(r), DAY) });

describe('the scope sentence is generated from the classes that ran (G-637)', () => {
  it('a review of readings only says it makes the listed checks and does not test security', () => {
    expect(auditScope(answered)).toBe(DEFAULT_SCOPE);
    expect(classesRan(answered)).toEqual(new Set(['reading']));
    expect(onlyReadings(answered)).toBe(true);
  });

  it('a review in which a security-observation check ran says what it observes, that it sends nothing and attacks nothing, and not "does not test security"', () => {
    const scope = auditScope(answered, [...CHECKS, ranAlways]);
    expect(scope).toBe("This review reads the public site as it is served. It also observes the site's own security guards, as a visitor's browser sees them. It sends nothing and attacks nothing.");
    expect(scope).not.toMatch(/does not test security|not a security test/i);
    expect(onlyReadings(answered, [...CHECKS, ranAlways])).toBe(false);
  });

  it('a security-observation check that did not run, or is not confirmed, changes nothing: the classes that RAN decide', () => {
    for (const ran of ['not-run', 'unknown'] as const) expect(auditScope(answered, [...CHECKS, guards(() => ran)])).toBe(DEFAULT_SCOPE);
  });

  describe('with the real catalogue, whose checks of the site\'s own guards are SITE-24, SITE-25 and SITE-29', () => {
    const loaded = (more: object = {}, origin = ORIGIN) => report([page('/', 200, { load: { loadMs: 400, headers: GUARD_HEADERS } })], { origin, startUrl: `${origin}/`, ...more } as never);
    const probed = (origin: string) => report([page('/')], { origin, startUrl: `${origin}/`, site: { securityTxt: { url: `${origin}/.well-known/security.txt`, status: 200 } } });

    it('an https crawl with load data ran the header checks: the second sentence, and not "does not test security"', () => {
      for (const r of [loaded(), report([page('/', 200, { load: { loadMs: 400 } })])]) {
        expect(classesRan(r)).toEqual(new Set(['reading', 'security-observation']));
        expect(auditScope(r)).toBe(GUARDS_SCOPE);
        expect(onlyReadings(r)).toBe(false);
      }
    });

    it('a crawl that recorded none of the three (none ran, or they are not confirmed) says the default', () => {
      // https, no load data: SITE-24 and 25 are not confirmed; no probe: SITE-29 did not run.
      expect(auditScope(answered)).toBe(DEFAULT_SCOPE);
      expect(['SITE-24', 'SITE-25', 'SITE-29'].map((c) => CHECKS.find((k) => k.code === c)!.ran(answered))).toEqual(['unknown', 'unknown', 'not-run']);
      // http, no load data, no probe: SITE-24 did not run either.
      const http = report([page('/')], { origin: 'http://shop.test', startUrl: 'http://shop.test/' });
      expect(auditScope(http)).toBe(DEFAULT_SCOPE);
      expect(['SITE-24', 'SITE-25', 'SITE-29'].map((c) => CHECKS.find((k) => k.code === c)!.ran(http))).toEqual(['not-run', 'unknown', 'not-run']);
    });

    it('the mixed case: an http crawl where only security.txt was asked ran a check of the site\'s own guards, so it says so', () => {
      const r = probed('http://shop.test');
      expect(['SITE-24', 'SITE-25', 'SITE-29'].map((c) => CHECKS.find((k) => k.code === c)!.ran(r))).toEqual(['not-run', 'unknown', 'ran']);
      expect(auditScope(r)).toBe(GUARDS_SCOPE);
    });

    it('an http crawl with load data: the announced server software was read (SITE-25 ran), the headers were not (SITE-24 did not)', () => {
      const r = loaded({}, 'http://shop.test');
      expect(['SITE-24', 'SITE-25'].map((c) => CHECKS.find((k) => k.code === c)!.ran(r))).toEqual(['not-run', 'ran']);
      expect(auditScope(r)).toBe(GUARDS_SCOPE);
    });

    it('the page carries the sentence the crawl earns, once, and the nothing-to-report text drops "not a security test" when such a check ran', () => {
      for (const r of [loaded(), probed('https://shop.test')]) {
        const { html } = both(r);
        for (const text of [html]) {
          expect(text.split(GUARDS_SCOPE).length - 1).toBe(1);
          expect(text).not.toMatch(/does not test security|not a security test/);
          expect(text).toMatch(/That is what an automated read of the public site can say\./);
        }
      }
      // And a crawl without any of the three keeps both sentences (G-633).
      for (const text of Object.values(both(answered))) {
        expect(text).toContain(DEFAULT_SCOPE);
        expect(text).toContain('it is not a security test.');
      }
    });
  });

  it('never says secure, safe, passed, clean, healthy, compliant or no issues, in either review', () => {
    for (const scope of [auditScope(answered), auditScope(answered, [...CHECKS, ranAlways])]) {
      expect(scope).not.toMatch(BANNED);
      expect(scope).not.toMatch(/\bsafe/i);
    }
  });

  it('the page carries the generated sentence once, in the subtitle where the old constant stood', () => {
    const { html } = both(answered);
    for (const text of [html]) {
      expect(text.split(DEFAULT_SCOPE).length - 1).toBe(1);
      expect(text).toContain(`Nothing was sent, bought or signed in to. ${DEFAULT_SCOPE}`);
      expect(text).not.toContain('This is a read of the public site as it is served');
    }
  });
});

// Named by hand, not counted (TODO 141): which bucket each check falls in on this fixture. The rules that read an answer, those of
// markup (SITE-41 among them, G-665) and the chain (robots.txt answered over https) ran; those of load and headers, and 35, 38
// and 40, are unconfirmed; the rest need a probe, a lookup or other sites asked (SITE-33 and SITE-39 both). A new check is put in
// its bucket here; the counts in every sentence below follow from these lists and the catalogue.
const site = (...n: number[]) => n.map((x) => `SITE-${String(x).padStart(2, '0')}`);
const RAN = site(1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 32, 34, 37, 41);
const NOT_RUN = site(5, 6, 26, 27, 28, 29, 30, 31, 33, 39);
const UNCONFIRMED = site(20, 21, 22, 23, 24, 25, 35, 38, 40);
/** The checks of a review: every one (the parent's one optional check, SITE-36, was not copied; 1.3). */
const DEFAULT = CHECKS;
const summary = (extra: { ran?: number; notRun?: number } = {}) => {
  const ran = RAN.length + (extra.ran ?? 0);
  const notRun = NOT_RUN.length + (extra.notRun ?? 0);
  return `Of ${ran + notRun + UNCONFIRMED.length} checks, ${ran} ran on this crawl; ${notRun} did not run and ${UNCONFIRMED.length} could not be confirmed.`;
};
const SUMMARY = summary();

describe('the review says what it checked, below the counts line (G-637)', () => {

  it('each check is in its named bucket, and the buckets are the whole catalogue', () => {
    const bucket = (state: string) => DEFAULT.filter((c) => c.ran(answered) === state).map((c) => c.code);
    expect({ ran: bucket('ran'), notRun: bucket('not-run'), unconfirmed: bucket('unknown') }).toEqual({ ran: RAN, notRun: NOT_RUN, unconfirmed: UNCONFIRMED });
    expect([...RAN, ...NOT_RUN, ...UNCONFIRMED].sort()).toEqual(DEFAULT.map((c) => c.code).sort());
  });

  it('AUDIT.html: the same sentence, the list in a closed <details> a keyboard opens, each check once', () => {
    const { html } = both(answered);
    expect(html).toContain(`<h2>What this review checked</h2><p>${SUMMARY}</p><details><summary>The checks, by kind</summary>`);
    expect(html).not.toMatch(/<section class="checked"><p>[^]*<details open/);
    expect(html.indexOf('class="count minor"')).toBeLessThan(html.indexOf('What this review checked'));
    expect(html.indexOf('What this review checked')).toBeLessThan(html.indexOf('Nothing to report</h2>'));
    expect(html).toContain('<li>Links that answer an error</li>');
    expect(html).toContain('<li>Links to other sites that lead nowhere: not run</li>');
    // Each name once as a whole item (one is the start of another's: "Links that answer an error").
    for (const c of CHECKS) expect(html.split(/<li>/).filter((i) => i.startsWith(`${c.name}</li>`) || i.startsWith(`${c.name}: `)).length, c.code).toBe(1);
  });

  it('a check that did not run is said as not run, never left out', () => {
    const none = report([page('/', null)], { robots: { status: null, source: 'unreachable' } } as never);
    const html = auditHtml(none, [], DAY);
    expect(auditChecked(none).summary).toBe(`Of ${DEFAULT.length} checks, 0 ran on this crawl; ${DEFAULT.length} did not run.`);
    for (const c of DEFAULT) {
      expect(html, c.code).toContain(`<li>${c.name}: not run</li>`);
    }
  });

  it('the page holds every group\'s lines', () => {
    const checked = auditChecked(answered);
    const { html } = both(answered);
    expect(checked.groups.map((g) => g.lines.length).reduce((a, b) => a + b, 0)).toBe(DEFAULT.length);
    for (const g of checked.groups) {
      for (const l of g.lines) expect(html).toContain(`<li>${l}</li>`);
    }
  });

  it('when every check ran, it says so and lists no note', () => {
    const all = auditChecked(answered, CHECKS.map((c) => ({ ...c, ran: () => 'ran' as const })));
    expect(all.summary).toBe(`All ${DEFAULT.length} checks ran on this crawl.`);
    expect(all.note).toBe('');
    expect(all.groups.flatMap((g) => g.lines).some((l) => /: not/.test(l))).toBe(false);
  });

  it('a check of the new class that ran is listed with the others, and counted', () => {
    const checked = auditChecked(answered, [...CHECKS, ranAlways]);
    expect(checked.summary).toBe(summary({ ran: 1 }));
    expect(checked.groups.flatMap((g) => g.lines)).toContain('Guards the browser enforces');
  });

  it('the list is short on the first screen: one sentence and a collapsed list, never a long open list', () => {
    const { html } = both(answered);
    expect(html).not.toContain('<details open><summary>The checks');
  });
});

describe('the nothing-to-report text says how many checks ran (G-637)', () => {
  it('"None of the N checks that ran found anything on the P pages it read", N from the catalogue', () => {
    const { html } = both(answered);
    for (const text of [html]) expect(text).toContain('None of the 21 checks that ran found anything on the 2 pages it read.');
  });

  it('a review where the guards checks ran says the same, and ends without "not a security test"', () => {
    const r = report([page('/', 200, { load: { loadMs: 400, headers: GUARD_HEADERS } })]);
    expect(siteFindings(r)).toEqual([]);
    for (const text of Object.values(both(r))) {
      expect(text).toContain('None of the 27 checks that ran found anything on the 1 page it read. That is what an automated read of the public site can say.');
      expect(text).not.toMatch(/not a security test|does not test security/);
    }
  });

  it('no check ran: it says that, and not "none of the checks found anything"', () => {
    const none = report([page('/', 200, { offSite: true })], { robots: { status: null, source: 'unreachable' } } as never);
    for (const text of Object.values(both(none))) {
      expect(text).toContain('No check ran on the 1 page it read.');
      expect(text).not.toContain('None of the');
    }
  });
});

describe('the banned words are scoped by the class that ran (G-637)', () => {
  const finding = (code: string, title: string) => ({ code, title, why: 'It matters.', fix: 'Fix it.' });
  const withGuards = [...CHECKS, ranAlways];

  it('a finding of a security-observation check may name a vulnerability', () => {
    expect(offences(finding('SEC-01', 'A vulnerable library is announced'), withGuards)).toEqual([]);
    expect(bannedIn('a vulnerability', 'security-observation')).toBeUndefined();
  });

  it('but a finding of a `reading` check still may not, even beside one that may', () => {
    expect(offences(finding('SITE-02', 'A vulnerable link'), withGuards)).toEqual(['vulnerab']);
    expect(offences(finding('SITE-02', 'A vulnerable link'))).toEqual(['vulnerab']);
    expect(offences(finding('SITE-99', 'A vulnerable link'), withGuards), 'a code the catalogue does not hold is a reading one').toEqual(['vulnerab']);
  });

  it('no class may call a site secure, clean or passed, or say no issues', () => {
    for (const word of ['secure', 'clean', 'passed', 'healthy', 'compliant', 'no issues']) expect(offences(finding('SEC-01', `The site is ${word}`), withGuards), word).toEqual([word]);
  });

  it('the framing never says it, in any review: the scope sentence, the summary and the lead-in of a review that ran a security check', () => {
    const r = report([page('/'), page('/a')]);
    expect(auditScope(r, withGuards)).not.toMatch(BANNED);
    const checked = auditChecked(r, withGuards);
    expect(checked.summary).not.toMatch(BANNED);
    expect(checked.note).not.toMatch(BANNED);
    expect(`${auditScope(r)} ${auditChecked(r).summary}`).not.toMatch(BANNED);
  });
});
