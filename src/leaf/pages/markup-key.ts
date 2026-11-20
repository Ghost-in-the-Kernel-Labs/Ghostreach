/**
 * A markup sample as an audit item names it (G-749 slice 4): the words the crawler said (`<img src="/a.9f3c1b2e.jpg">`), with what
 * a deploy changes and the element does not masked: a query (a cache-buster, a CDN's sizes) and a run of 8 hex characters or more
 * (a file's hash). The item's key is this, so a rebuild after a deploy names the same element alike; and the audit test matches the
 * page's samples by it, so a renamed file is not read as fixed. Masking can only make two elements one, an item then read open
 * while either shows: never a false FIXED. Used by the grouping (src/group/markup-items.ts) and in the page.
 * In the page: BUNDLED into READER_SCRIPT (scripts/controls-script.mjs), so it may import other in-page code and be split into files.
 */

/** The sample with its query and its hash runs masked. */
export function markupKey(said: string): string {
  return said.replace(/\?[^"]*/g, '?*').replace(/(?<![g-z])[0-9a-f]{8,}(?![g-z])/gi, '*');
}
