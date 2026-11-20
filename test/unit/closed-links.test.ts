/**
 * A link reached only from parts of the page closed on arrival (G-737, G-742 (1); docs/VISIBILITY-PLAN.md, slice 7): SITE-02,
 * SITE-03 and SITE-33 say it apart, minor, "in a closed part of the page", never as what "a visitor who follows one" meets; SITE-39,
 * info already, says so on its line. rtafleet.com's /compare/* FAQ answers, stord.com's header menu (no trigger: never opened) and
 * the-internet's hover-only /users/N links (2026-11-11) are its shapes; the pages and hosts here are made up.
 */
import { describe, expect, it } from 'vitest';
import type { CrawlReport } from '../../src/leaf/report.js';
import { onlyHidden, shownEdges } from '../../src/crawl/report-read.js';
import { siteFindings } from '../../src/findings/findings.js';

describe('a link reached only from a part of the page closed on arrival is said apart, minor (G-737, G-742 (1))', () => {
  // rtafleet.com's /compare/* FAQ answers (2026-11-11): two gone links only in answers that open on a click; stord.com's header
  // menu: broken links and redirects only in it; the-internet's /users/N links, shown on hover. Pages and hosts made up.
  const ORIGIN = 'https://site.test';
  const page = (path: string, extra: object = {}) => ({ url: `${ORIGIN}${path}`, finalUrl: `${ORIGIN}${path}`, status: 200, redirects: [], title: path, fingerprint: { hash: path, paths: ['div'] }, headings: [path], ...extra });
  const link = (from: string, to: string, hidden?: boolean) => ({ from: `${ORIGIN}${from}`, to: to.startsWith('http') ? to : `${ORIGIN}${to}`, external: to.startsWith('https://other'), text: 'x', href: to, ...(hidden ? { hidden: true } : {}) });
  const report = () =>
    ({
      startUrl: `${ORIGIN}/`, origin: ORIGIN,
      pages: [
        page('/'), page('/faq'),
        page('/gone', { status: 404, headings: ['Not found'] }), page('/users/1', { status: 404, headings: ['Not found'] }),
        page('/old', { finalUrl: `${ORIGIN}/new`, redirects: [{ url: `${ORIGIN}/old`, status: 301 }] }),
        page('/menu-old', { finalUrl: `${ORIGIN}/menu-new`, redirects: [{ url: `${ORIGIN}/menu-old`, status: 301 }] }),
      ],
      edges: [
        link('/', '/faq'), link('/', '/gone'), link('/', '/old'),
        link('/', '/users/1', true), link('/faq', '/users/1', true), link('/', '/menu-old', true),
        link('/', 'https://other.test/shown'), link('/faq', 'https://other.test/shown', true),
        link('/faq', 'https://other.test/answer', true), link('/faq', 'https://other.test/answer#part', true),
        link('/faq', 'https://other.test/slow', true),
      ],
      site: { external: { seen: 3, answers: [{ url: 'https://other.test/shown', status: 404 }, { url: 'https://other.test/answer', status: 404 }, { url: 'https://other.test/slow', status: null, failed: 'timeout', again: true }] } },
    }) as unknown as CrawlReport;
  const all = (code: string) => siteFindings(report()).filter((f) => f.code === code);
  const paths = (f: { where: { url: string }[] }) => f.where.map((w) => w.url.replace(ORIGIN, ''));

  it('onlyHidden: linked, and by no link a visitor sees on arrival; a #part aside; never an address no page links to', () => {
    const r = report();
    expect(onlyHidden(r, 'https://other.test/answer')).toBe(true);
    expect(onlyHidden(r, 'https://other.test/shown')).toBe(false);
    expect(onlyHidden(r, [`${ORIGIN}/users/1`])).toBe(true);
    expect(onlyHidden(r, `${ORIGIN}/nowhere`)).toBe(false);
    // A dropdown the crawler opened from a control a visitor sees (a menu's button) is no closed part: its stale link leads (G-668).
    const opened = { ...r, edges: [...r.edges, { ...r.edges[3], trigger: { tag: 'button', text: 'Product' } }] } as CrawlReport;
    expect(onlyHidden(opened, [`${ORIGIN}/users/1`])).toBe(false);
    expect(shownEdges(r.edges).every((e) => !e.hidden)).toBe(true);
  });

  it('SITE-33: a gone link only in a closed part is minor, "in a closed part of the page", with no visitor who follows it', () => {
    const [shown, closed] = all('SITE-33');
    expect(shown).toMatchObject({ severity: 'major', title: '1 link to another site leads nowhere: the page is gone' });
    expect(paths(shown)).toEqual(['https://other.test/shown']);
    expect(closed).toMatchObject({ severity: 'minor', title: '1 link to another site in a closed part of the page leads nowhere: the page is gone' });
    expect(paths(closed)).toEqual(['https://other.test/answer']);
    expect(closed.why).not.toMatch(/a visitor who follows/);
    expect(closed.why).toContain('closed when it loads');
  });

  it('SITE-39: a link only in a closed part says so on its line; it stays info', () => {
    const [f] = all('SITE-39');
    expect(f.severity).toBe('info');
    expect(f.where[0].says).toBe('no answer in time, asked twice; linked from /faq; only in a closed part of the page');
  });

  it('SITE-02: a broken link only in a closed part of a page that shows nothing that opens one is a minor finding of its own; one a visitor sees stays major', () => {
    const [shown, closed] = all('SITE-02');
    expect(shown).toMatchObject({ severity: 'major', title: '1 broken link: the site links to an address that answers an error' });
    expect(paths(shown)).toEqual(['/gone']);
    expect(closed).toMatchObject({ severity: 'minor', title: '1 broken link in a closed part of the page: the site links to an address that answers an error' });
    expect(paths(closed)).toEqual(['/users/1']);
    expect(closed.why).not.toMatch(/A visitor who follows/);
  });

  // Ghost, 2026-11-12 (G-764): "I agree that these links should be major. Thats not a minor issue". A potential client's state
  // pages carried 58 "Learn More" links in tab panels (role=tab buttons over them), each answering 404: filed as minor.
  it('SITE-02: a broken link in a closed part of a page that shows a tab, an expander or a button is major, said where it is (G-764)', () => {
    for (const kind of ['tab', 'expander', 'button']) {
      const r = report();
      const faq = r.pages.find((p) => p.url.endsWith('/faq'))!;
      faq.controls = [{ kind, words: ['Homeowners'], region: 'main', xpath: '//button' }] as typeof faq.controls;
      const found = siteFindings(r).filter((f) => f.code === 'SITE-02');
      expect(found).toHaveLength(2);
      const shown = found.find((f) => !f.title.includes('closed'))!;
      const opened = found.find((f) => f.title.includes('closed'))!;
      expect(shown).toMatchObject({ severity: 'major', title: '1 broken link: the site links to an address that answers an error' });
      expect(opened, kind).toMatchObject({ severity: 'major', title: '1 broken link in a closed part of the page: the site links to an address that answers an error' });
      expect(paths(opened)).toEqual(['/users/1']);
      expect(opened.why).toMatch(/A visitor who opens it and follows one of these links reaches an error/);
    }
    // A control of another kind (a text field) opens nothing: minor, as before.
    const r = report();
    r.pages.find((p) => p.url.endsWith('/faq'))!.controls = [{ kind: 'text field', words: ['Zip'], region: 'main', xpath: '//input' }] as CrawlReport['pages'][number]['controls'];
    expect(siteFindings(r).filter((f) => f.code === 'SITE-02').map((f) => f.severity).sort()).toEqual(['major', 'minor']);
  });

  it('SITE-03: a redirect only in a closed part is said apart, in the same words', () => {
    const [shown, closed] = all('SITE-03');
    expect(shown.title).toBe("1 of the site's own links redirects before it arrives");
    expect(paths(shown)).toEqual(['/old']);
    expect(closed).toMatchObject({ severity: 'minor', title: "1 of the site's own links in a closed part of the page redirects before it arrives" });
    expect(paths(closed)).toEqual(['/menu-old']);
  });
});
