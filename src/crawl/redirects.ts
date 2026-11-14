/**
 * What one redirect hop means for the page being loaded: follow it, stop with an error (not a web
 * address, a loop, too many hops), stop because it leaves the site, or follow it to where the site
 * now lives (the start page itself moved: http -> https, example.com -> www.example.com).
 *
 * Pure: the crawl loop (crawler.ts) records the hop, then asks this; robots.txt and pages already
 * read are the loop's to check, since they need its state.
 */
import { H } from '../leaf/heuristics/crawl.js';
import { normalizeUrl, sameOrigin } from '../leaf/pages/url.js';
import type { RedirectHop } from '../leaf/report.js';

/** Browsers give up after about 20; a site needing more than 10 is broken. */
const MAX_REDIRECTS = H.MAX_REDIRECTS;

export type HopVerdict =
  /** Load `next`; when the start page moved, the site now lives at `movedTo` (an origin). */
  | { follow: string; movedTo?: string }
  /** Stop here: the page failed, for this reason; `fatal`: the whole crawl fails with it (the start page would not be followed offline). */
  | { error: string; fatal?: true }
  /** Stop here: it leads off the site, which is never requested. */
  | { offSite: true };

/**
 * `hops`: the redirects followed so far, this one included (its `url` is where it came from).
 * `location`: where this one points. `origin`: the site being crawled.
 */
// Decision: G-021
export function judgeRedirect(hops: RedirectHop[], location: string, origin: string, isStart: boolean, offline = false): HopVerdict {
  const next = normalizeUrl(location);
  if (!next) return { error: `redirects to a non-web URL: ${location}` };
  if (hops.some((hop) => hop.url === next)) return { error: 'redirect loop' };
  if (hops.length > MAX_REDIRECTS) return { error: `more than ${MAX_REDIRECTS} redirects` };
  if (sameOrigin(next, origin)) return { follow: next };
  // Another site: not ours, unless it's the start page moving, which says where the site lives.
  if (!isStart) return { offSite: true };
  const movedTo = new URL(next).origin;
  // Offline (--offline, G-335) the crawl follows no other host, the start page's move included: it fails, saying where to build instead.
  if (offline && new URL(next).hostname !== new URL(origin).hostname) return { error: movedOfflineMessage(movedTo), fatal: true };
  return { follow: next, movedTo };
}

/** What an offline crawl says when the start page moved to another host (G-335); `movedOffline` knows it again. */
function movedOfflineMessage(origin: string): string {
  return `the site moved to ${origin}; --offline follows no other host: build ${origin} instead`;
}
