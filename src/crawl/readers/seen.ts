/**
 * What the browser itself lists on the page for a visitor to use: its accessibility tree's links and
 * controls, by role and name (Playwright's ariaSnapshot), read apart from the other readers so that a
 * gap between the two can be named after the crawl (TODO 38, src/group/unread.ts). It sees inside open
 * shadow roots and custom elements, and what a role makes a control (`role="button"`); a frame is one
 * entry (readers/frames.ts reads inside it); a canvas, nothing. For each one the other readers did not
 * record, it finds where it lives (G-222): in a web component's shadow root, in the cookie banner (the
 * suite's CookieBanner's, never a gap), on the page itself, or out of any script's reach. It records; it decides nothing.
 * In the page: SELF-CONTAINED: locateNames goes to page.evaluate() whole, as its text after READING_SCRIPT, so it uses nothing this file imports or declares beside it (READING_SCRIPT's globals only).
 */
import type { Page } from 'playwright';
import { H } from '../../leaf/heuristics/crawl.js';
import { READING_SCRIPT } from '../reading-script.js';
import { withoutSession } from '../../leaf/pages/url.js';
import { notRecorded, type Recorded } from '../../leaf/pages/recorded.js';
import type { BrowserControl, CrawledPage } from '../../leaf/report.js';

/** The roles a visitor uses: links and controls. Headings and text are read elsewhere; options belong to their dropdown. */
const SEEN_ROLES = new Set(['button', 'link', 'textbox', 'searchbox', 'combobox', 'listbox', 'checkbox', 'radio', 'switch', 'slider', 'spinbutton', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio']);

/** One line of an ARIA snapshot ("- button \"Add one\"", "  - textbox \"Email\": x"): its role and name, or null. */
function seenLine(line: string): BrowserControl | null {
  const m = /^\s*- ([a-z]+)(?: "((?:[^"\\]|\\.)*)")?/.exec(line);
  if (!m || !SEEN_ROLES.has(m[1])) return null;
  return { role: m[1], name: (m[2] ?? '').replace(/\\(.)/g, '$1').trim() };
}

/**
 * Where each name lives, run in the page (no imports): every element of the document and of every open
 * shadow root in it, the deepest whose own words (its label, aria-label, title, placeholder, value or text)
 * are the name. In a shadow root: its host's tag; in the document: its own tag; found nowhere a script can
 * look: out of reach.
 */
function locateNames(names: string[]): BrowserControl['where'][] {
  const plain = (text: string | null | undefined) => (text ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
  const wordsOf = (el: Element): string[] => {
    const root = el.getRootNode() as Document | ShadowRoot;
    const byId = (id: string) => root.getElementById?.(id)?.textContent;
    const input = el as HTMLInputElement;
    const words: (string | null | undefined)[] = [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('placeholder'), el.getAttribute('alt'), /^(button|submit|reset)$/.test(input.type ?? '') ? input.value : null, el.textContent];
    for (const id of (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)) words.push(byId(id));
    if (el.id) words.push(root.querySelector?.(`label[for="${CSS.escape(el.id)}"]`)?.textContent);
    words.push(el.closest('label')?.textContent);
    return words.map(plain).filter(Boolean);
  };
  // The reading script's banner test (links-page.ts), set by READING_SCRIPT before this runs.
  const inBanner = (globalThis as unknown as { __suiteBuilderInBanner?: (el: Element) => boolean }).__suiteBuilderInBanner;
  const all: { el: Element; host: string | null }[] = [];
  const walk = (root: Document | ShadowRoot, host: string | null) => {
    for (const el of root.querySelectorAll('*')) {
      all.push({ el, host });
      if (el.shadowRoot) walk(el.shadowRoot, el.tagName.toLowerCase());
    }
  };
  walk(document, null);
  return names.map((name) => {
    const n = plain(name);
    const hits = all.filter(({ el }) => wordsOf(el).includes(n));
    const hit = hits[hits.length - 1];
    if (!hit) return { in: 'unreachable' as const };
    if (!hit.host && inBanner?.(hit.el)) return { in: 'banner' as const };
    return hit.host ? { in: 'shadow' as const, host: hit.host } : { in: 'page' as const, tag: hit.el.tagName.toLowerCase() };
  });
}

/** A link's address, from the line under it in the snapshot ("- /url: mailto:x"), without a session id (G-305); undefined for any other line. */
export function linkAddress(line: string): string | undefined {
  const written = /^\s*- \/url: (.+)/.exec(line)?.[1]?.trim();
  return written ? withoutSession(written) : undefined;
}

/** The page's links and controls as the browser lists them, each role and name once, at most H.SEEN_MAX, and how many past it; null when it would not say. */
export async function listSeen(page: Page): Promise<{ seen: BrowserControl[]; left: number } | null> {
  let snapshot: string;
  try {
    snapshot = await page.locator('body').ariaSnapshot({ timeout: 5000 });
  } catch {
    return null;
  }
  const out = new Map<string, BrowserControl>();
  const left = new Set<string>();
  const lines = snapshot.split('\n');
  lines.forEach((line, i) => {
    const seen = seenLine(line);
    if (!seen) return;
    const url = seen.role === 'link' ? linkAddress(lines[i + 1] ?? '') : undefined;
    const key = seenKey({ ...seen, url });
    if (out.size >= H.SEEN_MAX && !out.has(key)) {
      left.add(key);
      return;
    }
    out.set(key, url ? { ...seen, url } : seen);
  });
  return { seen: [...out.values()], left: left.size };
}

/** One entry of the browser's list as a key: its role, name and, for a link, address. */
export const seenKey = (s: Pick<BrowserControl, 'role' | 'name' | 'url'>) => `${s.role}\n${s.name}\n${s.url ?? ''}`;

/** Sets where each of these lives on the page (G-222); a page navigating away mid-read leaves them without. */
export async function locateSeen(page: Page, missed: BrowserControl[]): Promise<void> {
  if (!missed.length) return;
  try {
    const where = (await page.evaluate(`(() => { ${READING_SCRIPT}; return (${locateNames.toString()})(${JSON.stringify(missed.map((m) => m.name))}); })()`)) as BrowserControl['where'][];
    missed.forEach((m, i) => {
      if (where[i]) m.where = where[i];
    });
  } catch {
    // What was missed is still said, without where.
  }
}

/**
 * The page's links and controls as the browser lists them (listSeen); each one the readers did not record
 * (`recorded`: their words by kind, recorded.ts) with where it lives. Says when the list is not whole
 * (`incomplete`): the browser would not say (`seen` null), or it listed more than the cap.
 */
export async function readSeen(page: Page, recorded: Recorded): Promise<{ seen: BrowserControl[] | null; incomplete?: CrawledPage['seenIncomplete'] }> {
  const listed = await listSeen(page);
  // Not "nothing missed": not compared (the reviews of 2026-10-11).
  if (!listed) return { seen: null, incomplete: { why: 'failed' } };
  await locateSeen(page, notRecorded(listed.seen, recorded));
  return listed.left ? { seen: listed.seen, incomplete: { why: 'cut', left: listed.left } } : { seen: listed.seen };
}
