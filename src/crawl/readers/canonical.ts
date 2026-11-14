/**
 * Reader: the page's own statement of its address (<link rel="canonical">), resolved.
 * In the page: SELF-CONTAINED: canonicalHref goes to page.evaluate() whole, so it uses nothing this file imports or declares beside it.
 */
import type { Page } from 'playwright';
import { normalizeUrl } from '../../leaf/pages/url.js';

/** Runs in the page. Self-contained for page.evaluate(). */
function canonicalHref(): string | null {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="canonical" i][href]');
  return link ? link.href : null;
}

/** The canonical address, normalized; null without one (or one that isn't a web address). */
export async function readCanonical(page: Page): Promise<string | null> {
  return normalizeUrl((await page.evaluate(canonicalHref).catch(() => null)) ?? '');
}
