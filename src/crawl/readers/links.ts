/**
 * Reader: every link on a loaded page, with where it sits and, for one hidden in a closed dropdown,
 * what opens it. Facts only: which links the crawl follows is the crawl loop's business.
 */
import type { Frame, Page } from 'playwright';
import { H } from '../../leaf/heuristics/grouping.js';
import { markCredentials } from '../../leaf/pages/credential-text.js';
import { normalizeUrl, sameOrigin, withoutSession } from '../../leaf/pages/url.js';
import type { LinkEdge, MenuTrigger, PageAnchor } from '../../leaf/report.js';
import { READING_SCRIPT } from '../reading-script.js';
import { TRACKERS, trackerDestination, type Tracker } from '../trackers.js';

export interface RawLink {
  href: string;
  resolved: string;
  text: string;
  hidden: boolean;
  region: 'header' | 'footer' | 'main' | 'banner';
  trigger: MenuTrigger | null;
  /** Openers inside the dropdown `trigger` opens, outermost first (a mega menu's category column). */
  innerTriggers: MenuTrigger[];
  newTab: boolean;
  /** An in-page anchor (anchors-page.ts): absent for a link to another document. */
  anchor?: RawAnchor;
}

/** What an in-page link points at, as the page answered (anchors-page.ts): a PageAnchor without the link. */
type RawAnchor = Pick<PageAnchor, 'id' | 'exists' | 'sameId' | 'top' | 'undrawn'> & { heading: string | null };

/** Every link on the page, read in it (links-page.ts, in READING_SCRIPT). */
export async function readLinks(page: Page | Frame): Promise<RawLink[]> {
  const links = (await page.evaluate(`(() => { ${READING_SCRIPT}; return globalThis.__suiteBuilderLinks(); })()`)) as RawLink[];
  return links.map((link) => withoutSessionIds(withoutCredentialWords(link)));
}

/** The link with each sentence of its words that gives a credential replaced by the marker (TODO 71), the dropdown's openers too. */
function withoutCredentialWords(link: RawLink): RawLink {
  const trigger = (t: MenuTrigger): MenuTrigger => ({ ...t, text: markCredentials(t.text) });
  return { ...link, text: markCredentials(link.text), trigger: link.trigger && trigger(link.trigger), innerTriggers: link.innerTriggers.map(trigger) };
}

/** The link as written by a page without the session id in its addresses (G-305): the one a suite finds it by. */
function withoutSessionIds(link: RawLink): RawLink {
  const trigger = (t: MenuTrigger): MenuTrigger => ('href' in t ? { ...t, href: withoutSession(t.href) } : t);
  return { ...link, href: withoutSession(link.href), trigger: link.trigger && trigger(link.trigger), innerTriggers: link.innerTriggers.map(trigger) };
}

/**
 * A link as the report records it, or null for one that isn't a web address (mailto:, tel:, javascript:),
 * or has an empty href: it resolves to its own page, and what a click on it does is its script's
 * (/entry-ad's "click here" opens another site), so no test can follow it as a link (G-171).
 */
// Decision: G-171
export function linkEdge(from: string, link: RawLink, origin: string, trackers: readonly Tracker[] = TRACKERS): LinkEdge | null {
  if (link.href.trim() === '' && !link.trigger) return null;
  const written = normalizeUrl(link.resolved);
  if (!written) return null;
  // G-656: a link through a listed click tracker is recorded by where it leads; the tracker is kept as `via`, never asked.
  const destination = trackerDestination(written, trackers);
  const to = (destination && normalizeUrl(destination)) || written;
  return {
    from,
    to,
    href: link.href,
    text: truncate(link.text, H.LINK_TEXT_MAX),
    external: !sameOrigin(to, origin),
    ...(to !== written ? { via: written } : {}),
    ...(link.region !== 'main' ? { region: link.region } : {}),
    ...(link.hidden ? { hidden: true as const } : {}),
    ...(link.trigger ? { trigger: link.trigger } : {}),
    ...(link.trigger && link.innerTriggers.length ? { innerTriggers: link.innerTriggers } : {}),
    ...(link.newTab ? { newTab: true as const } : {}),
  };
}

/**
 * The page's in-page anchors (TODO 111), each link once per place as an edge is: its words bounded and marked as a link's
 * are, its target's heading marked too (TODO 71). Empty for a page with none.
 */
export function anchorsOf(links: readonly RawLink[]): PageAnchor[] {
  const once = new Map<string, PageAnchor>();
  for (const { anchor, href, text, region, hidden } of links) {
    const key = `${href}\n${text}\n${region}\n${hidden}`;
    if (!anchor || once.has(key)) continue;
    const { heading, ...rest } = anchor;
    once.set(key, { href, text: truncate(text, H.LINK_TEXT_MAX), ...rest, ...(heading ? { heading: truncate(markCredentials(heading), H.LINK_TEXT_MAX) } : {}), ...(region !== 'main' ? { region } : {}), ...(hidden ? { hidden: true as const } : {}) });
  }
  return [...once.values()];
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
