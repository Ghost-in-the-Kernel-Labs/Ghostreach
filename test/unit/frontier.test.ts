import { describe, expect, it } from 'vitest';
import { Frontier, sectionOf, spreadIndex } from '../../src/crawl/frontier.js';
import { urlPattern } from '../../src/leaf/pages/url.js';
import { fingerprintFromPaths } from '../../src/leaf/pages/fingerprint.js';

describe('urlPattern', () => {
  it('wildcards the last path segment', () => {
    expect(urlPattern('https://x.test/pokedex/bulbasaur')).toBe('/pokedex/*');
    expect(urlPattern('https://x.test/pokedex/game/scarlet-violet')).toBe('/pokedex/game/*');
    expect(urlPattern('https://x.test/move')).toBe('/*');
  });

  it("wildcards the folder when the address ends in its index file (books.toscrape.com), and only then", () => {
    expect(urlPattern('https://x.test/catalogue/category/books/travel_2/index.html')).toBe('/catalogue/category/books/*/index.html');
    expect(urlPattern('https://x.test/shop/Default.aspx')).toBe('/*/Default.aspx'); // any case, any index file
    expect(urlPattern('https://x.test/catalogue/category/books/mystery_3/page-2.html')).toBe('/catalogue/category/books/mystery_3/*');
    expect(urlPattern('https://x.test/index.html')).toBe('/*');
  });

  it('wildcards all-digit segments in the middle', () => {
    expect(urlPattern('https://x.test/news/348/new-games')).toBe('/news/{n}/*');
    expect(urlPattern('https://x.test/v2/items')).toBe('/v2/*');
  });

  it('keeps the root apart and marks query strings', () => {
    expect(urlPattern('https://x.test/')).toBe('/');
    expect(urlPattern('https://x.test/?page=2')).toBe('/?');
    expect(urlPattern('https://x.test/search?q=a')).toBe('/*?');
  });
});

const url = (path: string) => `https://x.test${path}`;
const shapeA = fingerprintFromPaths(['main', 'main/table', 'main/table/tr']);
const shapeB = fingerprintFromPaths(['main', 'main/ul', 'main/ul/li']);

function drain(f: Frontier, shapes: Record<string, typeof shapeA> = {}, budget = Infinity): string[] {
  const picked: string[] = [];
  for (let item = picked.length < budget ? f.next() : undefined; item; item = picked.length < budget ? f.next() : undefined) {
    const path = item.url.replace('https://x.test', '');
    picked.push(path);
    if (shapes[path]) f.recordSample(item.url, { url: item.url, fingerprint: shapes[path] });
  }
  return picked;
}

describe('sectionOf', () => {
  it('is the first path segment of deeper patterns, and / for top-level pages', () => {
    expect(sectionOf('/pokebase/rmt/tag/*')).toBe('pokebase');
    expect(sectionOf('/pokedex/*')).toBe('pokedex');
    expect(sectionOf('/*')).toBe('/');
    expect(sectionOf('/')).toBe('/');
    expect(sectionOf('/search?')).toBe('/');
  });
});

describe('Frontier', () => {
  it('gives patterns turns in proportion to the links found for them', () => {
    const f = new Frontier();
    for (const p of ['/move', '/type', '/pokedex/bulbasaur', '/pokedex/ivysaur', '/pokedex/charmander', '/pokedex/squirtle']) {
      f.add({ url: url(p), depth: 1 });
    }
    // /pokedex/* has 4 links, /* has 2. Scores (links / (crawled + 1)): 4 vs 2, then 2 vs 2
    // (tie: more links wins), 1.33 vs 2, 1.33 vs 1, 1 vs 1 (tie), then /move.
    // Within a pattern (no menu pages here): last, then middle, then a quarter in, of what is left.
    expect(drain(f)).toEqual(['/pokedex/squirtle', '/pokedex/ivysaur', '/type', '/pokedex/bulbasaur', '/pokedex/charmander', '/move']);
  });

  it('keeps a stream of one-off patterns (a forum) behind a big family of pages', () => {
    const f = new Frontier();
    for (let i = 1; i <= 6; i++) f.add({ url: url(`/forum/user/u${i}/wall`), depth: 2 }); // 6 patterns, 1 link each
    for (const p of ['bulbasaur', 'ivysaur', 'charmander']) f.add({ url: url(`/pokedex/${p}`), depth: 2 });
    expect(drain(f).slice(0, 2)).toEqual(['/pokedex/charmander', '/pokedex/ivysaur']);
  });

  it('breaks exact ties by links found, then by the pattern found first', () => {
    const f = new Frontier();
    for (const p of ['/a/1', '/b/1', '/c/1', '/c/2']) f.add({ url: url(p), depth: 1 });
    // /c/* 2/1 first; then /c/* 2/2 = 1 ties /a/* and /b/* 1/1: /c/* has more links; then /a before /b.
    expect(drain(f)).toEqual(['/c/2', '/c/1', '/a/1', '/b/1']);
  });

  it('settles a pattern after two pages in a row match a shape already seen; the rest of it waits', () => {
    const f = new Frontier();
    for (const p of ['/p/1', '/p/2', '/p/3', '/p/4', '/p/5']) f.add({ url: url(p), depth: 1 });
    f.add({ url: url('/other/x/1'), depth: 1 });
    const all = { '/p/1': shapeA, '/p/2': shapeA, '/p/3': shapeA, '/p/4': shapeA, '/p/5': shapeA, '/other/x/1': shapeB };
    // Last, middle, a quarter in: the second and third matched the first, so the pattern is settled.
    // Its other pages come after everything unsettled (site-d.example: a small site is read whole).
    const order = drain(f, all);
    expect(order.slice(0, 3)).toEqual(['/p/5', '/p/3', '/p/1']);
    expect(order.indexOf('/other/x/1')).toBeLessThan(order.indexOf('/p/2'));
    expect(order.indexOf('/other/x/1')).toBeLessThan(order.indexOf('/p/4'));
    expect(order).toHaveLength(6);
    expect(f.size).toBe(0);
  });

  it('reports a settled pattern\'s pages the budget did not reach as enough samples', () => {
    const f = new Frontier();
    for (const p of ['/p/1', '/p/2', '/p/3', '/p/4', '/p/5']) f.add({ url: url(p), depth: 1 });
    const all = { '/p/1': shapeA, '/p/2': shapeA, '/p/3': shapeA, '/p/4': shapeA, '/p/5': shapeA };
    expect(drain(f, all, 3)).toEqual(['/p/5', '/p/3', '/p/1']);
    expect(f.leftovers()).toEqual([
      { url: url('/p/2'), settled: true, sampled: true, menu: false },
      { url: url('/p/4'), settled: true, sampled: true, menu: false },
    ]);
  });

  it('keeps sampling a pattern whose pages differ', () => {
    const f = new Frontier();
    for (const p of ['/p/1', '/p/2', '/p/3', '/p/4']) f.add({ url: url(p), depth: 1 });
    expect(drain(f, { '/p/1': shapeA, '/p/2': shapeB, '/p/3': shapeA, '/p/4': shapeB })).toHaveLength(4);
  });

  it('a new shape resets the streak', () => {
    const f = new Frontier();
    for (const p of ['/p/1', '/p/2', '/p/3', '/p/4', '/p/5']) f.add({ url: url(p), depth: 1 });
    // Picked in the order 5, 3, 1, 4, 2: A, A (1 match), B (new: reset), A (1 match), B (2nd match: settled)
    expect(drain(f, { '/p/5': shapeA, '/p/3': shapeA, '/p/1': shapeB, '/p/4': shapeA, '/p/2': shapeB })).toHaveLength(5);
  });

  it('picks menu pages of a pattern first: linked from at least 80% of the pages read', () => {
    const f = new Frontier();
    for (const p of ['/pokedex/bulbasaur', '/pokedex/all', '/pokedex/ivysaur', '/pokedex/charmander']) f.add({ url: url(p), depth: 1 });
    // Three pages read, all linking to /pokedex/all; only one links to Ivysaur.
    f.recordLinks(url('/'), [url('/pokedex/all'), url('/pokedex/ivysaur')]);
    f.recordLinks(url('/move'), [url('/pokedex/all')]);
    f.recordLinks(url('/type'), [url('/pokedex/all')]);
    expect(f.isMenu(url('/pokedex/all'))).toBe(true);
    expect(f.isMenu(url('/pokedex/ivysaur'))).toBe(false);
    expect(drain(f)[0]).toBe('/pokedex/all');
  });

  it('does not call anything a menu page before three pages are read', () => {
    const f = new Frontier();
    f.recordLinks(url('/'), [url('/about')]);
    f.recordLinks(url('/x'), [url('/about')]);
    expect(f.isMenu(url('/about'))).toBe(false);
    f.recordLinks(url('/y'), [url('/about')]);
    expect(f.isMenu(url('/about'))).toBe(true);
  });

  it('keeps one section under its cap while other sections have pages waiting', () => {
    // Cap 2: the forum's big families would otherwise take every pick.
    const f = new Frontier(2, 2);
    for (let i = 1; i <= 5; i++) f.add({ url: url(`/forum/q/${i}`), depth: 1 });
    for (let i = 1; i <= 5; i++) f.add({ url: url(`/forum/tag/t${i}`), depth: 1 });
    f.add({ url: url('/ability/sturdy'), depth: 1 });
    f.add({ url: url('/type/fire'), depth: 1 });
    const picked = drain(f);
    expect(picked.slice(0, 4).filter((p) => p.startsWith('/forum/'))).toHaveLength(2);
    expect(picked.slice(0, 4)).toEqual(expect.arrayContaining(['/ability/sturdy', '/type/fire']));
    // Once nothing else is waiting, the capped section continues.
    expect(picked).toHaveLength(12);
  });

  it('a section whose pages never settle stays under its cap while menu pages or another section\'s settled pages wait (G-759)', () => {
    // Keeper's blog: every /blog/<language>/* pattern keeps giving new shapes, so it never settles. Its menu (five top-level pages
    // drawn alike, linked from every page) settles /* after three, and two small sections settle too. Cap 4: once the blog has had
    // its four picks, the menu pages left go first, then the settled sections' pages, and only then the blog again.
    const f = new Frontier(2, 4);
    const shapes: Record<string, ReturnType<typeof fingerprintFromPaths>> = {};
    for (const lang of ['de', 'fr', 'es']) {
      for (let i = 1; i <= 8; i++) {
        const path = `/blog/${lang}/post-${i}`;
        f.add({ url: url(path), depth: 2 });
        shapes[path] = fingerprintFromPaths(['main', `main/${lang}${i}`, `main/${lang}${i}/p`]); // a shape of its own: never settles
      }
    }
    for (const section of ['products', 'solutions']) {
      for (let i = 1; i <= 4; i++) {
        f.add({ url: url(`/${section}/item-${i}`), depth: 1 });
        shapes[`/${section}/item-${i}`] = shapeA; // drawn alike: settles after three
      }
    }
    const menu = ['/pricing', '/about', '/contact', '/careers', '/partners'];
    for (const m of menu) {
      f.add({ url: url(m), depth: 1 });
      shapes[m] = shapeB; // a site builder's top-level pages, drawn alike
    }
    const picked: string[] = [];
    for (let item = f.next(); item && picked.length < 20; item = picked.length < 20 ? f.next() : undefined) {
      const path = item.url.replace('https://x.test', '');
      picked.push(path);
      f.recordLinks(item.url, menu.map(url)); // every page links the menu
      f.recordSample(item.url, { url: item.url, fingerprint: shapes[path] });
    }
    const blog = picked.filter((p) => p.startsWith('/blog/'));
    const fifthBlog = picked.indexOf(blog[4]);
    // Every menu page and every page of the settled sections before the blog's fifth pick; the blog, at its cap until then.
    expect(menu.filter((m) => !picked.includes(m)), picked.join(' ')).toEqual([]);
    for (const m of menu) expect(picked.indexOf(m), m).toBeLessThan(fifthBlog);
    expect(picked.filter((p) => /^\/(products|solutions)\//.test(p)), picked.join(' ')).toHaveLength(8);
    expect(picked.slice(0, fifthBlog).filter((p) => p.startsWith('/blog/'))).toHaveLength(4);
    // Once nothing but the never-settling section is left, it takes the rest of the budget, as before.
    expect(picked).toHaveLength(20);
    expect(blog).toHaveLength(7);
  });

  it('lists leftovers in the order they were found', () => {
    const f = new Frontier();
    for (const p of ['/b/1', '/a/1', '/b/2', '/a/2']) f.add({ url: url(p), depth: 1 });
    expect(f.leftovers().map((l) => l.url)).toEqual(['/b/1', '/a/1', '/b/2', '/a/2'].map(url));
  });
});

describe('spreadIndex', () => {
  it('takes the first, then the last, then spreads evenly between', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((pick) => spreadIndex(pick, 100))).toEqual([0, 99, 50, 25, 75, 12, 62]);
  });

  it('stays in range for short lists', () => {
    expect(spreadIndex(0, 1)).toBe(0);
    expect(spreadIndex(1, 1)).toBe(0);
    expect(spreadIndex(1, 2)).toBe(1);
    expect(spreadIndex(2, 1)).toBe(0);
    expect(spreadIndex(3, 3)).toBe(0);
  });
});
