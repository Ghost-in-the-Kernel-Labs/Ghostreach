/**
 * The catalogue of checks (G-637, src/findings/check-catalogue.ts) is the rules that exist: a rule without an entry fails, an entry
 * without a rule fails; each name is plain; and `ran` follows what the report records, three-valued (a check whose evidence the
 * crawl keeps only when it fires is `unknown`, never `ran`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECK_GROUPS, CHECKS, type Check, type Ran } from '../../src/findings/check-catalogue.js';
import { siteFindings } from '../../src/findings/findings.js';
import type { CrawledPage, CrawlReport } from '../../src/leaf/report.js';
import { auditedCrawl } from '../../src/project/crawl.js';
import { twinAskable } from '../../src/leaf/pages/twin-name.js';
import { BANNED, literals } from '../support/banned-words.js';
import { ORIGIN, page, report } from '../support/review-reports.js';

const CODE = /^(?:SITE|PROBE|LOAD)-\d+$/;
const GROUP_DIR = join(__dirname, '../../src/findings');

/** The finding codes a source file names, by the parser: a string literal that is exactly a code (`code: 'SITE-02'`, or an argument of `simple(...)`). Comments are not read. */
const codesIn = (source: string): string[] => literals(source).filter((t) => CODE.test(t));
// Not the catalogue's own file: its entries naming a code would make every entry its own rule.
const sourceCodes = () => [...new Set(readdirSync(GROUP_DIR).filter((n) => n.endsWith('.ts') && n !== 'check-catalogue.ts').flatMap((n) => codesIn(readFileSync(join(GROUP_DIR, n), 'utf8'))))].sort();
const verdict = (code: string, r: CrawlReport): Ran => CHECKS.find((c) => c.code === code)!.ran(r);
const codesOf = (...of: string[]) => of;

describe('the catalogue is held equal to the rules that exist (G-637)', () => {
  it('every finding code a rule gives has an entry, and every entry has a rule', () => {
    const rules = sourceCodes();
    expect(rules.length).toBeGreaterThan(30); // the parser found the codes, not nothing
    const entries: string[] = CHECKS.map((c) => c.code);
    expect(rules.filter((c) => !entries.includes(c)), 'a rule with no entry in src/group/check-catalogue.ts').toEqual([]);
    expect(entries.filter((c) => !rules.includes(c)), 'an entry with no rule in src/group').toEqual([]);
    expect(new Set(entries).size, 'one entry for each code').toBe(entries.length);
  });

  it('the scan sees a new code in a positional argument, a property and a template, and no code in a comment', () => {
    expect(codesIn("simple(pages, 'SITE-77', 'minor', t); const f = { code: 'SITE-78' }; const g = { code: `PROBE-79` };")).toEqual(['SITE-77', 'SITE-78', 'PROBE-79']);
    expect(codesIn("// SITE-80 is said here\n/** SITE-81 */ const a = 'about SITE-82';")).toEqual([]);
    expect(codesIn("code: 'SITE-02'").filter((c) => !CHECKS.some((k) => k.code === c))).toEqual([]);
    expect(codesIn("code: 'SITE-99'").filter((c) => !CHECKS.some((k) => k.code === c))).toEqual(['SITE-99']);
  });

  it('every finding the saved crawls give is a code the catalogue holds', () => {
    const golden = join(__dirname, '../golden');
    const codes = readdirSync(golden).filter((n) => n.endsWith('.crawl.json')).flatMap((n) => siteFindings(auditedCrawl(join(golden, n))).map((f) => f.code));
    expect(codes.length).toBeGreaterThan(6);
    expect(codes.filter((c) => !CHECKS.some((k) => k.code === c))).toEqual([]);
  });
});

describe('each entry is plain (G-637, G-636)', () => {
  it('a short noun phrase of its own, in a group that exists, of a class that is `reading`, but for the three that observe the guards of the site itself', () => {
    for (const c of CHECKS) {
      expect(c.name.length, c.code).toBeGreaterThan(4);
      expect(c.name.length, c.code).toBeLessThan(70);
      expect(c.name, c.code).not.toMatch(/[.:;!?]$/);
      expect(Object.keys(CHECK_GROUPS), c.code).toContain(c.group);
      expect(c.class, c.code).toBe(['SITE-24', 'SITE-25', 'SITE-29'].includes(c.code) ? 'security-observation' : 'reading');
      // Every check runs in every review: the parent's one check behind an option (SITE-36) was not copied (1.3, GR-003).
      expect(c.code, c.code).not.toBe('SITE-36');
    }
    expect(new Set(CHECKS.map((c) => c.name)).size, 'a name each').toBe(CHECKS.length);
  });

  it('no name uses a banned word (the audit never says secure, passed, clean, vulnerab...), nor the words a prospect never reads (G-636)', () => {
    for (const c of CHECKS) {
      // The full ban, whatever the class: a name is in every review's list.
      expect(c.name, c.code).not.toMatch(BANNED);
      expect(c.name, c.code).not.toMatch(/\bscan|defect|problem|what is wrong|wrong with/i);
    }
  });
});

describe('whether a check ran follows what the crawl recorded (G-637)', () => {
  const answered = report([page('/'), page('/a')]);
  const by = (r: CrawlReport, ...of: Ran[]) => CHECKS.filter((c) => of.includes(c.ran(r))).map((c) => c.code);

  it('a crawl that read no page ran nothing', () => {
    expect(by(report([page('/', null)], { addresses: [], notFound: { url: `${ORIGIN}/x`, status: null }, robots: { status: null, source: 'unreachable' } } as unknown as Partial<CrawlReport>), 'ran', 'unknown')).toEqual([]);
    expect(by(report([], { robots: { status: null, source: 'unreachable' } } as unknown as Partial<CrawlReport>), 'ran', 'unknown')).toEqual([]);
  });

  it('pages that answered: the rules that read an answer ran; markup, load and the site probe did not', () => {
    expect(by(answered, 'ran')).toEqual(expect.arrayContaining(codesOf('SITE-01', 'SITE-02', 'SITE-03', 'SITE-04', 'SITE-12', 'SITE-18', 'SITE-32', 'SITE-34')));
    // The markup reader's output is on every page it read, so these ran here (the fixture pages carry it).
    expect(by(answered, 'ran')).toEqual(expect.arrayContaining(codesOf('SITE-07', 'SITE-11', 'SITE-15', 'SITE-19')));
    // A page's load is kept only when something was seen: no load anywhere could be nothing seen, or no watch (unknown, never run).
    expect(by(answered, 'unknown')).toEqual(expect.arrayContaining(codesOf('SITE-20', 'SITE-21', 'SITE-22', 'SITE-23', 'SITE-24', 'SITE-25', 'SITE-35', 'SITE-38')));
    // robots.txt answered over https, so the chain was tested and accepted: SITE-37 ran (it is flagged only when incomplete).
    expect(verdict('SITE-37', answered)).toBe('ran');
    expect(by(answered, 'not-run')).toEqual(expect.arrayContaining(codesOf('SITE-05', 'SITE-06', 'SITE-26', 'SITE-27', 'SITE-28', 'SITE-29', 'SITE-30', 'SITE-31', 'SITE-33')));
  });

  it('a page without the markup reader\'s output did not run the markup rules, and one without structure not the heading rule', () => {
    const bare = report([page('/', 200, { markup: undefined, structure: undefined })]);
    expect(by(bare, 'ran')).not.toContain('SITE-07');
    expect(verdict('SITE-07', bare)).toBe('not-run');
    expect(verdict('SITE-15', bare)).toBe('not-run');
    expect(verdict('SITE-15', report([page('/', 200, { markup: undefined })]))).toBe('ran');
  });

  it('a page that is not read as a visitor reads one (a duplicate, another site) carries no markup rule', () => {
    const dup = page('/d', 200, { duplicateOf: `${ORIGIN}/` } as Partial<CrawledPage>);
    expect(verdict('SITE-07', report([dup]))).toBe('not-run');
  });

  it('load data: any page with it means the load rules ran; the header check only on an https site', () => {
    const loaded = (origin: string) => report([page('/', 200, { load: { loadMs: 400 } })], { origin, startUrl: `${origin}/` });
    for (const code of codesOf('SITE-20', 'SITE-21', 'SITE-22', 'SITE-23', 'SITE-24', 'SITE-25')) expect(verdict(code, loaded(ORIGIN)), code).toBe('ran');
    expect(verdict('SITE-24', loaded('http://shop.test'))).toBe('not-run');
    expect(verdict('SITE-24', answered)).toBe('unknown');
  });

  it('evidence recorded only when it fires proves the check ran; its absence does not', () => {
    const unfinished = report([page('/', 200, { load: { unfinished: { afterMs: 5000 } } })]);
    expect(verdict('SITE-38', unfinished)).toBe('ran');
    expect(verdict('SITE-38', report([page('/', 200, { load: { loadMs: 400 } })]))).toBe('unknown');
    expect(verdict('SITE-35', report([page('/', 200, { load: { failedElsewhere: { count: 1, first: ['x'] } } })]))).toBe('ran');
    expect(verdict('SITE-35', report([page('/')], { site: { failedHosts: [] } }))).toBe('ran');
    expect(verdict('SITE-37', report([page('/')], { robots: { status: 200, source: 'parsed', certificateChain: 'incomplete' } } as Partial<CrawlReport>))).toBe('ran');
  });

  it('the certificate chain was tested when robots.txt answered over https (whatever it answered); not when it gave no answer or the site is http', () => {
    const robots = (more: object, origin = ORIGIN) => report([page('/')], { origin, robots: { source: 'parsed', ...more } } as Partial<CrawlReport>);
    expect(verdict('SITE-37', robots({ status: 200 }))).toBe('ran');
    expect(verdict('SITE-37', robots({ status: 404, source: 'none' }))).toBe('ran');
    expect(verdict('SITE-37', robots({ status: 503, source: 'parsed' }))).toBe('ran');
    expect(verdict('SITE-37', report([], { robots: { status: 200, source: 'parsed' } } as Partial<CrawlReport>)), 'no page read: the robots.txt request still tested the chain').toBe('ran');
    expect(verdict('SITE-37', robots({ status: null, source: 'unreachable' }))).toBe('not-run');
    expect(verdict('SITE-37', robots({ status: 200 }, 'http://shop.test'))).toBe('not-run');
  });

  it('what can fire only on an https site did not run on an http one: plain-http requests, https-to-http links, the headers', () => {
    const http = report([page('/', 200, { load: { loadMs: 400 } })], { origin: 'http://shop.test', startUrl: 'http://shop.test/' });
    for (const code of codesOf('SITE-23', 'SITE-24', 'SITE-32')) expect(verdict(code, http), code).toBe('not-run');
    // What an http site can show still ran: the server's announced software, from the load data.
    expect(verdict('SITE-25', http)).toBe('ran');
    const https = report([page('/', 200, { load: { loadMs: 400 } })]);
    for (const code of codesOf('SITE-23', 'SITE-24', 'SITE-32')) expect(verdict(code, https), code).toBe('ran');
  });

  it('the rules over answers ran over pages of the site: not over an off-site answer, nor a copy of a page already read', () => {
    const offSite = report([page('/', 200, { offSite: true })]);
    const copy = report([page('/', 200, { duplicateOf: `${ORIGIN}/x` })]);
    for (const code of codesOf('SITE-01', 'SITE-02', 'SITE-03', 'SITE-04', 'SITE-12', 'SITE-18', 'SITE-32', 'SITE-34')) {
      expect(verdict(code, offSite), `${code} over an off-site answer`).toBe('not-run');
      expect(verdict(code, copy), `${code} over a copy`).toBe('not-run');
    }
    expect(verdict('SITE-20', offSite), 'no load rule ran either').toBe('not-run');
    expect(verdict('SITE-04', report([page('/', 200, { offSite: true }), page('/b')]))).toBe('ran');
  });

  it('the probes after the crawl: each ran when its answer is recorded; a failed ask (null status) is a finding, so it ran', () => {
    const site = report([page('/')], { site: { certificate: { validTo: '2030-01-01', daysLeft: 900, names: [], matches: true, trusted: true }, http: { url: 'http://shop.test/', status: null }, sitemap: { url: `${ORIGIN}/sitemap.xml`, status: 404 }, securityTxt: { url: `${ORIGIN}/.well-known/security.txt`, status: 404 } } });
    for (const code of codesOf('SITE-26', 'SITE-27', 'SITE-28', 'SITE-29')) expect(verdict(code, site), code).toBe('ran');
    expect(verdict('SITE-26', report([page('/')], { site: {} }))).toBe('not-run');
    expect(verdict('SITE-05', report([page('/')], { notFound: { url: `${ORIGIN}/x`, status: 404 } }))).toBe('ran');
    expect(verdict('SITE-05', report([page('/')], { notFound: { url: `${ORIGIN}/x`, status: null } }))).toBe('not-run');
    expect(verdict('SITE-06', report([page('/')], { addresses: [{ address: '1.2.3.4', family: 4, answered: true }] }))).toBe('ran');
    expect(verdict('SITE-06', report([page('/')], { addresses: [] }))).toBe('not-run');
  });

  it('what the probe records only when there was something: images and links to other sites are unknown, not run, beside a probe', () => {
    const probed = (site: NonNullable<CrawlReport['site']>) => report([page('/')], { site });
    expect(verdict('SITE-30', probed({}))).toBe('unknown');
    expect(verdict('SITE-30', probed({ images: { seen: 3, asked: 3 } }))).toBe('ran');
    expect(verdict('SITE-33', probed({}))).toBe('unknown');
    expect(verdict('SITE-33', probed({ external: { seen: 2, answers: [] } }))).toBe('ran');
    expect(verdict('SITE-33', probed({ external: { seen: 2, answers: [], unreachable: true } }))).toBe('not-run');
    expect(verdict('SITE-33', answered)).toBe('not-run');
  });

  it('the other name is asked by the very condition the probe uses (src/leaf/pages/twin-name.ts)', () => {
    for (const host of ['shop.test', 'www.shop.test', 'localhost', '10.0.0.1', 'shop', 'a.b.c.d.example']) {
      const r = report([page('/')], { site: {}, origin: `https://${host}`, startUrl: `https://${host}/` });
      expect(verdict('SITE-31', r), host).toBe(twinAskable(host) ? 'ran' : 'not-run');
    }
    expect([twinAskable('shop.test'), twinAskable('10.0.0.1'), twinAskable('localhost')]).toEqual([true, false, false]);
  });

  it('the other name of the site is asked of a domain name, after a probe', () => {
    const asked = (more: Partial<CrawlReport>) => verdict('SITE-31', report([page('/')], { site: {}, ...more }));
    expect(asked({})).toBe('ran');
    expect(asked({ origin: 'https://10.0.0.1', startUrl: 'https://10.0.0.1/' })).toBe('not-run');
    expect(asked({ origin: 'https://localhost', startUrl: 'https://localhost/' })).toBe('not-run');
    expect(verdict('SITE-31', answered)).toBe('not-run');
  });

  it('every check gives one of the three answers for the saved crawls, and each crawl runs more than a few', () => {
    const golden = join(__dirname, '../golden');
    for (const n of readdirSync(golden).filter((f) => f.endsWith('.crawl.json'))) {
      const r = auditedCrawl(join(golden, n));
      const all = CHECKS.map((c: Check) => c.ran(r));
      expect(all.every((v) => ['ran', 'not-run', 'unknown'].includes(v)), n).toBe(true);
      expect(all.filter((v) => v === 'ran').length, n).toBeGreaterThan(8);
    }
  });
});

describe("each check's audit decision: re-checkable firm, softer, or a finding only (G-748 (1), G-749)", () => {
  const nn = (...n: number[]) => n.map((x) => `SITE-${String(x).padStart(2, '0')}`);
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const decided = (c: Check) => (c as Check).audit;
  const codes = (keep: (d: Check['audit']) => boolean) => CHECKS.filter((c) => keep(decided(c))).map((c) => c.code).sort();

  it("every code has a decision, and the three lists are G-748 (1)'s exactly", () => {
    for (const c of CHECKS) expect(decided(c), c.code).toBeDefined();
    expect(codes((d) => 'recheck' in d && d.recheck === 'firm')).toEqual(nn(1, 2, 3, 5, 6, 7, 8, 9, 13, 14, 15, 16, 18, ...range(24, 29), 31, 32, 41));
    expect(codes((d) => 'recheck' in d && d.recheck === 'softer')).toEqual(nn(4, 10, 11, 12, 17, 19, 20, 21, 23, 30, 33));
    expect(codes((d) => 'only' in d)).toEqual(nn(22, 34, 35, 37, 38, 39, 40));
  });

  it('a re-checkable code names how it is re-checked; a finding only says why in words', () => {
    const kinds: Record<string, string[]> = {
      http: nn(1, 2, 3, 5, 18, 20, 27, 30, 31, 32, 33),
      socket: nn(6),
      header: nn(24, 25),
      tls: nn(26),
      file: nn(12, 28, 29),
      browser: nn(4, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 23, 41),
      'script-errors': nn(21),
    };
    for (const [kind, of] of Object.entries(kinds)) expect(codes((d) => 'recheck' in d && d.check === kind), kind).toEqual(of);
    for (const c of CHECKS) {
      const d = decided(c);
      if ('only' in d) expect(d.only.split(' ').length, c.code).toBeGreaterThan(4);
    }
  });
});
