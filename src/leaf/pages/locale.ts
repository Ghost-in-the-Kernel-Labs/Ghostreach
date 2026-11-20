/**
 * A site's languages as its addresses show them: the locale segment a path starts with (/en/, /de-at/, /us/en/),
 * and a locale's language. Only a hint: the crawler also asks the page (src/crawl/readers/language.ts).
 */

/** ISO 639-1 language codes: the first part of a locale segment like en, fr, de-at, pt-br. */
const LANGUAGE_CODES = new Set(
  ('aa ab af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ' +
    'ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ' +
    'ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi ' +
    'mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw ' +
    'sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ' +
    'ur uz ve vi vo wa wo xh yi yo za zh zu').split(' '),
);

/** A path segment that reads as a language or a locale: en, de-at, pt_BR, zh-hans (its first part checked against LANGUAGE_CODES). */
const LOCALE = /^([a-z]{2})(?:[-_]([a-z]{2}|[a-z]{4}))?$/i;

/**
 * The URL's locale segment when its path starts with one, lower-cased with "-"; otherwise null:
 *   - a language or locale: /en/, /fr/, /de-at/, /pt_BR/ -> "en", "fr", "de-at", "pt-br"
 *   - a region, then a language: /us/en/, /cn/zh/, /anz/en/ -> "us/en", "cn/zh", "anz/en"
 *     (site-a.example: v1.5.0 knew only the first kind, and a crawl started at /us/en wandered into
 *     /cn/zh, /mx/en and /ae/en). Checked first, so /ca/en is Canada in English, not Catalan.
 * On its own this is only a hint: /it/ may be an IT section. The crawler also asks the page (its
 * lang attribute, hreflang alternates). HubSpot's call-to-action redirect, /cs/c/, is not Czech (G-672).
 */
export function localeSegment(url: string): string | null {
  const [first, second] = new URL(url).pathname.split('/').filter(Boolean);
  if (first?.toLowerCase() === 'cs' && second?.toLowerCase() === 'c') return null;
  const second_ = second ? LOCALE.exec(second) : null;
  if (first && /^[a-z]{2,3}$/i.test(first) && second_ && LANGUAGE_CODES.has(second_[1].toLowerCase())) {
    return `${first}/${second}`.toLowerCase().replace('_', '-');
  }
  const m = first ? LOCALE.exec(first) : null;
  if (!m || !LANGUAGE_CODES.has(m[1].toLowerCase())) return null;
  return first.toLowerCase().replace('_', '-');
}

/**
 * A folder below the top level named as a locale, with the folders above it, lower-cased with "-"; otherwise null:
 * /blog/de/post -> "blog/de", /blog/pt_BR/ -> "blog/pt-br", /en/blog/ja/ -> "en/blog/ja" (after a top-level locale).
 * The first such folder only. Only a candidate: /services/it/ and /products/id/12 read as one too, so the crawl takes
 * one for another language only beside a sibling and when a page of it says so (CrawlState.confirmLanguageFolder,
 * G-754). keepersecurity.com (2026-11-11) kept its blog's translations at /blog/de/, /blog/ja/ and nine more.
 */
// Decision: G-754
export function localeFolder(url: string): string | null {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  const top = localeSegment(url);
  for (let i = top ? top.split('/').length : 1; i < segments.length; i++) {
    const m = LOCALE.exec(segments[i]);
    if (m && LANGUAGE_CODES.has(m[1].toLowerCase())) return segments.slice(0, i + 1).join('/').toLowerCase().replace(/_/g, '-');
  }
  return null;
}

/** "en-US" -> "en"; a locale segment's language: "us/en" -> "en". */
export function primaryLanguage(tag: string): string {
  return (tag.split('/').at(-1) ?? '').split(/[-_]/)[0].toLowerCase();
}
