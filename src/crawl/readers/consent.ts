/**
 * Cookie and consent banners. Headless browsers get them on every page (a fresh context has no
 * cookies), and a banner over the page makes clicks in generated tests fail.
 *
 * Detection is by what a banner is, not what a tool calls it: an element on top of the page
 * (fixed or sticky, a dialog, a modal) whose text talks about cookies or consent, with a button
 * that dismisses it. Known tools' button ids are only a shortcut.
 *
 * The crawler never clicks the banner: the crawl reads pages as a first-time visitor sees them.
 * Generated tests click it when it gets in the way.
 */

import type { Frame, Page } from 'playwright';
import { READING_SCRIPT } from '../reading-script.js';

export { CONSENT_SELECTORS } from '../../leaf/pages/consent-buttons.js';

export interface ConsentBanner {
  /** Playwright selector for the button that dismisses it. */
  selector: string;
  /** Headings, labels and the like inside the banner: the same on every page, never page checks. */
  headings: string[];
}

/** The consent banner showing on the page, or null, read in it (consent-page.ts, in READING_SCRIPT). */
// Decision: G-054
export async function consentBannerOn(page: Page | Frame, known: string[]): Promise<ConsentBanner | null> {
  return page.evaluate(`(() => { ${READING_SCRIPT}; return globalThis.__forecursorConsent(${JSON.stringify(known)}); })()`) as Promise<ConsentBanner | null>;
}

