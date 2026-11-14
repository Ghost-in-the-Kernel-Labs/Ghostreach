/**
 * Which page to crawl next.
 *
 * Template grouping needs two or three pages of each repeated kind of page, and the budget is small.
 * Two orders that failed on pokemondb.net (live crawls, 2026-09-27):
 *
 *   - Breadth-first: the home page links to ~100 section pages, so 20 pages went to 19 sections
 *     and no Pokémon page, although 1,029 had been found.
 *   - Fewest-crawled pattern first (v0.2): every new URL pattern jumped the queue, and the site's
 *     forum makes new patterns without end (/pokebase/meta/user/Josh/wall, ...?start=20), so 43 of
 *     60 pages went to the forum and still no Pokémon page.
 *
 * What works on the real link graph: group URLs by pattern (the last path segment and any all-digit
 * segment wildcarded: /pokedex/bulbasaur -> /pokedex/*, /news/348/some-title -> /news/{n}/*) and
 * give each pattern turns in proportion to how many links to it were found. Each pick goes to the
 * pattern with the most links found per page already crawled from it, found / (crawled + 1).
 * Ties go to the pattern with more links, then to the one found first. Within a pattern, URLs keep
 * the order they were found in. The pattern's menu pages (linked from at least 80% of the pages
 * read, like /pokedex/all) are picked first; then picks are spread across the rest (last, middle,
 * then the middles of the gaps): the first links found are often the newest pages, featured on the
 * home page, and new pages can be thin (Browt, Pombon and Gecqua rather than a full page).
 * Big families of pages (1,029 Pokémon, 674 locations) are the
 * templates worth testing, and they get sampled first; a forum's hundred one-off patterns wait.
 * The cost: a kind of page reached through only one or two links gets its turn late.
 * Under a page limit, a small menu (at most MENU_FIRST_PAGES addresses) is read before any of this, so the budget
 * cannot leave a footer menu unread (G-745 (5)); a bigger one keeps its place in its pattern, as above.
 *
 * A pattern is "settled" once it has produced `settleAfter` pages in a row that are like a page it
 * already gave (similarity.ts; a 4th Pokémon page adds nothing); its other URLs wait. They are read
 * only when nothing unsettled is left and budget remains: a small site is read whole (site-d.example
 * has 7 pages, all matching /*; v1.4.0 read 4 of them with 16 pages of budget left), a big one runs
 * out of budget first. Pages are compared without the site's furniture headings (similarity.ts).
 * A pattern whose pages keep differing (/move, /type and /ability all match /*) is never settled.
 * A section that takes more than its cap of picks waits while another section has pages; when only over-cap sections still have
 * unsettled patterns, the menu's pages, then an under-cap section's settled patterns, go before them, so a section whose pages never
 * settle (keepersecurity.com's blog in twenty languages) cannot take the whole budget while the menu waits (G-759).
 *
 * Everything is deterministic: the same discoveries in the same order give the same picks.
 */
import { sameType, siteContext, type PageSample } from '../leaf/pages/similarity.js';
import { urlPattern } from '../leaf/pages/url.js';
import { H } from '../leaf/heuristics/grouping.js';

export interface FrontierItem {
  url: string;
  depth: number;
}

/** An address the crawl never picked, and what is known of its kind (Frontier.leftovers). */
export interface Leftover {
  url: string;
  /** Its pattern gave pages alike enough to stop sampling it. */
  settled: boolean;
  /** A page of its pattern was read. */
  sampled: boolean;
  /** It is in the site's menu (`inMenu`). */
  menu: boolean;
}

interface Pattern {
  key: string;
  /** Discovery order of the pattern itself. */
  order: number;
  queue: (FrontierItem & { seq: number })[];
  found: number;
  crawled: number;
  /** Picks made by spreading (menu pages are picked first and don't count). */
  spreadPicks: number;
  samples: PageSample[];
  matchStreak: number;
  settled: boolean;
}

/** A URL linked from at least this share of the pages read is in the site's menu. */
const MENU_SHARE = H.MENU_SHARE;
/** ...once at least this many pages have been read (on the start page alone, every link is 100%). */
const MENU_MIN_PAGES = H.MENU_MIN_PAGES;

/**
 * Whether an address linked from `linkedFrom` of the `pagesRead` pages read is in the site's menu: linked from at least MENU_SHARE of
 * them, once MENU_MIN_PAGES were read. The frontier's test as it crawls, and the summary's of a report (discovery.ts, G-741).
 */
function inMenu(linkedFrom: number, pagesRead: number): boolean {
  return pagesRead >= MENU_MIN_PAGES && linkedFrom / pagesRead >= MENU_SHARE;
}

/**
 * The section of the site a pattern belongs to: its first path segment when it has more than one
 * (/pokebase/rmt/tag/* -> pokebase), or "/" for the home page and top-level pages (/about).
 */
function sectionOf(patternKey: string): string {
  const segments = patternKey.split('?')[0].split('/').filter(Boolean);
  return segments.length > 1 ? segments[0] : '/';
}


/**
 * Which queued URL of a pattern to take for its n-th pick (0-based): the first, then the last,
 * then points spread evenly between (1/2, 1/4, 3/4, 1/8, ...) of the list as it is at that moment.
 */
function spreadIndex(pick: number, length: number): number {
  if (length <= 1 || pick === 0) return 0;
  if (pick === 1) return length - 1;
  // Van der Corput sequence in base 2: 1/2, 1/4, 3/4, 1/8, 5/8, 3/8, 7/8, ...
  let n = pick - 1;
  let fraction = 0;
  for (let bit = 0.5; n > 0; bit /= 2, n >>= 1) if (n & 1) fraction += bit; // not a heuristic: the sequence's own math
  return Math.min(length - 1, Math.floor(fraction * length));
}

export class Frontier {
  private readonly patterns = new Map<string, Pattern>();
  private readonly byUrl = new Map<string, Pattern>();
  private seq = 0;
  /** For each URL, the pages read that link to it. */
  private readonly linkedFrom = new Map<string, Set<string>>();
  private pagesRead = 0;
  /** Every page read so far, for telling the site's furniture headings apart. */
  private readonly allSamples: PageSample[] = [];

  private readonly sectionPicks = new Map<string, number>();

  /**
   * @param settleAfter  pages in a row like an earlier one before a pattern settles
   * @param sectionCap   most picks one section may take while other sections still have pages
   *                     waiting. On pokemondb.net the forum (/pokebase) has ten page types of its
   *                     own and took 31 of 60 pages without a cap.
   * @param menuFirst    a menu of at most this many pages (`menuSize`) is read before any other page; 0 never
   *                     (a crawl with no page limit, G-745 (5)).
   */
  constructor(
    private readonly settleAfter = 2,
    private readonly sectionCap = Infinity,
    private readonly menuFirst = 0,
  ) {}

  add(item: FrontierItem): void {
    const key = urlPattern(item.url);
    let p = this.patterns.get(key);
    if (!p) {
      p = { key, order: this.patterns.size, queue: [], found: 0, crawled: 0, spreadPicks: 0, samples: [], matchStreak: 0, settled: false };
      this.patterns.set(key, p);
    }
    p.queue.push({ ...item, seq: this.seq++ });
    p.found++;
    this.byUrl.set(item.url, p);
  }

  /** URLs still to crawl, settled patterns' included (they come last). */
  get size(): number {
    let n = 0;
    for (const p of this.patterns.values()) n += p.queue.length;
    return n;
  }

  // Decision: G-022, G-759
  next(): FrontierItem | undefined {
    // A small menu before anything else, so a page limit does not leave a footer menu unread (G-745 (5)); a big one (pokemondb.net's
    // 54) would spend the budget breadth-first, so it waits its turn as before, and the summary says what of it was left.
    if (this.menuFirst > 0 && this.menuSize <= this.menuFirst) {
      const menu = this.nextMenu();
      if (menu) return menu;
    }
    const waiting = [...this.patterns.values()].filter((p) => p.queue.length > 0);
    const unsettled = waiting.filter((p) => !p.settled);
    const underCap = (p: Pattern) => (this.sectionPicks.get(sectionOf(p.key)) ?? 0) < this.sectionCap;
    // Nothing new left to learn: spend what budget remains on more of the patterns already settled.
    let pool = unsettled.length > 0 ? unsettled.filter(underCap) : waiting.filter(underCap);
    if (pool.length === 0 && unsettled.length > 0) {
      // Every pattern still teaching something is in a section over its cap (a blog whose pages never settle, Keeper's /blog/<language>/):
      // a menu page goes first, then an under-cap section's settled pattern, and only then does the cap give way (G-759).
      const menu = this.nextMenu();
      if (menu) return menu;
      pool = waiting.filter(underCap);
    }
    if (pool.length === 0) pool = unsettled.length > 0 ? unsettled : waiting;
    let best: Pattern | undefined;
    let bestScore = -1;
    for (const p of pool) {
      const score = p.found / (p.crawled + 1);
      if (score > bestScore || (score === bestScore && p.found > best!.found)) {
        best = p;
        bestScore = score;
      }
    }
    if (!best) return undefined;
    // Menu pages first (e.g. /pokedex/all before any single Pokémon): every page links to them,
    // and a test suite must cover them. Then picks spread over the rest: last, middle, ...
    let index = best.queue.findIndex((q) => this.isMenu(q.url));
    if (index < 0) index = spreadIndex(++best.spreadPicks, best.queue.length);
    best.crawled++;
    const section = sectionOf(best.key);
    this.sectionPicks.set(section, (this.sectionPicks.get(section) ?? 0) + 1);
    const [{ url, depth }] = best.queue.splice(index, 1);
    return { url, depth };
  }

  /** True while a page of the site's menu waits in any pattern's queue, a settled one's included. */
  get menuWaiting(): boolean {
    return [...this.patterns.values()].some((p) => p.queue.some((q) => this.isMenu(q.url)));
  }

  /**
   * A page of the site's menu still waiting, taken from its pattern's queue; undefined when none waits. A crawl that stops
   * because pages stopped teaching it anything reads these first (TODO 132 box 7): a settled pattern's menu pages otherwise
   * wait behind a pattern that never settles (irthsolutions.com, 2026-11-08: 8 header-menu pages unread behind blog posts).
   */
  // Decision: G-674
  nextMenu(): FrontierItem | undefined {
    for (const p of this.patterns.values()) {
      const index = p.queue.findIndex((q) => this.isMenu(q.url));
      if (index < 0) continue;
      p.crawled++;
      const section = sectionOf(p.key);
      this.sectionPicks.set(section, (this.sectionPicks.get(section) ?? 0) + 1);
      const [{ url, depth }] = p.queue.splice(index, 1);
      return { url, depth };
    }
    return undefined;
  }

  /** How many addresses of the site's menu the crawl has read or queued (one it refused is not counted: it would never read it). */
  get menuSize(): number {
    let n = 0;
    for (const [url, from] of this.linkedFrom) if (this.byUrl.has(url) && inMenu(from.size, this.pagesRead)) n++;
    return n;
  }

  /** True when the URL is linked from most pages read so far: it is in the site's menu. */
  isMenu(url: string): boolean {
    return inMenu(this.linkedFrom.get(url)?.size ?? 0, this.pagesRead);
  }

  /** Report the links on a page that was read (same-site targets, normalized). */
  recordLinks(from: string, to: Iterable<string>): void {
    this.pagesRead++;
    for (const t of to) {
      let set = this.linkedFrom.get(t);
      if (!set) this.linkedFrom.set(t, (set = new Set()));
      set.add(from);
    }
  }

  /**
   * Report a page that was read, under the URL it was picked as. The pattern settles after
   * `settleAfter` pages in a row that are like a page it already gave (see similarity.ts).
   */
  recordSample(pickedUrl: string, sample: PageSample): void {
    const p = this.byUrl.get(pickedUrl);
    if (!p) return;
    this.allSamples.push(sample);
    const site = siteContext(this.allSamples, this.allSamples[0].url);
    const matches = p.samples.some((s) => sameType(s, sample, site));
    p.samples.push(sample);
    if (!matches) p.matchStreak = 0;
    else if (++p.matchStreak >= this.settleAfter) p.settled = true;
  }

  /**
   * URLs never picked, in the order they were found: whether their pattern was settled, whether a page of their pattern was read
   * (`sampled`), and whether they are in the site's menu, so each is said unread for its true reason (G-741).
   */
  leftovers(): Leftover[] {
    const all: (Leftover & { seq: number })[] = [];
    for (const p of this.patterns.values()) {
      for (const q of p.queue) all.push({ url: q.url, settled: p.settled, sampled: p.samples.length > 0, menu: this.isMenu(q.url), seq: q.seq });
    }
    return all.sort((a, b) => a.seq - b.seq).map(({ seq: _, ...left }) => left);
  }
}
