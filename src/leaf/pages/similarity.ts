/**
 * Are two crawled pages the same kind of page (template)?
 *
 * Measured on pokemondb.net (live crawls, 2026-09-27), neither signal decides alone:
 *
 *   - Shape. Full element paths are thrown off by wrappers: a Pokémon with alternate forms
 *     (Golem, Marowak) puts each form in a tab, so every path gains a prefix (0.24 against other
 *     Pokémon). Cutting paths to their last three steps (table/tbody/tr) fixes that. But section
 *     pages that share a layout look alike either way: /move vs /item 0.89.
 *   - Headings (h1-h6, th, label, ...), with the page's own name masked, so "Moves learned by
 *     Bagon" equals "Moves learned by Pecharunt". They tell section pages apart (at most 0.06),
 *     but vary on some templates: location pages share only about 0.2, since most name places.
 *
 *   - Pages of one template can differ a lot in how much they hold: an old move (Surf) has 44
 *     headings, one year's history per game; a new one (Temper Flare) has 15. Jaccard divides by
 *     both together, so the gap alone pulls the score down (0.31). Nearly all of the smaller
 *     page's headings are on the bigger one, though: that is the overlap, measured against the
 *     smaller set, and only when it has at least 4 headings (a near-empty page would overlap
 *     with everything) and both pages share a URL pattern. Across patterns, a subset of headings
 *     means a part of the page, not a sibling: /pokedex/houndour/moves/9 holds the move tables
 *     of /pokedex/houndour.
 *
 *   - Headings alone can mislead when two different pages share a block of table headers: the
 *     type chart (/type) and a type page (/type/grass) both list the 18 type abbreviations (Nor,
 *     Fir, Wat, ...), headings 0.52, while their shapes agree only 0.35. So the two headings
 *     tests also need some shape agreement (>= 0.4).
 *
 * The rule: the same type when the shapes agree somewhat (>= 0.4) and either the headings mostly
 * agree (Jaccard >= 0.5) or the smaller page's headings are nearly all on the other (overlap
 * >= 0.8, same URL pattern); or when the shapes agree (>= 0.7) and at least some headings are
 * shared (>= 0.15). On three 60-page crawls of pokemondb.net: no section pages and no pages of
 * different types matched, and 2 of 166 same-type pairs were missed (a shape floor of 0.45
 * would miss 7).
 */
import type { Fingerprint } from './fingerprint.js';
import { addressPath, nameSegment, remembered, urlPattern, withoutRole } from './url.js';
import { H } from '../heuristics/similarity.js';

export interface PageSample {
  /** The page's final URL; its last path segment is taken as the page's name. */
  url: string;
  fingerprint: Fingerprint;
  headings?: string[];
  /** Its headings that are a field's own words, its form's labels ("Name", "Password"): typedPages, G-246. */
  formLabels?: string[];
}

function jaccard<T>(a: Iterable<T>, b: Iterable<T>): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let shared = 0;
  for (const x of setA) if (setB.has(x)) shared++;
  const union = setA.size + setB.size - shared;
  return union === 0 ? 1 : shared / union;
}

/** Element paths cut to their last `steps` steps, each once. */
export function pathSuffixes(paths: string[], steps = 3): Set<string> {
  return new Set(paths.map((p) => p.split('/').slice(-steps).join('/')));
}

/**
 * A page's path suffixes and masked headings, worked out once per page: likeness() compares every
 * pair, so a grouping of 300 pages asked for them 90,000 times (4 s of the bench's run). A page's
 * sample is never changed once read, so what was worked out stays true.
 */
const suffixCache = new WeakMap<PageSample, Set<string>>();
const headingCache = new WeakMap<PageSample, Set<string>>();
function suffixesOf(sample: PageSample): Set<string> {
  const known = suffixCache.get(sample);
  if (known) return known;
  const suffixes = pathSuffixes(sample.fingerprint.paths);
  suffixCache.set(sample, suffixes);
  return suffixes;
}
function headingsOf(sample: PageSample): Set<string> {
  const known = headingCache.get(sample);
  if (known) return known;
  const headings = maskedHeadings(sample);
  headingCache.set(sample, headings);
  return headings;
}

/** The page's slug (its name segment, nameSegment), decoded and lower-cased. */
function slugOf(url: string): string {
  const last = nameSegment(url);
  try {
    return decodeURIComponent(last).toLowerCase();
  } catch {
    return last.toLowerCase();
  }
}

/** Words of the URL's name segment that can name the page (3+ letters). */
export function slugWords(url: string): string[] {
  return slugOf(url)
    .split(/[-+_. ]+/)
    .filter((w) => w.length >= 3 && !FUNCTION_WORDS.has(w));
}

/** Words in many slugs and many headings that name nothing: "the" in the-quiet-cost-of-legacy-code. */
const FUNCTION_WORDS = new Set(
  'the and for with from your our you are how why what who when was not but all can has its into over about'.split(' '),
);

/**
 * Headings lower-cased, with the page's own name replaced by {name}: the slug as the address spells it, when it
 * is more than one word ("Viewing tag: the-hunger-games" is "viewing tag: {name}", as "Viewing tag: love" is), then
 * each of its words that can name the page. A name's words apart ("New Tab") stay "{name} {name}": made "{name}",
 * practice.expandtesting.com's two-word exercises matched its one-word ones on their banner heading ("{name}
 * page for Automation Testing Practice"), 7 more pairs wrongly merged (2026-10-16).
 */
export function maskedHeadings(sample: PageSample): Set<string> {
  const slug = slugOf(sample.url);
  const words = slugWords(sample.url);
  const spellings = /[-+_. ]/.test(slug) ? [slug, ...words] : words;
  return new Set(
    (sample.headings ?? []).map((h) => {
      let text = h.toLowerCase();
      for (const s of spellings) text = text.split(s).join('{name}');
      return text;
    }),
  );
}

export interface Likeness {
  /** Jaccard similarity of element paths cut to their last three steps. */
  shape: number;
  /** Jaccard similarity of masked headings; null when either page has none. */
  headings: number | null;
  /**
   * Share of the smaller page's masked headings found on the other page; null when either page
   * has fewer than 4 headings.
   */
  overlap: number | null;
}

export function likeness(a: PageSample, b: PageSample): Likeness {
  const shape = jaccard(suffixesOf(a), suffixesOf(b));
  const ha = headingsOf(a);
  const hb = headingsOf(b);
  if (ha.size === 0 || hb.size === 0) return { shape, headings: null, overlap: null };
  let shared = 0;
  for (const h of ha) if (hb.has(h)) shared++;
  const smaller = Math.min(ha.size, hb.size);
  return {
    shape,
    headings: shared / (ha.size + hb.size - shared),
    overlap: smaller >= MIN_HEADINGS_FOR_OVERLAP ? shared / smaller : null,
  };
}

const HEADINGS_AGREE = H.HEADINGS_AGREE;
const HEADINGS_CONTAINED = H.HEADINGS_CONTAINED;
const MIN_HEADINGS_FOR_OVERLAP = H.MIN_HEADINGS_FOR_OVERLAP;
export const SHAPES_AGREE = H.SHAPES_AGREE;
const SOME_HEADINGS_SHARED = H.SOME_HEADINGS_SHARED;
const SOME_SHAPE_SHARED = H.SOME_SHAPE_SHARED;

/** The URL pattern of an address, or of its folder when it ends in a file name (a segment with an extension). */
const folderPattern = remembered((url: string): string => {
  const u = new URL(url);
  const segments = u.pathname.split('/').filter(Boolean);
  if (segments.length >= 2 && /\.[a-z0-9]{2,5}$/i.test(segments[segments.length - 1])) {
    return urlPattern(`${u.origin}/${segments.slice(0, -1).join('/')}`);
  }
  return urlPattern(url);
});

/**
 * How many fixed segments a pattern has: /catalogue/category/books/(any)/index.html has four, /* none. A role's
 * mark is none (/*#as=user is top level too): counted, signed-in top-level pages joined by containment, the
 * contact form inside the about page (found by the mutation run, 2026-10-16).
 */
function fixedDepth(pattern: string): number {
  return withoutRole(pattern).split('?')[0].split('/').filter((x) => x && x !== '*' && x !== '{n}').length;
}

/**
 * The rules that make two pages one kind of page, by name: each is a branch of the one decision
 * (joinOf), so an explanation names the rule that decided, not one reconstructed after it.
 */
type JoinRule =
  /** On a site of one layout: the same address pattern, below the top level (/post/*). */
  | 'address-below-top'
  /** On a site of one layout: the pages' own headings agree (or one's are nearly all on the other). */
  | 'own-headings'
  /** Neither page has headings, and their layouts agree. */
  | 'layout-no-headings'
  /** A listing: nearly the same layout, in one folder pattern below the top level (books' categories). */
  | 'listing-folder'
  /** The headings agree (or one's are nearly all on the other, same pattern), with some layout shared. */
  | 'headings-agree'
  /** The layouts agree, with some headings shared. */
  | 'layout-and-some-headings';

/** Two pages judged one kind of page: by which rule, and how alike they were (null: not measured). */
interface Join {
  rule: JoinRule;
  shape: number | null;
  headings: number | null;
}

export function sameType(a: PageSample, b: PageSample, site?: SiteContext): boolean {
  return joinOf(a, b, site) !== null;
}

/** Whether two pages are one kind of page, and if so the rule that says so; null when none does. */
// Decision: G-032
export function joinOf(a: PageSample, b: PageSample, site?: SiteContext): Join | null {
  if (site?.uniformShapes) {
    // Shape says nothing here (see siteContext): a URL family below the top level, or the page's own headings.
    const pattern = urlPattern(a.url);
    if (pattern === urlPattern(b.url) && addressPath(a.url).split('/').filter(Boolean).length >= 2) {
      return { rule: 'address-below-top', shape: null, headings: null };
    }
    // A heading that is only the page's own name ("Careers" on /careers) says nothing either: every
    // page has one, and masked they are all "{name}".
    const ownHeadings = (s: PageSample) => new Set([...maskedHeadings(withoutFurniture(s, site.furniture))].filter((h) => h.replace(/\{name\}|[^a-z0-9]+/g, '') !== ''));
    const ha = ownHeadings(a);
    const hb = ownHeadings(b);
    if (ha.size > 0 && hb.size > 0) {
      let shared = 0;
      for (const h of ha) if (hb.has(h)) shared++;
      const agree = shared / (ha.size + hb.size - shared);
      // No containment here: it holds only under one pattern below the top level, and those pages joined above.
      if (agree >= HEADINGS_AGREE) return { rule: 'own-headings', shape: null, headings: agree };
    }
    // The listing rule still holds (below): a site mostly of one kind of page reads as of one layout, and its other
    // pages lose every rule of shape with it; a category's page 2 and the other categories, under one folder pattern
    // and nearly alike, are one listing all the same (G-277, chosen by an experiment, docs/experiments/2026-10-22-one-layout-round-2.md).
    return listingFolder(a, b);
  }
  const { shape, headings, overlap } = likeness(a, b);
  if (headings === null) return shape >= SHAPES_AGREE ? { rule: 'layout-no-headings', shape, headings } : null; // e.g. a page with no headings at all
  // One page's headings nearly all on the other's says one type only under a pattern below the top
  // level (/pokedex/*): every top-level page is /*, and a short page made mostly of a section the site
  // repeats (a contact form) is contained in every page that carries it (Site I, 2026-10-03: /contact
  // joined /about and /psp into one family through its form).
  const pattern = urlPattern(a.url);
  const headingsMatch =
    headings >= HEADINGS_AGREE ||
    (overlap !== null && overlap >= HEADINGS_CONTAINED && pattern === urlPattern(b.url) && fixedDepth(pattern) >= 1);
  if (headingsMatch && shape >= SOME_SHAPE_SHARED) return { rule: 'headings-agree', shape, headings };
  if (shape >= SHAPES_AGREE && headings >= SOME_HEADINGS_SHARED) return { rule: 'layout-and-some-headings', shape, headings };
  // Last, so it is named only where it decided: a listing's headings are its items (twenty book
  // titles), different on every page. Pages under one URL pattern below the top level, built nearly
  // alike, are one type whatever their headings (books.toscrape.com's 50 categories, 2026-09-30: 74
  // page types for a site of four). An address ending in a file name (index.html, page-2.html) is
  // compared by its folder: page 2 of a category is a page of the category listing.
  return listingFolder(a, b, { shape, headings });
}

/**
 * The listing rule: two pages under one folder pattern below the top level, built nearly alike, are one listing
 * whatever their headings; null when not. Measured here when the caller has not measured them.
 */
// Decision: G-277
function listingFolder(a: PageSample, b: PageSample, measured?: { shape: number; headings: number | null }): Join | null {
  const { shape, headings } = measured ?? { shape: likeness(a, b).shape, headings: null };
  const folder = folderPattern(a.url);
  return shape >= H.LISTING_SHAPE_AGREE && folder === folderPattern(b.url) && fixedDepth(folder) >= 1 ? { rule: 'listing-folder', shape, headings } : null;
}

/**
 * What the site as a whole says about comparing its pages.
 *
 * Found on site-d.example (2026-09-27), a Wix site: Wix renders every page into the same element
 * structure, so all its pages have the same shape and shape tells nothing apart. Careers, About Us
 * and the GSA page then matched on headings alone, and the only headings they shared were the
 * site's own, on every page (its name, its slogan, "Contact Us"): they were grouped as one family,
 * and the crawler stopped reading "more of the same" after three.
 *
 * (Its content sits deeper than the fingerprint reaches, so the shapes are the builder's.)
 *
 * So when the shapes are uniform (at least 80% of the pages after the start page are shaped like the one most
 * like the rest of them, likeness >= 0.8; the start page judges nothing, G-247), headings on at least 80% of them
 * are the site's furniture and don't count; and pages under one URL pattern below the top level
 * (/post/*) are one family even with nothing else in common, as a blog on such a site would be.
 * Top-level pages (/careers, /about-us) are where a small site keeps its different pages.
 *
 * Only then: on sites whose page types differ in shape (site-b.example, pokemondb.net), families lean on
 * shared furniture headings too, and leaving them out split site-b.example's 12 page types into 27.
 * Measured, pages shaped like the start page (>= 0.8): site-d.example 4 of 4; site-b.example 3%,
 * pokemondb.net 2%, the made-up test sites 6-10% (before G-247, by the start page).
 * Needs 3 pages read, two of them after the start.
 */
export interface SiteContext {
  /** Every page has (nearly) the same element shapes. */
  uniformShapes: boolean;
  /** Lower-cased headings on (nearly) every page; empty unless the shapes are uniform. */
  furniture: Set<string>;
}

// Decision: G-247
export function siteContext(samples: PageSample[], startUrl: string): SiteContext {
  const none: SiteContext = { uniformShapes: false, furniture: new Set() };
  // The start page is no judge of the site's layout (G-247): a home page is often of a shape of its own. The pages
  // after it judge, by the one most like the rest of them, whatever order they were read in.
  const after = samples.filter((s) => s.url !== startUrl).map((s) => ({ s, shape: pathSuffixes(s.fingerprint.paths) }));
  // Three read leave two after the start at least (each page read is at its own address).
  if (samples.length < 3) return none;
  const likeRest = (x: (typeof after)[number]) => after.reduce((n, o) => n + (o === x ? 0 : jaccard(x.shape, o.shape)), 0);
  const ranked = after.map((x) => ({ x, like: likeRest(x) }));
  const judge = ranked.reduce((best, r) => (r.like > best.like || (r.like === best.like && r.x.s.url < best.x.s.url) ? r : best)).x;
  const alike = after.filter((x) => jaccard(judge.shape, x.shape) >= UNIFORM_SHAPE).length;
  if (alike / after.length < UNIFORM_SHARE) return none;
  const pagesWith = new Map<string, number>();
  for (const { s } of after) for (const h of new Set((s.headings ?? []).map((x) => x.toLowerCase()))) pagesWith.set(h, (pagesWith.get(h) ?? 0) + 1);
  const furniture = new Set<string>();
  for (const h of judge.s.headings ?? []) {
    const key = h.toLowerCase();
    if ((pagesWith.get(key) ?? 0) / after.length >= UNIFORM_SHARE) furniture.add(key);
  }
  return { uniformShapes: true, furniture };
}

const UNIFORM_SHAPE = H.UNIFORM_SHAPE;
const UNIFORM_SHARE = H.UNIFORM_SHARE;

function withoutFurniture(sample: PageSample, furniture: ReadonlySet<string> | undefined): PageSample {
  if (!furniture?.size || !sample.headings) return sample;
  return { ...sample, headings: sample.headings.filter((h) => !furniture.has(h.toLowerCase())) };
}
