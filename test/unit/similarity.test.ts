import { describe, expect, it } from 'vitest';
import { fingerprintFromPaths } from '../../src/leaf/pages/fingerprint.js';
import { joinOf, likeness, maskedHeadings, pathSuffixes, sameType, siteContext, slugWords } from '../../src/leaf/pages/similarity.js';

const page = (url: string, paths: string[], headings?: string[]) => ({ url, fingerprint: fingerprintFromPaths(paths), headings });

/** Every prefix of each chain, the way a fingerprint lists element paths. */
function tree(prefix: string, chains: string[]): string[] {
  const out = new Set<string>();
  for (const chain of chains) {
    const steps = [...(prefix ? prefix.split('/') : []), ...chain.split('/')];
    for (let i = 1; i <= steps.length; i++) out.add(steps.slice(0, i).join('/'));
  }
  return [...out];
}

const entry = [
  'div.grid-col/table.vitals-table/tbody/tr/th',
  'div.grid-col/table.vitals-table/tbody/tr/td/a.type-icon',
  'div.grid-col/table.vitals-table/tbody/tr/td/strong',
  'div.grid-col/div.resp-scroll/table.data-table/thead/tr/th',
  'div.grid-col/div.resp-scroll/table.data-table/tbody/tr/td/a.ent-name',
  'div.grid-col/div.resp-scroll/table.data-table/tbody/tr/td/span.type-icon',
  'div.grid-col/ul.list-nav/li/a',
  'div.grid-col/p/em',
];

describe('pathSuffixes', () => {
  it('keeps the last three steps of each path', () => {
    expect([...pathSuffixes(['main/div.tabs/div.panel/table/tbody/tr', 'main'])]).toEqual(['table/tbody/tr', 'main']);
  });
});

describe('slugWords and maskedHeadings', () => {
  it('takes the name from the last URL segment', () => {
    expect(slugWords('https://x.test/pokedex/mr-mime')).toEqual(['mime']); // "mr" is too short to mask safely
    expect(slugWords('https://x.test/pokebase/user/Jasone+the+PARAD0X')).toEqual(['jasone', 'parad0x']);
    // Function words name nothing: masking "the" would turn "About the author" into "about {name} author".
    expect(slugWords('https://x.test/insights/the-quiet-cost-of-legacy-code')).toEqual(['quiet', 'cost', 'legacy', 'code']);
    expect(slugWords('https://x.test/')).toEqual([]);
    // A slug that will not decode (a broken %-escape) is taken as written, lower-cased.
    expect(slugWords('https://x.test/tag/Bad%E0%A4%A')).toEqual(['bad%e0%a4%a']);
    // A trailing slash names the segment before it; three letters are enough to be a name.
    expect(slugWords('https://x.test/pokedex/mew/')).toEqual(['mew']);
  });

  it('takes a paged listing\'s name from its listing, not its page number (quotes.toscrape.com, 2026-10-16)', () => {
    expect(slugWords('https://x.test/tag/love/page/1/')).toEqual(['love']);
    expect(slugWords('https://x.test/catalogue/page-2.html')).toEqual(['catalogue']);
    expect(slugWords('https://x.test/books/travel/index.html')).toEqual(['travel']);
    // Page 2 of the top page has no name of its own, as the top page has none.
    expect(slugWords('https://x.test/page/2/')).toEqual([]);
  });

  it('replaces the page name in its headings', () => {
    const headings = maskedHeadings(page('https://x.test/pokedex/bagon', [], ['Bagon', 'Moves learned by Bagon', 'Base stats']));
    expect([...headings]).toEqual(['{name}', 'moves learned by {name}', 'base stats']);
  });

  it('replaces the slug as the address spells it, function words and all; words apart stay words', () => {
    const headings = maskedHeadings(page('https://x.test/tag/the-hunger-games/page/1/', [], ['Viewing tag: the-hunger-games', 'Hunger Games', 'Top tags']));
    expect([...headings]).toEqual(['viewing tag: {name}', '{name} {name}', 'top tags']);
  });
});

describe('sameType', () => {
  it('a short page inside a longer one is one type only below the top level: every top-level page is /* (Site I, 2026-10-03)', () => {
    // A contact page that is mostly the form the site repeats under other pages: all its headings are on the about page.
    const form = ['Nav one', 'Nav two', 'Nav three', 'Built for your growth', 'Full name', 'Business email', 'Project details', 'Attach files'];
    const about = (url: string) => page(url, ['main/div', 'main/section', 'main/section/h2'], ['Who we are today', 'Challenges we solve', 'Scale smart', 'Compliance built in', 'Our values', 'Transparency', 'Innovation', 'Quality', 'Convenience', 'It\'s all about people', ...form]);
    const contact = (url: string) => page(url, ['main/div', 'main/section'], form);
    expect(likeness(contact('https://x.test/contact'), about('https://x.test/about')).overlap).toBe(1);
    expect(joinOf(contact('https://x.test/contact'), about('https://x.test/about'))).toBeNull();
    // Under one pattern below the top level, the same containment still joins (a Pokémon with fewer sections).
    expect(joinOf(contact('https://x.test/offices/berlin'), about('https://x.test/offices/paris'))?.rule).toBe('headings-agree');
  });

  it('ignores wrappers: a Pokémon whose content sits in form tabs is still a Pokémon page', () => {
    const plain = page('https://x.test/pokedex/bagon', tree('main/div.grid-row', entry), ['Bagon', 'Base stats']);
    const tabbed = page('https://x.test/pokedex/golem', tree('main/div.tabs-panel/div.grid-row', entry), ['Golem', 'Base stats', 'Alolan Golem']);
    expect(likeness(plain, tabbed).shape).toBeGreaterThan(0.7);
    expect(sameType(plain, tabbed)).toBe(true);
  });

  it('counts headings that differ only by the page name as the same', () => {
    // Shapes only half alike (one has an extra section), headings identical once names are masked.
    const a = page('https://x.test/pokedex/bagon', ['main/div'], ['Bagon', 'Base stats', 'Moves learned by Bagon', 'Type defenses']);
    const b = page('https://x.test/pokedex/pecharunt', ['main/div', 'main/section'], ['Pecharunt', 'Base stats', 'Moves learned by Pecharunt', 'Type defenses']);
    expect(likeness(a, b).headings).toBe(1);
    expect(sameType(a, b)).toBe(true);
  });

  it('does not trust matching headings when the shapes are far apart (type chart vs a type page)', () => {
    const abbreviations = ['Nor', 'Fir', 'Wat', 'Ele', 'Gra', 'Ice'];
    const chart = page('https://x.test/type', tree('main', ['table.type-table/thead/tr/th', 'table.type-table/tbody/tr/td/a']), ['Type chart', ...abbreviations]);
    const grass = page('https://x.test/type/grass', tree('main', ['div.grid-col/ul/li/a', 'div.grid-col/p/em', 'div.grid-col/h2']), ['Grass (type)', ...abbreviations]);
    expect(likeness(chart, grass).headings!).toBeGreaterThanOrEqual(0.5);
    expect(likeness(chart, grass).shape).toBeLessThan(0.4);
    expect(sameType(chart, grass)).toBe(false);
  });

  it('keeps section pages with one layout apart when their headings differ (/move vs /item: shape 0.89)', () => {
    const layout = tree('', ['header/nav/ul/li/a', 'main/h1', 'main/div.grid-col/ul/li/a', 'main/div.grid-col/p', 'footer/p/a']);
    const moves = page('https://x.test/move', layout, ['Pokémon moves', 'Physical', 'Special', 'Status']);
    const items = page('https://x.test/item', layout, ['Pokémon items', 'Berries', 'Held items', 'Machines']);
    expect(likeness(moves, items).shape).toBe(1);
    expect(sameType(moves, items)).toBe(false);
  });

  it('matches pages whose headings mostly name the page, when the shapes agree (locations)', () => {
    const shape = tree('main', entry);
    const a = page('https://x.test/location/kanto-route-22', shape, ['Route 22', 'Generation 1', 'Red/Blue', 'Walking', 'Surfing']);
    const b = page('https://x.test/location/hoenn-meteor-falls', shape, ['Meteor Falls', 'Generation 3', 'Ruby/Sapphire', 'Walking', 'Surfing']);
    expect(likeness(a, b).headings!).toBeLessThan(0.5);
    expect(sameType(a, b)).toBe(true);
  });

  it('trusts a heading subset only between pages of one URL pattern (a part of a page is not its sibling)', () => {
    // Shapes 0.5 alike, headings 0.33: only the subset rule can join them (the small page's 4 headings all on the big one).
    const common = ['main/h1', 'main/table/tr/td', 'main/table/tr/th', 'main/p'];
    const big = ['Base stats', 'Moves learned', 'Evolution chart', 'Type defenses', 'Pokédex data', 'Training', 'Breeding', 'Where to find', 'Other languages', 'Name origin', 'Sprites', 'Changes'];
    const whole = (url: string) => page(url, [...common, 'main/ul/li/a', 'main/div.tabs/a', 'main/div.tabs/span', 'main/form/input'], big);
    const part = (url: string) => page(url, common, big.slice(0, 4));
    expect(likeness(whole('https://x.test/move/surf'), part('https://x.test/move/tackle'))).toEqual({ shape: 0.5, headings: 4 / 12, overlap: 1 });
    expect(sameType(whole('https://x.test/move/surf'), part('https://x.test/move/tackle'))).toBe(true);
    expect(sameType(whole('https://x.test/pokedex/houndour'), part('https://x.test/pokedex/houndour/moves/9'))).toBe(false);
  });

  it('uses shape alone when a page has no headings', () => {
    const a = page('https://x.test/a', ['main', 'main/p']);
    const b = page('https://x.test/b', ['main', 'main/p'], ['Title']);
    expect(likeness(a, b).headings).toBeNull();
    expect(sameType(a, b)).toBe(true);
  });
});

describe('joinOf: the rule that decided', () => {
  const shape = tree('main', entry);

  it('names the rule, and agrees with sameType', () => {
    const a = page('https://x.test/pokedex/bulbasaur', shape, ['Pokédex data', 'Base stats', 'Bulbasaur moves']);
    const b = page('https://x.test/pokedex/ivysaur', shape, ['Pokédex data', 'Base stats', 'Ivysaur moves']);
    expect(joinOf(a, b)).toEqual({ rule: 'headings-agree', shape: 1, headings: 1 });
    const bare = page('https://x.test/a', ['main', 'main/p']);
    expect(joinOf(bare, page('https://x.test/b', ['main', 'main/p']))!.rule).toBe('layout-no-headings');
    const other = page('https://x.test/type', ['nav', 'nav/ul', 'nav/ul/li'], ['Type chart']);
    expect(joinOf(a, other)).toBeNull();
    expect(sameType(a, other)).toBe(false);
  });

  it('credits the listing rule only where the headings did not already decide', () => {
    // Two category pages built alike, whose headings (their books) share nothing.
    const a = page('https://x.test/catalogue/category/travel_2/index.html', shape, ['It\'s Only the Himalayas', 'Full Moon over Noah\'s Ark']);
    const b = page('https://x.test/catalogue/category/poetry_23/index.html', shape, ['Olio', 'Howl and Other Poems']);
    expect(joinOf(a, b)!.rule).toBe('listing-folder');
    const c = page('https://x.test/catalogue/category/poetry_23/page-2.html', shape, ['Olio', 'Howl and Other Poems']);
    expect(joinOf(b, c)!.rule).toBe('headings-agree');
  });
});

/**
 * The rules at their edges, and what a site of one layout changes (siteContext): the first mutation run (G-239)
 * found the one-layout rules and the site's furniture untried by any unit test, and every threshold's own edge.
 */
describe('a site of one layout (site-d.example, a Wix site)', () => {
  const layout = ['a', 'b', 'c', 'd', 'e'];
  const at = (path: string, headings?: string[], paths = layout) => page(`https://x.test${path}`, paths, headings);
  const uniform = (furniture: string[] = []) => ({ uniformShapes: true, furniture: new Set(furniture) });

  it('is one when 80% of the pages after the start are shaped at least 0.8 like the one most like the rest, whatever the start is shaped like (G-247)', () => {
    const four = ['a', 'b', 'c', 'd'];
    const after = [at('/one', ['Menu', 'First'], ['x', 'y']), at('/two', ['MENU', 'Footer', 'Footer'], four), at('/three', ['Menu', 'Footer']), at('/four', ['menu', 'Footer']), at('/five', ['Menu', 'Footer', 'Five only'])];
    // A home page of a shape of its own, as webscraper's is: it judges nothing.
    const start = at('/', ['Menu', 'Start only'], ['q']);
    // The judge is /five (/three, /four and /five alike, the least address of them): 4 of the 5 pages after the start
    // shaped 0.8 like it; Menu on 5 of 5, Footer on 4 of 5, Five only on 1.
    expect(siteContext([...after, start], 'https://x.test/')).toEqual(uniform(['menu', 'footer']));
    // In any order, the start page anywhere.
    expect(siteContext([after[3], start, after[0], after[4], after[1], after[2]], 'https://x.test/')).toEqual(uniform(['menu', 'footer']));
    // A heading on 3 of 5 is not furniture.
    expect(siteContext([after[0], after[1], after[2], at('/four', ['Menu']), after[4], start], 'https://x.test/')).toEqual(uniform(['menu']));
    // 3 of 5 shaped alike: not one layout, however like them the start page is.
    expect(siteContext([after[0], at('/two', [], ['z']), after[2], after[3], after[4], at('/', ['Menu'])], 'https://x.test/')).toEqual({ uniformShapes: false, furniture: new Set() });
    // The start page not among the samples: every page read is after it.
    expect(siteContext([after[2], after[3], after[4]], 'https://x.test/elsewhere')).toEqual(uniform(['menu', 'footer']));
  });

  it('the judge is the page most like the others, not the first; of pages alike, the least address', () => {
    // /a-odd comes first by address and by order, and is like nothing: judged by it, no site is one layout.
    const odd = at('/a-odd', ['Menu'], ['q', 'r']);
    const rest = ['/m', '/n', '/o', '/p'].map((p) => at(p, ['Menu']));
    expect(siteContext([odd, ...rest, at('/')], 'https://x.test/').uniformShapes).toBe(true);
    // Read last, too: a lower address alone never makes a page the judge.
    expect(siteContext([...rest, at('/'), odd], 'https://x.test/').uniformShapes).toBe(true);
    // All alike: /b judges (the least address), its headings the ones counted; /f, last, would count "Sea" too.
    const alike = [at('/b', ['Menu', 'Bee']), at('/c', ['Menu', 'Sea']), at('/d', ['Menu', 'Bee', 'Sea']), at('/e', ['Menu', 'Bee', 'Sea']), at('/f', ['Menu', 'Bee', 'Sea'])];
    expect(siteContext([...alike, at('/')], 'https://x.test/')).toEqual(uniform(['menu', 'bee']));
    expect(siteContext([...alike].reverse().concat(at('/')), 'https://x.test/')).toEqual(uniform(['menu', 'bee']));
  });

  it('needs 3 pages read, two of them after the start', () => {
    expect(siteContext([at('/'), at('/a')], 'https://x.test/')).toEqual({ uniformShapes: false, furniture: new Set() });
    expect(siteContext([at('/a'), at('/b')], 'https://x.test/elsewhere')).toEqual({ uniformShapes: false, furniture: new Set() });
    expect(siteContext([at('/'), at('/a'), at('/b')], 'https://x.test/').uniformShapes).toBe(true);
    expect(siteContext([], 'https://x.test/').uniformShapes).toBe(false);
  });

  it('joins pages under one pattern below the top level whatever they show, and only those', () => {
    expect(joinOf(at('/post/a', ['One']), at('/post/b', ['Two']), uniform())).toEqual({ rule: 'address-below-top', shape: null, headings: null });
    expect(joinOf(at('/post/a', ['One']), at('/news/b', ['Two']), uniform())).toBeNull();
    expect(joinOf(at('/careers', ['One']), at('/about', ['Two']), uniform())).toBeNull();
  });

  it("joins top-level pages by their own headings: the site's furniture and a page's own name aside", () => {
    const furniture = uniform(['site name', 'contact us']);
    // Half their own headings shared: one type, said with how much.
    expect(joinOf(at('/careers', ['Site Name', 'Open roles', 'Benefits']), at('/jobs', ['Site Name', 'Open roles', 'Benefits', 'Perks']), furniture)).toEqual({ rule: 'own-headings', shape: null, headings: 2 / 3 });
    expect(joinOf(at('/careers', ['Open roles', 'Benefits']), at('/jobs', ['Open roles']), uniform())?.headings).toBe(0.5);
    expect(joinOf(at('/careers', ['Open roles', 'Benefits', 'Perks']), at('/jobs', ['Open roles']), uniform())).toBeNull();
    // Only the furniture shared: not one type.
    expect(joinOf(at('/careers', ['Site Name', 'Contact us', 'Open roles']), at('/about', ['Site Name', 'Contact us', 'Our story']), furniture)).toBeNull();
    // A heading that is only the page's name ("Careers" on /careers, "Jobs:" on /jobs) says nothing.
    expect(joinOf(at('/careers', ['Careers:']), at('/jobs', ['Jobs:']), uniform())).toBeNull();
    // A page with no headings of its own, on either side.
    expect(joinOf(at('/careers', ['Site Name']), at('/jobs', ['Open roles']), furniture)).toBeNull();
    expect(joinOf(at('/careers', ['Open roles']), at('/jobs'), furniture)).toBeNull();
  });

  it('still joins a listing by the listing rule: one folder pattern below the top level, nearly alike, its own headings apart (G-277)', () => {
    // A category's page 2 and another category's first page: other books, other names, one layout.
    const garden2 = at('/shop/category/garden/page-2.html', ['Garden', 'Copper bucket', 'Slate lamp']);
    const kitchen = at('/shop/category/kitchen/index.html', ['Kitchen', 'Oak shelf', 'Iron hook']);
    expect(joinOf(garden2, kitchen, uniform())).toEqual({ rule: 'listing-folder', shape: 1, headings: null });
    // With no headings of its own on one side too.
    expect(joinOf(at('/shop/category/garden/page-2.html'), kitchen, uniform())?.rule).toBe('listing-folder');
    // Not at the top level, not in another folder, not of another layout.
    expect(joinOf(at('/garden', ['Garden']), at('/kitchen', ['Kitchen']), uniform())).toBeNull();
    expect(joinOf(garden2, at('/blog/category/news/index.html', ['News']), uniform())).toBeNull();
    expect(joinOf(garden2, at('/shop/category/kitchen/index.html', ['Kitchen'], ['q', 'r', 's']), uniform())).toBeNull();
  });
});

describe('each rule at its threshold', () => {
  // Paths of three steps or fewer are their own suffixes: a page holding n of the other's m is a shape of n/m.
  const shaped = (n: number, m: number) => [Array.from({ length: m }, (_, i) => `p${i}`), Array.from({ length: n }, (_, i) => `p${i}`)];
  const pair = (url: string, other: string, [pa, pb]: string[][], ha?: string[], hb?: string[]) => joinOf(page(`https://x.test${url}`, pa, ha), page(`https://x.test${other}`, pb, hb));

  it('layouts alike at 0.7 with no headings; an empty page is shaped like another empty page', () => {
    expect(pair('/a', '/b', shaped(7, 10))?.rule).toBe('layout-no-headings');
    expect(pair('/a', '/b', shaped(6, 10))).toBeNull();
    expect(pair('/a', '/b', [[], []])).toEqual({ rule: 'layout-no-headings', shape: 1, headings: null });
    expect(pair('/a', '/b', shaped(7, 10), ['Title'])?.rule).toBe('layout-no-headings');
    expect(likeness(page('https://x.test/a', [], ['Title']), page('https://x.test/b', [])).headings).toBeNull();
  });

  it('headings agreeing at 0.5 need a shape of 0.4', () => {
    expect(pair('/a', '/b', shaped(4, 10), ['X', 'Y'], ['X'])).toEqual({ rule: 'headings-agree', shape: 0.4, headings: 0.5 });
    expect(pair('/a', '/b', shaped(3, 10), ['X', 'Y'], ['X'])).toBeNull();
    expect(pair('/a', '/b', shaped(4, 10), ['X', 'Y', 'Z'], ['X'])).toBeNull();
  });

  it('a page contained in another at 0.8, its smaller side at least 4 headings, under one pattern below the top level', () => {
    const big = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'h10'];
    const half = shaped(5, 10);
    // 4 of 5 on the other: 0.8; headings 4/11 alone would not join.
    expect(pair('/move/a', '/move/b', half, ['h1', 'h2', 'h3', 'h4', 'x'], big)?.rule).toBe('headings-agree');
    expect(pair('/move/a', '/move/b', half, ['h1', 'h2', 'h3', 'x', 'y'], big)).toBeNull();
    // Exactly 4 headings on the smaller page is enough; 3 is not (overlap needs 4).
    expect(pair('/move/a', '/move/b', half, ['h1', 'h2', 'h3', 'h4'], big)?.rule).toBe('headings-agree');
    expect(pair('/move/a', '/move/b', half, ['h1', 'h2', 'h3'], big)).toBeNull();
    // The overlap is of the smaller page: measured against the bigger one, 4 of 10 would not do.
    expect(likeness(page('https://x.test/move/a', [], ['h1', 'h2', 'h3', 'h4']), page('https://x.test/move/b', [], big)).overlap).toBe(1);
    // A number is no fixed segment (/{n}/*), and a query no segment at all (/*?).
    expect(pair('/7/a', '/8/b', half, ['h1', 'h2', 'h3', 'h4'], big)).toBeNull();
    expect(pair('/search?q=a', '/search?q=b', half, ['h1', 'h2', 'h3', 'h4'], big)).toBeNull();
  });

  it('layouts alike at 0.7 with headings shared at 0.15', () => {
    const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
    // 3 shared of 20 = 0.15.
    expect(pair('/a', '/b', shaped(7, 10), [...many('s', 3), ...many('a', 8)], [...many('s', 3), ...many('b', 9)])).toEqual({ rule: 'layout-and-some-headings', shape: 0.7, headings: 0.15 });
    expect(pair('/a', '/b', shaped(7, 10), [...many('s', 2), ...many('a', 9)], [...many('s', 2), ...many('b', 9)])).toBeNull();
  });

  it("a listing at 0.85, compared by its folder when it ends in a file name, at least one fixed segment deep", () => {
    const alike = shaped(17, 20);
    expect(pair('/cat/a', '/cat/b', alike, ['One'], ['Two'])?.rule).toBe('listing-folder');
    expect(pair('/cat/a', '/cat/b', shaped(16, 20), ['One'], ['Two'])).toBeNull();
    expect(pair('/cat/a', '/shop/b', alike, ['One'], ['Two'])).toBeNull();
    // Page 2 of one category and the first page of another: each in a folder of /cat.
    expect(pair('/cat/a/index.html', '/cat/b/page-2.html', alike, ['One'], ['Two'])?.rule).toBe('listing-folder');
    // A file at the top of a folder: the folder is the page, top level (/x/a.html is in /*).
    expect(pair('/x/a.html', '/x/b.html', alike, ['One'], ['Two'])).toBeNull();
    // A segment with a long ending is no file name.
    expect(pair('/x/a.backup2026', '/x/b.backup2026', alike, ['One'], ['Two'])?.rule).toBe('listing-folder');
    expect(pair('/a', '/b', alike, ['One'], ['Two'])).toBeNull();
  });
});
