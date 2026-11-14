/**
 * The grouping's output, templates.json: page types, the site menu, links between types, broken
 * links and controls. Plain data, versioned by TEMPLATES_VERSION (group.ts).
 */
import type { CheckCode } from './check-catalogue.js';
import type { ItemEvidence } from './item-evidence.js';

/** Something wrong with the site itself, found in the crawl (src/group/findings.ts, G-132). */
export interface SiteFinding {
  /** Stable across builds: SITE-01 ... A rule's code is one the catalogue of checks holds (check-catalogue.ts), so a rule without an entry does not compile. */
  code: CheckCode;
  /** major: a visitor or a search engine is let down now; minor: worth fixing; info: worth knowing. */
  severity: 'major' | 'minor' | 'info';
  /** One line, the count first: "10 pages show real content but answer 404: ...". */
  title: string;
  /** Each page that shows it, and what the crawl saw there. */
  where: { url: string; says: string; link?: LinkLook; offSite?: true; item?: ItemEvidence }[];
  /* offSite: the address is on another site (its host is not the crawled site's): a writer shows its scheme and host, not only its path (Ghost, 2026-11-05, G-455). */
  /** Why it matters to the site's owner, and the likely fix. */
  why: string;
  fix: string;
  /** What the crawler could not confirm (an automated visitor turned away is not the site at fault): never in the short audit's top (G-655). */
  unconfirmed?: true;
  /** What each line of `where` is, one and many, when it is not a page: a finding listed by component says "2 form fields" (G-664). */
  listed?: [string, string];
  /** When the lines name fewer than the title counts (a page's sample kept its first few): which pages showed more, said after the list (G-698). */
  unlisted?: string;
  /** When a page saw one again (SITE-21's messages, counted once each): which pages repeated them, said after the list (G-743 (1)). */
  repeated?: string;
}

/**
 * A finding's page that is a link answering an error or not answering (item 71): what src/model/links-to-look.ts reads
 * to put it before a person, whatever the finding. SITE-02, SITE-34, SITE-33 and SITE-01 carry it.
 */
export interface LinkLook {
  /** The addresses the site's own link goes by (path and query), what a team's `expected-links` block lists; none for another site's. */
  paths: string[];
  /** The status it answered, null when it gave no answer. */
  status: number | null;
  /** What it answered, in words: "answered 404", "its name no longer resolves: the site is gone". */
  answer: string;
  /** The first pages that link to it (at most five), and how many more do. */
  from: string[];
  more: number;
  /** "broken", or why the link answers an error on purpose. */
  why: string;
  /** A navigation menu carries a link to it (G-658): such a break leads the audit (G-668). */
  inMenu?: true;
}
