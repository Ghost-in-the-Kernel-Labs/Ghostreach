/**
 * A page's main headings as the audit counts them (G-666, G-742 (1)): an h1 with no words is no heading to a reader, and two
 * with the same words are one (a responsive or animated copy says the same subject twice). The finding (SITE-15,
 * src/group/markup-findings.ts) counts them so, and an audit test re-counts them so in the page (READER_SCRIPT, G-749 slice 4).
 * In the page: BUNDLED into READER_SCRIPT (scripts/controls-script.mjs), so it may import other in-page code and be split into files.
 */

/** The h1s with words, each once by its words (the first kept). */
export function wordedHeadings(h1: readonly string[]): string[] {
  const once = new Map<string, string>();
  for (const h of h1) {
    const words = h.trim().replace(/\s+/g, ' ').toLowerCase();
    if (words && !once.has(words)) once.set(words, h);
  }
  return [...once.values()];
}
