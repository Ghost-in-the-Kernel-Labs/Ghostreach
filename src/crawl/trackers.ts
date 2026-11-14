/**
 * Click-tracking redirects, read through to where they lead (G-656, TODO 129 box 2). A press release's links often go
 * through a tracker that carries the destination in a parameter (cts.businesswire.com/ct/CT?id=smartlink&url=<destination>);
 * a tracker that stalls on a crawler says nothing about the site, so such a link is judged by its destination. Only a host
 * listed here is read through: an open redirect elsewhere is never followed blind. Each host is listed with why.
 */

/** One tracker host: the exact host name, lower case, and why it is listed. */
export interface Tracker {
  host: string;
  why: string;
}

/** The hosts read through. A new one is added with why, and a test of its shape (test/unit/trackers.test.ts). */
export const TRACKERS: readonly Tracker[] = Object.freeze([
  { host: 'cts.businesswire.com', why: "Business Wire's click tracking on press releases (`/ct/CT?id=smartlink&url=`): the Vouched review, 2026-11-08, where five such links were called broken" },
  { host: 'l.facebook.com', why: "Facebook's outbound link redirect (`/l.php?u=`), on links copied from its posts" },
  { host: 'lm.facebook.com', why: "Facebook's outbound link redirect on its mobile site (`/l.php?u=`)" },
]);

/** The parameters a tracker's destination is read from, in this order: the common shapes. */
const DESTINATION_PARAMS = Object.freeze(['url', 'u', 'redirect', 'dest'] as const);

/** Where a link through a listed tracker leads: an absolute http(s) address in one of DESTINATION_PARAMS; null otherwise. */
// Decision: G-656
export function trackerDestination(address: string, trackers: readonly Tracker[] = TRACKERS): string | null {
  let u: URL;
  try {
    u = new URL(address);
  } catch {
    return null;
  }
  if (!trackers.some((t) => t.host === u.hostname.toLowerCase())) return null;
  for (const p of DESTINATION_PARAMS) {
    const value = u.searchParams.get(p);
    if (value && /^https?:\/\//i.test(value)) {
      try {
        return new URL(value).href;
      } catch {
        // not an address: try the next parameter
      }
    }
  }
  return null;
}
