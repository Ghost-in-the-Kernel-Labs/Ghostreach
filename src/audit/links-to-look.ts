/**
 * Links that need a look (item 71, G-351 amended): every link of the site that answered an error or did not answer at
 * all is put before a person, first in the audit, the preview, the build's output and KNOWN-ISSUES.md, whatever finding
 * it is in (SITE-02 broken, SITE-34 on purpose, SITE-33 another site's, SITE-01). One function builds the list
 * (`linksToLookAt`); every place reads it. The list counts for nothing: the findings' counts are as they were.
 */
import type { SiteFinding } from '../findings/types.js';

/** The title of the section, in every place that has one. */
export const LOOK_TITLE = 'Links that need a look';

/** What the section says of itself, in every place: why it is there. */
export const LOOK_INTRO = 'Each of these links answered an error or did not answer. A person is to look at every one, whatever the site means by it: nothing here is cleared by a rule.';

/** One link a person is to look at. */
export interface LinkToLook {
  /** Its address: the path of the site's own, the whole of another site's. */
  address: string;
  /** The findings it is in: SITE-02, SITE-34, ... */
  codes: string[];
  /** What it answered, in words. */
  answer: string;
  /** The first pages linking to it, and how many more do. */
  from: string[];
  more: number;
  /** Why it is here: "broken", or the reason it answers an error on purpose. */
  why: string;
}

/** The links to put before a person, from a crawl's findings: each link once, in the findings' order. */
// Decision: G-351
export function linksToLookAt(findings: SiteFinding[] = []): LinkToLook[] {
  const out = new Map<string, LinkToLook>();
  for (const f of findings) {
    for (const w of f.where) {
      const l = w.link;
      if (!l) continue;
      const known = out.get(w.url);
      if (known) {
        known.codes.push(f.code);
        continue;
      }
      out.set(w.url, { address: l.paths[0] ?? w.url, codes: [f.code], answer: l.answer, from: l.from, more: l.more, why: l.why });
    }
  }
  return [...out.values()];
}

/** Where a link is linked from, in words. */
export function lookFrom(l: Pick<LinkToLook, 'from' | 'more'>): string {
  if (!l.from.length) return 'no page the crawl read links to it';
  return `linked from ${l.from.join(', ')}${l.more ? ` and ${l.more} more` : ''}`;
}
