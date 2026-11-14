/**
 * The page entries whose reading was given up at its deadline (deadline.ts, readWithin; G-501). A reading cannot be cancelled: its
 * readers run on after the crawl has moved on, and a reader that writes what it found (the role questions) asks first whether its
 * reading was given up, so nothing it learns after the deadline lands on the entry.
 */
const givenUp = new WeakSet<object>();

/** The reading of this entry was given up at its deadline. */
export function abandonReading(entry: object): void {
  givenUp.add(entry);
}

/** True once the reading of this entry was given up. */
export function isAbandoned(entry: object): boolean {
  return givenUp.has(entry);
}
