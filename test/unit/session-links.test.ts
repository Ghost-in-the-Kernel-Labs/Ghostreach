import { describe, expect, it } from 'vitest';
import { withoutSessionIds } from '../../src/crawl/readers/links.js';
import { linkAddress, listSeen } from '../../src/crawl/readers/seen.js';
import type { RawLink } from '../../src/crawl/readers/links.js';

const id = 'B162CB11A9BA859F23A57CD03533A518';
const link = (over: Partial<RawLink>): RawLink => ({ href: '/a', resolved: 'https://x.test/a', text: 'A', hidden: false, region: 'main', trigger: null, innerTriggers: [], newTab: false, ...over });

describe('a link as a page wrote it, without its session id (G-305)', () => {
  it('cuts the id from the href and from the addresses of the links that open its dropdown', () => {
    const cut = withoutSessionIds(
      link({
        href: `/news.htm;jsessionid=${id}?id=6`,
        trigger: { href: `/menu.htm;jsessionid=${id}`, text: 'Menu' },
        innerTriggers: [{ href: `/more.htm;jsessionid=${id}`, text: 'More' }, { tag: 'button', text: 'Open' }],
      }),
    );
    expect(cut.href).toBe('/news.htm?id=6');
    expect(cut.trigger).toEqual({ href: '/menu.htm', text: 'Menu' });
    expect(cut.innerTriggers).toEqual([{ href: '/more.htm', text: 'More' }, { tag: 'button', text: 'Open' }]);
    expect(cut.text).toBe('A');
  });
  it('leaves a link with no trigger and an address with no id as it was', () => {
    const plain = link({});
    expect(withoutSessionIds(plain)).toEqual(plain);
    expect(withoutSessionIds(link({ trigger: { tag: 'button', text: 'Open' } })).trigger).toEqual({ tag: 'button', text: 'Open' });
  });
  it('the browser-listed address of a link: the snapshot line under it, without the id', () => {
    expect(linkAddress(`    - /url: /about.htm;jsessionid=${id}`)).toBe('/about.htm');
    expect(linkAddress('    - /url: mailto:x@y.test ')).toBe('mailto:x@y.test');
    expect(linkAddress('  - button "Go"')).toBeUndefined();
    expect(linkAddress('')).toBeUndefined();
    expect(linkAddress('x - /url: /a')).toBeUndefined();
  });
});

describe('the browser-listed links of a page, read from its ARIA snapshot (G-305)', () => {
  const page = (snapshot: string) => ({ locator: () => ({ ariaSnapshot: async () => snapshot }) }) as unknown as Parameters<typeof listSeen>[0];
  it('gives a link its address without the id, and any other control none', async () => {
    const snapshot = [`- link "About Us":`, `  - /url: /about.htm;jsessionid=${id}`, `- button "Go"`, `- link "Mail":`, `  - /url: mailto:x@y.test`].join('\n');
    expect((await listSeen(page(snapshot)))?.seen).toEqual([
      { role: 'link', name: 'About Us', url: '/about.htm' },
      { role: 'button', name: 'Go' },
      { role: 'link', name: 'Mail', url: 'mailto:x@y.test' },
    ]);
  });
  it('a button right above a line that looks like an address takes none of it', async () => {
    expect((await listSeen(page('- button "Go"\n  - /url: /a.htm')))?.seen).toEqual([{ role: 'button', name: 'Go' }]);
  });
  it('a link on the last line has no address', async () => {
    expect((await listSeen(page('- link "Last"')))?.seen).toEqual([{ role: 'link', name: 'Last' }]);
  });
});
