/**
 * Reader: the texts that name a page's parts, and which of them a visitor doesn't see on arrival
 * (hidden, or in the cookie banner the consent reader found).
 * In the page: SELF-CONTAINED: collectHeadings goes to page.evaluate() whole, as its text after READING_SCRIPT, so it uses nothing this file imports or declares beside it (READING_SCRIPT's globals only).
 */
import type { Frame, Page } from 'playwright';
import { READING_SCRIPT } from '../reading-script.js';

/**
 * Runs in the page: the texts that name its parts (headings, table headers, form labels), in
 * document order, each once. Pages of one template share most of these ("Base stats", "Pokédex
 * data") even when their shapes differ a little; different pages with a similar layout don't.
 * `skipped` lists those a visitor does not see on arrival, by the seen rule (G-737, unseen.ts `seen`, set by
 * READING_SCRIPT before this runs): hidden (a closed mega-menu, a cookie preference centre), screen-reader-only (a 1px
 * clipped "Post navigation"), off to the side or above the top; or inside a cookie/consent banner or an ad wall.
 * Self-contained for page.evaluate().
 */
function collectHeadings(): { headings: string[]; skipped: string[] } {
  const headings: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  // As src/pages/unseen.ts's CONSENT_MARKS and AD_WALL (test/unit/unseen.test.ts holds the copies alike).
  const consent = /cookie|consent|gdpr|onetrust|cookiebot|didomi|usercentrics|(^|[\s_-])cmp([\s_-]|$)/i;
  // An ad wall ("Unlock more content", Google's offerwall in fc-message-root) shows only when the
  // site's ads load; the suites block them (G-049), so its heading is never there in a test.
  const adWall = /fc-message-root|offerwall/i;
  const inConsent = (el: Element) => {
    for (let a: Element | null = el; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const idc = `${a.id} ${typeof a.className === 'string' ? a.className : ''}`;
      if (consent.test(idc) || adWall.test(idc)) return true;
    }
    return false;
  };
  // The one rule of what a visitor sees (G-737), from READING_SCRIPT: below the fold is seen; off to the side is not.
  const visible = (globalThis as unknown as { __suiteBuilderSeen: (el: Element) => boolean }).__suiteBuilderSeen;
  // A label's own words, not the options of the dropdown inside it ("Industry", not "Industry All").
  const ownText = (el: Element) => {
    if (!el.querySelector('select, textarea, button, script, style')) return el.textContent || '';
    const copy = el.cloneNode(true) as Element;
    for (const control of Array.from(copy.querySelectorAll('select, textarea, button, script, style'))) control.remove();
    return copy.textContent || '';
  };
  for (const el of Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, th, legend, label, caption, dt'))) {
    const text = ownText(el).replace(/\s+/g, ' ').trim();
    if (!text || text.length > 80 || seen.has(text)) continue;
    seen.add(text);
    headings.push(text);
    if (!visible(el) || inConsent(el)) skipped.push(text);
    if (headings.length >= 150) break;
  }
  return { headings, skipped };
}

export async function collectHeadingsOf(page: Page | Frame): Promise<{ headings: string[]; skipped: string[] }> {
  return (await page.evaluate(`(() => { ${READING_SCRIPT}; return (${collectHeadings.toString()})(); })()`)) as { headings: string[]; skipped: string[] };
}

/** The page's headings; `skippedHeadings` only when some are unseen (hidden, or in the banner). */
export function unseenHeadings(headings: string[], skipped: string[], bannerHeadings: string[]): { headings: string[]; skippedHeadings?: string[] } {
  const inBanner = new Set(bannerHeadings);
  const unseen = headings.filter((h) => inBanner.has(h) || skipped.includes(h));
  return unseen.length > 0 ? { headings, skippedHeadings: unseen } : { headings };
}
