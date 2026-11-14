/**
 * A finding line's address: the path (and query) of the site's own page; another site's, whole with its scheme and
 * host, so a link to it never reads as the site's own (Ghost, 2026-11-05, G-455). The caller escapes it as site text.
 * Its own file: the writers that import it stay small (SRC-17).
 */

// Decision: G-455
export function findingAddress(w: { url: string; offSite?: boolean }, ownQuery = true): string {
  const u = new URL(w.url);
  return w.offSite ? `${u.origin}${u.pathname}${u.search}` : `${u.pathname}${ownQuery ? u.search : ''}`;
}
