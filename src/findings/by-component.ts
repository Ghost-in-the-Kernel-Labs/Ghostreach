/**
 * A finding of a component, said once however many pages show it (G-664, TODO 132 box 3). A crawl's samples name what was seen
 * (`<input name="email">`, an error's message, a request's address); the same name on many pages is one component, most often the
 * site's furniture: a footer field, a template's script. On irthsolutions.com (2026-11-08) one footer field was counted 81 times
 * and one script error 45 times, and each led the audit as a major finding for that count.
 *
 * A finding then lists one line per component, at the first page it was seen on, with how many pages show it ("on every page" when
 * every page read does); its weight in the audit's order is the number of components, and its headline counts the lines it lists
 * (G-737, slice 5): a page's sample keeps only its first few different ones (`first`), so a page whose sample is full may hold more,
 * said apart as "up to N more", and one that showed one again is said apart too, never as a larger count over fewer lines.
 */
import type { CrawledPage, Sample } from '../leaf/report.js';
import { H } from '../leaf/heuristics/suite.js';
import type { ItemEvidence } from './item-evidence.js';
import type { SiteFinding } from './types.js';

/** One component a finding names: as said, and the pages that show it, in crawl order. */
interface Component {
  said: string;
  /** As the crawler said it, the first time: what an audit item re-checks (G-749). */
  raw: string;
  urls: string[];
}

/** A page that saw more than its sample keeps: how many it saw, and how many its sample names. */
interface Cut {
  url: string;
  saw: number;
  named: number;
}

/**
 * How a finding says what a page's sample holds. A sample's `count` is every one seen, repeats too, and its `first` the first
 * few different ones (`H.MARKUP_SAMPLE`). Each different one is counted once either way: a page is cut only when its sample is
 * full, and one alike again is said apart (G-742 (3), G-737 slice 5). By default the things are elements (a field, a link: "up to
 * 6 more", "/ has 3 like the one listed"); `distinct` says them as messages a page throws (G-743 (1)).
 */
export interface Counting {
  distinct: { verb: string; noun: [string, string] };
}

/** The components the pages' samples name, the most pages first; `cuts`, the pages that saw more than their sample keeps; `repeats`, the pages that saw one again (distinct only). */
function componentsOf(pages: CrawledPage[], sampleOf: (p: CrawledPage) => Sample | undefined, say: (x: string) => string): { components: Component[]; cuts: Cut[]; repeats: Cut[]; read: string[] } {
  const byName = new Map<string, Component>();
  const cuts: Cut[] = [];
  const repeats: Cut[] = [];
  // A page of the same content as one read (`sameContentAs`) is that page at another address: counted as it (G-673).
  const read = new Set(pages.map((p) => p.finalUrl));
  const at = (p: CrawledPage) => (p.sameContentAs && read.has(p.sameContentAs) ? p.sameContentAs : p.finalUrl);
  for (const p of pages) {
    const s = sampleOf(p);
    if (!s) continue;
    const url = at(p);
    // A sample of fewer than it keeps names every different one, so its count over them is ones alike again (G-743 (1), slice 5).
    const full = s.first.length >= H.MARKUP_SAMPLE;
    if (s.count > s.first.length) (full ? cuts : repeats).push({ url, saw: s.count, named: s.first.length });
    // Keyed as said: two samples a reader cannot tell apart ("undefined" and "", both "an error with no message") are one.
    for (const raw of s.first) {
      const said = say(raw);
      const c = byName.get(said) ?? { said, raw, urls: [] };
      if (!c.urls.includes(url)) c.urls.push(url);
      byName.set(said, c);
    }
  }
  return { components: [...byName.values()].sort((a, b) => b.urls.length - a.urls.length), cuts, repeats, read: [...new Set(pages.map(at))] };
}

/** How many pages a list names before "and N more". */
const PATHS_SHOWN = 3; // not a heuristic: a line's length, read by a person

/**
 * "on 54 pages: /, /about, /blog and 51 more"; nothing for one page, which the line's own link names. A component on every page
 * read (a footer's link) is said "on every page", and one on all but a few "on every page but /contact" (G-737 slice 5: rtafleet's
 * footer links were said as 82 pages each, three of them named).
 */
function onWhich(urls: string[], read: string[]): string {
  if (urls.length < 2) return '';
  const paths = (us: string[]) => us.slice(0, PATHS_SHOWN).map((u) => new URL(u).pathname).join(', ');
  const missing = read.filter((u) => !urls.includes(u));
  if (!missing.length) return ', on every page';
  if (missing.length <= PATHS_SHOWN && urls.length > PATHS_SHOWN) return `, on every page but ${paths(missing)}`;
  const more = urls.length > PATHS_SHOWN ? ` and ${urls.length - PATHS_SHOWN} more` : '';
  return `, on ${urls.length} pages: ${paths(urls)}${more}`;
}

/** An audit item of a component (G-749 slice 4): from its sample as the crawler said it and the pages that show it; none when no test can re-check it. */
export type ComponentItem = (raw: string, urls: string[]) => ItemEvidence | undefined;

/** A finding's lines: one per component, at the first page that shows it, each with its item when the finding makes one. */
function componentWhere(components: Component[], read: string[], item?: ComponentItem): SiteFinding['where'] {
  return components.map((c) => {
    const evidence = item?.(c.raw, c.urls);
    return { url: c.urls[0], says: `${c.said}${onWhich(c.urls, read)}`, ...(evidence ? { item: evidence } : {}) };
  });
}

/**
 * What the list leaves out, when a page saw more than it names (G-698): the title's "at least 17" over seven lines read as a
 * counting bug on thehatchgrp.com (2026-11-10). Each page that saw more, the most first, with how many it saw and how many are listed.
 */
function unlistedOf(cuts: Cut[], counting?: Counting): string | undefined {
  if (!cuts.length) return undefined;
  const most = [...cuts].sort((a, b) => b.saw - a.saw);
  const more = morePages(most.length);
  if (counting) {
    const said = most.slice(0, PATHS_SHOWN).map((c) => `${new URL(c.url).pathname} ${counting.distinct.verb} ${c.saw} in all`);
    return `Not every one may be listed: the crawl notes the first ${H.MARKUP_SAMPLE} different ones on each page (${said.join('; ')}${more}).`;
  }
  // Each cut page may hold as many different ones past its sample as it saw past it: their sum is the most left out (slice 5).
  const upTo = cuts.reduce((sum, c) => sum + c.saw - c.named, 0);
  const said = most.slice(0, PATHS_SHOWN).map((c) => `${new URL(c.url).pathname} showed ${c.saw}, ${c.named} listed`);
  return `Up to ${upTo} more may not be listed: the crawl notes the first ${H.MARKUP_SAMPLE} different ones on each page (${said.join('; ')}${more}).`;
}

const morePages = (n: number) => (n > PATHS_SHOWN ? `; and ${n - PATHS_SHOWN} more ${n - PATHS_SHOWN === 1 ? 'page' : 'pages'}` : '');

/**
 * The repeats, said apart from the count (G-742 (3)): quavo.com's "at least 216 errors" was one message thrown 216 times on one
 * page (2026-11-11). Each page that saw one again, the most first, with how many times in all.
 */
function repeatedOf(repeats: Cut[], counting?: Counting): string | undefined {
  if (!repeats.length) return undefined;
  const most = [...repeats].sort((a, b) => b.saw - a.saw);
  if (!counting) {
    // Elements alike (three nameless `<input type="text">`): each is a thing a visitor meets, said beside the line it is like.
    const said = most.slice(0, PATHS_SHOWN).map((c) => `${new URL(c.url).pathname} has ${c.saw} like ${c.named === 1 ? 'the one' : `its ${c.named}`} listed`);
    return `Each line stands for every one alike on a page: ${said.join('; ')}${morePages(most.length)}.`;
  }
  const [one, many] = counting.distinct.noun;
  const said = most.slice(0, PATHS_SHOWN).map((c) => `${new URL(c.url).pathname} repeated ${c.named === 1 ? `it ${c.saw} times` : `its ${c.named} ${many} ${c.saw} times in all`}`);
  return `Each ${one} is counted once above, however often a page ${counting.distinct.verb} it: ${said.join('; ')}${morePages(most.length)}.`;
}

/** The pages that show any of them. */
const pagesShowing = (components: Component[]) => new Set(components.flatMap((c) => c.urls)).size;

/** A finding's title from its count of components ("3 form fields", "at least 6 links and buttons"), the number, and the pages. */
export type ComponentTitle = (count: string, n: number, onPages: number) => string;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One finding of a sample kind, when any page has it: one line per component, said once however many pages show it. */
// Decision: G-664, G-698, G-743, G-737
export function componentFinding(
  pages: CrawledPage[],
  sampleOf: (p: CrawledPage) => Sample | undefined,
  say: (x: string) => string,
  noun: [string, string?],
  f: Omit<SiteFinding, 'where' | 'title' | 'listed'> & { title: ComponentTitle },
  counting?: Counting,
  item?: ComponentItem,
): SiteFinding[] {
  const { components, cuts, repeats, read } = componentsOf(pages, sampleOf, say);
  if (!components.length) return [];
  const listed: [string, string] = [noun[0], noun[1] ?? `${noun[0]}s`];
  // The headline counts the lines (G-737 slice 5): harriscomputer.com's "at least 11" over 6 lines was the most one page saw. A page
  // whose sample is full may hold more: "at least", and how many more at most is said apart (`unlisted`).
  const n = components.length;
  const count = `${cuts.length ? 'at least ' : ''}${plural(n, ...listed)}`;
  const title = f.title(count, n, pagesShowing(components));
  // A title is a heading: "At least 7 links ...", never a lower-case start.
  const unlisted = unlistedOf(cuts, counting);
  const repeated = repeatedOf(repeats, counting);
  return [{ code: f.code, severity: f.severity, title: title.charAt(0).toUpperCase() + title.slice(1), where: componentWhere(components, read, item), listed, ...(unlisted ? { unlisted } : {}), ...(repeated ? { repeated } : {}), why: f.why, fix: f.fix }];
}
