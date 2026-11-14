/**
 * Which fields read differently on two visits (a token, a time of day) and so are marked `changes` (G-322). The crawl records;
 * the model decides what that means. Which value a field held is kept in the page (CONTROLS_SCRIPT, the parent's bundle).
 */
import type { PageControl } from '../leaf/report.js';

/** The same control on a page read twice: the same kind at the same locator, neither inside a shadow root (which another locator finds). */
const sameControl = (a: PageControl, b: PageControl) => !a.shadow && !b.shadow && a.kind === b.kind && a.xpath === b.xpath;

/**
 * Marks, in `first` (the crawl's own reading), each control that held another value in `again` (a second reading of the
 * same page). A control the second reading did not find is left alone: nothing is known of it.
 */
// Decision: G-322
export function markChangingValues(first: PageControl[], again: PageControl[]): void {
  for (const c of first) {
    const other = again.find((a) => sameControl(a, c));
    if (other && other.value !== c.value) c.changes = true;
  }
}
