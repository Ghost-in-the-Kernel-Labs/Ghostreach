/**
 * Reader: the page's frames (docs/FRAMES-PLAN.md, G-094). Each frame is recorded with its frame path
 * (the locator of every frame element to go through, outermost first, itself last), its address,
 * whether it is on the site, shown, or an ad host's, its title and size. A same-site frame (an
 * address on the site, or none: srcdoc, about:blank) is read like the page, its headings, links and
 * controls, and the frames inside it, to H.FRAME_DEPTH; another site's frame is recorded, never read.
 * Readers record; what a frame means for a suite is decided past the crawl.
 * In the page: SELF-CONTAINED: the function given to element.evaluate() goes whole, so it uses nothing this file imports or declares beside it (CONTROLS_SCRIPT's globals only); CONTROLS_SCRIPT itself is bundled (controls-page.ts).
 */
import type { Frame, Page } from 'playwright';
import { H } from '../../leaf/heuristics/crawl.js';
import { isAdHost } from '../../leaf/pages/ad-hosts.js';
import { sameOrigin } from '../../leaf/pages/url.js';
import { CONTROLS_SCRIPT } from '../controls-script.js';
import type { PageFrame } from '../../leaf/report.js';
import { collectHeadingsOf } from './headings.js';
import { readControls } from './controls.js';
import { readLinks } from './links.js';

/** What frameFacts() (controls-page.ts) says of a frame element. */
export type FrameFacts = { xpath: string; src: string | null; srcdoc: boolean; title: string | null; width: number; height: number; shown: boolean };

/** An address as written, made absolute against the document that holds it; as written when it cannot be. */
const resolved = (href: string, base: string) => {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
};

/** True when an address is on the site's own origin; false for one that is no URL at all. */
const isSameOrigin = (address: string, origin: string) => {
  try {
    return sameOrigin(address, origin);
  } catch {
    return false;
  }
};

/**
 * One frame's record, from the facts its element gives and the address its frame loaded: an
 * address of none for a srcdoc frame; the address loaded when it is a page's, else the one its
 * element asks for (another site's frame is never fetched: the crawl's router keeps to the site, so
 * the browser shows an error page there); same-site for no address, about:, or the site's origin.
 */
// Decision: G-089
export function frameRecord(facts: FrameFacts, loaded: string, holder: string, path: string[], origin: string): PageFrame {
  const asked = facts.src ? resolved(facts.src, holder) : null;
  const url = facts.srcdoc || loaded === 'about:srcdoc' ? null : /^https?:/.test(loaded) ? loaded : (asked ?? (loaded || null));
  const sameSite = url === null || url.startsWith('about:') || isSameOrigin(url, origin);
  return {
    path,
    url,
    sameSite,
    shown: facts.shown,
    ...(url && !sameSite && isAdHost(url) ? { ad: true } : {}),
    title: facts.title,
    width: facts.width,
    height: facts.height,
  };
}

/** What a same-site frame shows: its headings, links and controls, read as the page's are. */
async function readInside(frame: Frame, record: PageFrame): Promise<void> {
  const { headings } = await collectHeadingsOf(frame).catch(() => ({ headings: [] as string[] }));
  if (headings.length) record.headings = headings;
  const links = await readLinks(frame).catch(() => []);
  if (links.length) record.links = links.map((l) => ({ href: l.resolved, text: l.text }));
  const controls = await readControls(frame);
  if (controls.length) record.controls = controls;
}

/** The frames inside `parent`, each recorded, and read when it is the site's, to H.FRAME_DEPTH deep. */
async function framesIn(parent: Frame, path: string[], origin: string, out: PageFrame[]): Promise<void> {
  const children = parent.childFrames();
  if (!children.length || path.length >= H.FRAME_DEPTH) return;
  // The frame elements are described by the locator ladder, run in the document that holds them.
  await parent.evaluate(`(() => { ${CONTROLS_SCRIPT} })()`).catch(() => {});
  for (const child of children) {
    const element = await child.frameElement().catch(() => null);
    const facts = (await element?.evaluate((el) => (globalThis as unknown as { __forecursorFrame: (frameElement: Element) => FrameFacts }).__forecursorFrame(el as Element)).catch(() => null)) ?? null;
    if (!facts) continue;
    const record = frameRecord(facts, child.url(), parent.url(), [...path, facts.xpath], origin);
    out.push(record);
    if (!record.sameSite) continue;
    await readInside(child, record);
    await framesIn(child, record.path, origin, out);
  }
}

/** Every frame of a loaded page, outermost first, each with its frame path. */
// Decision: G-094
export async function readFrames(page: Page, origin: string): Promise<PageFrame[]> {
  const out: PageFrame[] = [];
  await framesIn(page.mainFrame(), [], origin, out);
  return out;
}
