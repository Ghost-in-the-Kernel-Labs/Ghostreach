/**
 * One order for the site's findings (TODO 135, M1: G-668's order, the audit's, for every place): `siteFindings` returns them in
 * it, so the suite's "Links that need a look", the audit, the preview and the site report read the same list in the same order.
 */
import type { LinkLook, SiteFinding } from './types.js';
import { linkingPages } from './link-findings.js';

/** How many things wrong a finding stands for: one per page or address it lists. */
const issuesIn = (f: SiteFinding): number => Math.max(1, f.where.length);

/** The site's own links a finding says answer an error (G-668): what its owner can act on first. None for another site's links. */
const ownBreaks = (f: SiteFinding): LinkLook[] => (f.unconfirmed ? [] : f.where.flatMap((w) => (w.link && !w.offSite ? [w.link] : [])));

/** How a finding leads (G-668): a confirmed break of the site's own links first, one a menu carries before one it does not, then the most pages linking. */
function breakRank(f: SiteFinding): [number, number, number] {
  const breaks = ownBreaks(f);
  return [breaks.length ? 0 : 1, breaks.some((l) => l.inMenu) ? 0 : 1, -Math.max(0, ...breaks.map(linkingPages))];
}

/**
 * The most critical first: what the crawler confirmed before what it could not (G-668), major before minor, a break of the
 * site's own links before the rest of its severity (G-668), then the one that reaches the most (G-193, its components: G-664).
 */
// Decision: G-193, G-668, G-678
export function ranked(findings: SiteFinding[]): SiteFinding[] {
  const weight = (f: SiteFinding) => ({ major: 0, minor: 1, info: 2 })[f.severity];
  const key = (f: SiteFinding, i: number) => [f.unconfirmed ? 1 : 0, weight(f), ...breakRank(f), -issuesIn(f), i];
  const order = (a: number[], b: number[]) => a.reduce((d, x, k) => d || x - b[k], 0);
  return findings.map((f, i) => ({ f, k: key(f, i) })).sort((a, b) => order(a.k, b.k)).map((x) => x.f);
}
