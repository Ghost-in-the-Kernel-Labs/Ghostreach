/**
 * A redirect that drops a query parameter the link had (G-743 (4)): irthsolutions.com's links carried HubSpot's `?hsLang=en`, which
 * a 307 stripped, and SITE-03 and SITE-18 told the owner to fix a trailing slash (the corpus run of 2026-11-11, I8). Read by both.
 */

/** The query parameters `from` had that `to` has not, by name; none when either is no address. */
export function droppedQuery(from: string, to: string): string[] {
  if (!URL.canParse(from) || !URL.canParse(to)) return []; // a report is data
  const kept = new URL(to).searchParams;
  return [...new Set([...new URL(from).searchParams.keys()].filter((name) => !kept.has(name)))];
}

/** Whether the redirect only dropped query parameters: the same path (a trailing slash aside), some parameter left out. */
export function queryDropOnly(from: string, to: string): boolean {
  if (!droppedQuery(from, to).length) return false;
  const bare = (u: string) => new URL(u).pathname.replace(/\/$/, '');
  return new URL(from).origin === new URL(to).origin && bare(from) === bare(to);
}
