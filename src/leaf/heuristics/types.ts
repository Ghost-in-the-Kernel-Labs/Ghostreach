/**
 * What a threshold is, and how a layer's values are read from its entries. The six layers
 * (crawl, similarity, grouping, suite, in-page, java-suite) each hold their own entries and export their own `H`;
 * catalog.ts joins them for HEURISTICS.md. Ghost, 2026-09-28: one catalog, for documentation.
 *
 * Three kinds, by where the value is used:
 *   - tool:     the crawler, grouping and generator, in Node: they import it from their layer's H.
 *   - page:     code that runs inside the browser (page.evaluate), which can't import anything:
 *               the value is written there, and `literal` pins it (the test finds it in `where`).
 *   - suite:    the generated Java: the generator writes the value into the suite.
 */

export interface Heuristic {
  value: number;
  unit: string;
  kind: 'tool' | 'page' | 'suite';
  /** The test that fails if it stops working. */
  pinnedBy: string;
  /** The file that uses it. */
  where: string;
  /** For page values: the code as written in `where`, value included. */
  literal?: string;
}

/** The values of a layer's entries, by name. */
export function valuesOf<T extends Record<string, Heuristic>>(entries: T): { readonly [K in keyof T]: T[K]['value'] } {
  return Object.fromEntries(Object.entries(entries).map(([name, h]) => [name, h.value])) as { readonly [K in keyof T]: T[K]['value'] };
}
