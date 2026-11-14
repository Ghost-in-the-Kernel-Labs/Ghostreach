// G-658 (TODO 129 box 4): a broken own-site link in a navigation menu is named by its menu ("Product → Know Your Agent"), and
// when the same item leads somewhere else on most pages the audit says so, naming the pages with the stale menu. The fixture is a
// made-up site of 12 pages whose Product menu on 3 of them points "Know Your Agent" at a missing page; its truth is by construction.
import { describe, expect, it } from 'vitest';
import type { CrawlReport, LinkEdge } from '../../src/leaf/report.js';
import { siteFindings } from '../../src/findings/findings.js';
import { menuItemOf } from '../../src/findings/stale-menu.js';
import { linksToLookAt } from '../../src/audit/links-to-look.js';

const S = 'https://agents.test';
const pages = [...Array.from({ length: 12 }, (_, i) => `/p${i + 1}`), '/know-your-agent', '/know-your-agent-2'];
const status = (p: string) => (p === '/know-your-agent-2' ? 404 : 200);
const menu = (from: string, to: string): LinkEdge => ({ from: `${S}${from}`, to: `${S}${to}`, href: to, text: 'Know Your Agent', external: false, region: 'header', hidden: true, trigger: { tag: 'button', text: 'Product' } });
const report = (edges: LinkEdge[]) =>
  ({
    startUrl: `${S}/p1`, origin: S,
    pages: pages.map((p) => ({ url: `${S}${p}`, finalUrl: `${S}${p}`, status: status(p), redirects: [], title: p, fingerprint: { hash: p, paths: ['div'] }, headings: [p] })),
    edges,
  }) as unknown as CrawlReport;
// Pages 1 to 9 link the working page; 10 to 12 the missing one.
const STALE = [...pages.slice(0, 9).map((p) => menu(p, '/know-your-agent')), ...pages.slice(9, 12).map((p) => menu(p, '/know-your-agent-2'))];
const broken = (r: CrawlReport) => siteFindings(r).find((f) => f.code === 'SITE-02');

describe('a menu item\'s name', () => {
  it('the drop-down\'s control, then any inner one, then the item; a header link by its own text; a link in the page none', () => {
    expect(menuItemOf(menu('/p1', '/x'))).toBe('Product → Know Your Agent');
    expect(menuItemOf({ ...menu('/p1', '/x'), innerTriggers: [{ tag: 'div', text: 'Trust' }] })).toBe('Product → Trust → Know Your Agent');
    expect(menuItemOf({ from: `${S}/`, to: `${S}/about`, href: '/about', text: 'About', external: false, region: 'header' })).toBe('About');
    expect(menuItemOf({ from: `${S}/`, to: `${S}/about`, href: '/about', text: 'About', external: false })).toBeNull();
    expect(menuItemOf({ from: `${S}/`, to: `${S}/about`, href: '/about', text: 'About', external: false, region: 'footer' })).toBeNull();
    expect(menuItemOf({ ...menu('/p1', '/x'), text: '' })).toBeNull();
  });
});

describe('a broken link in a menu is named by its menu, and by what most pages do', () => {
  it('3 of 12 pages point the item at a missing page: a stale menu on those pages, the working address named', () => {
    const f = broken(report(STALE));
    expect(f?.where).toHaveLength(1);
    expect(f?.where[0].url).toBe(`${S}/know-your-agent-2`);
    expect(f?.where[0].says).toBe('answered 404; linked from /p10, /p11, /p12; in the menu Product → Know Your Agent: 9 pages link /know-your-agent from it, 3 link this one: a stale menu on /p10, /p11, /p12');
    // The same words where a person is to look (item 71), so the list says it is a stale menu too.
    expect(linksToLookAt(siteFindings(report(STALE))).find((l) => l.address === '/know-your-agent-2')?.why).toBe('broken; in the menu Product → Know Your Agent: 9 pages link /know-your-agent from it, 3 link this one: a stale menu on /p10, /p11, /p12');
  });

  it('a menu item broken on every page that has it: named by its menu, no majority claimed', () => {
    const f = broken(report(pages.slice(0, 12).map((p) => menu(p, '/know-your-agent-2'))));
    expect(f?.where[0].says).toBe('answered 404; linked from /p1, /p2, /p3, /p4, /p5 and 7 more; in the menu Product → Know Your Agent');
  });

  it('no majority when the working address is linked from as few pages as the broken one, or fewer', () => {
    const even = [...['/p1', '/p2'].map((p) => menu(p, '/know-your-agent')), ...['/p3', '/p4', '/p5'].map((p) => menu(p, '/know-your-agent-2'))];
    expect(broken(report(even))?.where[0].says).toBe('answered 404; linked from /p3, /p4, /p5; in the menu Product → Know Your Agent');
  });

  it('an item of another name pointing elsewhere is not the same item', () => {
    const other = [...pages.slice(0, 9).map((p) => ({ ...menu(p, '/know-your-agent'), text: 'KYA' })), ...pages.slice(9, 12).map((p) => menu(p, '/know-your-agent-2'))];
    expect(broken(report(other))?.where[0].says).toBe('answered 404; linked from /p10, /p11, /p12; in the menu Product → Know Your Agent');
  });

  it('a broken link in the page itself says nothing of a menu', () => {
    const body = pages.slice(0, 2).map((p) => ({ from: `${S}${p}`, to: `${S}/know-your-agent-2`, href: '/know-your-agent-2', text: 'Know Your Agent', external: false }));
    expect(broken(report(body))?.where[0].says).toBe('answered 404; linked from /p1, /p2');
  });
});
