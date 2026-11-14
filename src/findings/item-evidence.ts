// The evidence of one item a finding's line names, split out of types.ts so the model's working set stays under SRC-17.

/**
 * The evidence of one item a finding's line names (G-748, G-749; docs/AUDIT-TESTS-PLAN.md part 1a): what the crawl saw of it, as
 * plain observation, from which the audit's test re-checks it. `key` names the item alike across crawls (an address of the site
 * by its path and query, signed in as a role said first; another address whole; an IP itself; the site's http address `http`;
 * a header by its name; the sitemap `missing`, an address it lists by its path; security.txt `security.txt`; the certificate
 * `expiry`, `name` or `trust`; the site's other name by its origin; a markup sample by markupKey, a page's own markup by its path):
 * nothing in it depends on order, counts or dates. Kept out of the grouping's report (findings.ts, `defectsOf`): only a build
 * with --audit reads it, from the crawl. A line with none (a finding no test re-checks, or a line no test can tell) makes no test.
 */
export type ItemEvidence =
  /** One address asked, redirects not followed: what it answered first (null: nothing), where it sent (`to`), the first pages linking to it (`from`, at most five) and how many more. */
  | { at: 'address'; key: string; url: string; status: number | null; to?: string; from?: string[]; more?: number }
  /** One of the addresses the site's name points to, tried for a connection. */
  | { at: 'ip'; key: string; host: string; ip: string; family: 4 | 6 }
  /** An address the crawl reached through redirects, each the server's (SITE-18): how many. */
  | { at: 'redirects'; key: string; url: string; hops: number }
  /** A response header of one page: absent (SITE-24, `header` its name, lower case) or what it said (SITE-25, `value`). */
  | { at: 'header'; key: string; url: string; header: string; value?: string }
  /**
   * A file the site publishes (SITE-28's sitemap, SITE-29's security.txt), or a page read whole (SITE-12): what it answered; `lists`,
   * an address it lists that is broken or moved; `canonical`, the address the page's canonical link names.
   */
  | { at: 'file'; key: string; url: string; status: number | null; lists?: string; noContact?: true; canonical?: string }
  /** The site's certificate (SITE-26): its end date, or the name or the trust a browser refuses it for. */
  | { at: 'certificate'; key: string; host: string; port: number; what: 'expiry' | 'name' | 'trust'; validTo: string }
  /**
   * What the markup reader names on some pages (G-749 slice 4): a sample as the crawler said it (`said`; null for the page's
   * own `lang` or main headings, `h1`, with how many it has with words, `headings`, when any), and the pages a visitor opens that
   * show it, in crawl order (a role's left out). Slice 5: a page's title or description shared (`said` its words) or none, its
   * viewport and copyright year (`value`, what the crawl read), an error its scripts threw and an address asked over plain http (`said`).
   */
  | { at: 'markup'; key: string; read: MarkupRead; said: string | null; pages: string[]; headings?: number; value?: string };

/**
 * What the readers name that an audit test reads again (src/pages/reader-page.ts): a sample of PageMarkup's (`placeholder`, SITE-10's
 * excerpt, too), the page's language or main headings, its title (`title`, said; `untitled`), its description (`description`, said;
 * `undescribed`), its viewport and copyright year, the errors its scripts threw while it loaded (`errors`), and the addresses it asks
 * over plain http (`insecure`).
 */
export type MarkupRead = 'unnamed' | 'unlabelled' | 'placeholderOnly' | 'noAlt' | 'noSrc' | 'deadAnchors' | 'lang' | 'h1' | 'placeholder' | 'title' | 'untitled' | 'description' | 'undescribed' | 'viewport' | 'copyright' | 'errors' | 'insecure';
