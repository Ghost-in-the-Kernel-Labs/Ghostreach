/**
 * The crawl's other languages (state.ts, CrawlState, which delegates here): the locale segments of other languages met so
 * far, the folders below the top level named as a locale among the addresses found, and those a page of decided (G-754).
 * Moved out of state.ts by what it does, for the 400-line target (C-022, C-023, J-014): the bodies are the parent's, the
 * site's language passed in where they read CrawlState's own.
 */
import { localeFolder, localeSegment, primaryLanguage } from '../leaf/pages/locale.js';
import type { CrawlReport } from '../leaf/report.js';

type Language = CrawlReport['language'];

export class LanguageFolders {
  /** Locale segments of other languages met so far, and the language folders below the top level found (blog/de). */
  readonly #otherLocales = new Set<string>();
  /** Folders below the top level named as a locale among the addresses found (localeFolder), by the path above them: blog -> de, ja. */
  readonly #localeFolders = new Map<string, Set<string>>();
  /** Those a page of decided (confirmLanguageFolder, G-754): true, another language, left out; false, the crawl's own. */
  readonly #folderDecided = new Map<string, boolean>();

  /** The other languages' segments met so far, sorted (the report's `language.others`). */
  get others(): string[] {
    return [...this.#otherLocales].sort();
  }

  /** The site's other languages, known from its start page (CrawlState.decideLanguage). */
  addOthers(others: readonly string[]): void {
    for (const other of others) this.#otherLocales.add(other);
  }

  /** A folder below the top level named as a locale (/blog/de/), noted under the path above it, for its siblings. */
  noteLocaleFolder(url: string): void {
    const folder = localeFolder(url);
    if (!folder) return;
    const parent = folder.slice(0, folder.lastIndexOf('/'));
    const siblings = this.#localeFolders.get(parent) ?? new Set<string>();
    siblings.add(folder);
    this.#localeFolders.set(parent, siblings);
  }

  /**
   * The folder below the top level this address may put in another language (/blog/de/post -> blog/de), for a page of it
   * to decide (confirmLanguageFolder); null when there is nothing to ask: the site is in one language,
   * the address is in no such folder, its folder has no sibling named as a locale among the addresses found (/products/id/12
   * alone is an id, not Indonesian), or a page of it has decided already (G-754).
   */
  // Decision: G-754
  languageFolderCandidate(language: Language, url: string): string | null {
    const folder = language ? localeFolder(url) : null;
    if (!folder || this.#folderDecided.has(folder)) return null;
    return (this.#localeFolders.get(folder.slice(0, folder.lastIndexOf('/')))?.size ?? 0) >= 2 ? folder : null;
  }

  /**
   * A page of a candidate folder (languageFolderCandidate) says its language (its html lang): the folder is another language
   * of the site when that is the folder's own (de in blog/de) and not the crawl's; from then on its addresses are left out
   * (isOtherLanguage). A page in the crawl's language, or in a third, keeps the folder in (an IT section, /blog/it/, in
   * English); a page with no lang decides nothing, and the next page of the folder is asked. True when it is left out.
   */
  confirmLanguageFolder(language: Language, folder: string, lang: string | null): boolean {
    const own = language?.lang ?? language?.prefix;
    const said = lang?.trim();
    if (!own || !said) return false;
    const other = primaryLanguage(said) === primaryLanguage(folder) && primaryLanguage(said) !== primaryLanguage(own);
    this.#folderDecided.set(folder, other);
    if (other) this.#otherLocales.add(folder);
    return other;
  }

  /** True for a link into another language of the site (once the start page's language is known). */
  isOtherLanguage(language: Language, url: string): boolean {
    if (!language) return false;
    const folder = localeFolder(url);
    if (folder && this.#folderDecided.get(folder)) return true;
    const segment = localeSegment(url);
    if (!segment) return false;
    const other = language.prefix
      ? segment !== language.prefix
      : // English at the root: /fr/ is another language, /en-us/ a country site
        this.#otherLocales.has(segment) || segment.includes('-') || (language.lang !== null && primaryLanguage(segment) !== primaryLanguage(language.lang));
    if (other) this.#otherLocales.add(segment);
    return other;
  }
}
