/**
 * A page of the site's menu is read before a crawl stops saturated (TODO 132 box 7, G-674): the frontier says whether one waits,
 * a settled pattern's included, and hands it out; the crawl's checklist will not stop early while one waits, and takes it next once
 * saturated. The crawl itself: test/crawl/menu-before-stop.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import { Checklist } from '../../src/crawl/checklist.js';
import { Frontier } from '../../src/crawl/frontier.js';

const O = 'https://site.test';
const MENU = [`${O}/about`, `${O}/contact`];

/** Three pages read, each linking the two menu pages; `/about` queued with a post. */
function frontierWithMenu(): Frontier {
  const f = new Frontier();
  for (const from of ['/', '/blog/a', '/blog/b']) f.recordLinks(`${O}${from}`, MENU);
  f.add({ url: `${O}/blog/c`, depth: 1 });
  f.add({ url: `${O}/about`, depth: 1 });
  return f;
}

function checklistOf(frontier: Frontier): Checklist {
  return new Checklist(frontier);
}

describe('the menu before a saturated stop (G-674)', () => {
  it('the frontier says a menu page waits, hands it out, and then says none does', () => {
    const f = frontierWithMenu();
    expect(f.menuWaiting).toBe(true);
    expect(f.nextMenu()?.url).toBe(`${O}/about`);
    expect(f.menuWaiting).toBe(false);
    expect(f.nextMenu()).toBeUndefined();
    expect(f.next()?.url).toBe(`${O}/blog/c`); // the rest as before
  });

  it('a page linked from fewer than most pages read is no menu page', () => {
    const f = new Frontier();
    for (const from of ['/', '/blog/a', '/blog/b']) f.recordLinks(`${O}${from}`, from === '/' ? [`${O}/careers`] : []);
    f.add({ url: `${O}/careers`, depth: 1 });
    expect(f.menuWaiting).toBe(false);
  });

  it('the checklist does not stop saturated while a menu page waits, and takes it next', () => {
    const list = checklistOf(frontierWithMenu());
    expect(list.stopsEarly(true)).toBe(false);
    expect(list.next(true)?.url).toBe(`${O}/about`);
    expect(list.stopsEarly(true)).toBe(true);
  });

  it('before it is saturated, the checklist picks as it always did', () => {
    const list = checklistOf(frontierWithMenu());
    expect(list.stopsEarly(false)).toBe(false);
    expect(list.next(false)?.url).toBe(`${O}/blog/c`); // the two patterns tie, and the one found first goes first, as before
  });
});

describe('a small menu first under a page limit (G-745 (5))', () => {
  /** frontierWithMenu's pages, read by a frontier that reads a menu of at most `menuFirst` addresses first. */
  function limited(menuFirst: number): Frontier {
    const f = new Frontier(2, Infinity, menuFirst);
    for (const from of ['/', '/blog/a', '/blog/b']) f.recordLinks(`${O}${from}`, MENU);
    f.add({ url: `${O}/blog/c`, depth: 1 });
    f.add({ url: `${O}/about`, depth: 1 });
    return f;
  }

  it('counts the menu addresses it can read, not one it never queued', () => {
    expect(limited(2).menuSize).toBe(1); // /contact is linked from every page, but never queued (refused, say)
  });

  it('a menu no bigger than the threshold is read before any other page', () => {
    const f = limited(1);
    expect(f.next()?.url).toBe(`${O}/about`);
    expect(f.next()?.url).toBe(`${O}/blog/c`);
  });

  it('a bigger menu, or no limit (0), keeps the order as before', () => {
    const picks = (f: Frontier) => Array.from({ length: f.size }, () => f.next()?.url);
    const bigger = (f: Frontier) => {
      f.add({ url: `${O}/blog/d`, depth: 1 });
      f.add({ url: `${O}/contact`, depth: 1 }); // now two menu addresses: above a threshold of 1
      return f;
    };
    expect(picks(bigger(limited(1)))).toEqual(picks(bigger(limited(0))));
    expect(picks(bigger(limited(0)))[0]).toBe(`${O}/blog/d`); // the two patterns tie, the one found first goes first, and spreads: its last
    expect(picks(limited(0))[0]).toBe(`${O}/blog/c`);
  });
});
