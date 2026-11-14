/**
 * Reader: the start page's language and its translations, and the decision the crawl takes from
 * them (which language to stay in): a decision about how to look at the site, not about the suite.
 * In the page: SELF-CONTAINED: collectLanguage goes to page.evaluate() whole, so it uses nothing this file imports or declares beside it.
 */
import type { Page } from 'playwright';
import { localeSegment, primaryLanguage } from '../../leaf/pages/locale.js';
import { normalizeUrl, sameOrigin } from '../../leaf/pages/url.js';
import type { CrawlReport } from '../../leaf/report.js';

/** Runs in the page: its language and the addresses of its translations. Self-contained. */
function collectLanguage(): { lang: string; alternates: string[] } {
  const alternates = Array.from(document.querySelectorAll('link[rel~="alternate"][hreflang], a[hreflang]'))
    .filter((el) => el.getAttribute('hreflang')!.toLowerCase() !== 'x-default')
    .map((el) => (el as HTMLAnchorElement | HTMLLinkElement).href)
    .filter(Boolean);
  return { lang: document.documentElement.lang || '', alternates };
}

export async function readLanguage(page: Page): Promise<{ lang: string; alternates: string[] }> {
  return page.evaluate(collectLanguage);
}

/**
 * Is this a multilingual site, and which language did the crawl start in? Two kinds:
 *   - the start page has a locale segment (/en/) that agrees with its lang attribute (or it has
 *     none), and some link or translation leads to another locale segment: stay under /en/;
 *   - the start page has no locale segment but lists translations (hreflang) under locale
 *     segments (/fr/, /de/): leave those out, and any locale segment in another language.
 * Anything else is treated as one language: an /it/ section on an English site stays in.
 */
export function decideLanguage(url: string, origin: string, info: { lang: string; alternates: string[] }, links: string[]): CrawlReport['language'] {
  const lang = info.lang.trim() || null;
  const prefix = localeSegment(url);
  const segmentsOf = (urls: string[]) =>
    new Set(urls.map((u) => normalizeUrl(u)).filter((u): u is string => u !== null && sameOrigin(u, origin)).map(localeSegment).filter((s): s is string => s !== null && s !== prefix));
  const translations = segmentsOf(info.alternates);
  if (prefix) {
    if (lang && primaryLanguage(lang) !== primaryLanguage(prefix)) return undefined; // /id/ on an English page: not a language
    const others = new Set([...translations, ...segmentsOf(links)]);
    return others.size > 0 ? { prefix, lang, others: [...others].sort() } : undefined;
  }
  return translations.size > 0 ? { prefix: null, lang, others: [...translations].sort() } : undefined;
}
