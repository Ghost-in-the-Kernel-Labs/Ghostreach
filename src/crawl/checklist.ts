/**
 * The recrawl's checklist (docs/CRAWL-HISTORY-PLAN.md, step 3; theGhost.md, G-090): when a site is
 * crawled again for a suite, the pages the previous crawl read are asked for first, before any new
 * page. So two crawls read the same pages rather than two samples. A page the recrawl does not reach (the budget, a 429) is left over, "not read",
 * never "gone" (IR-012).
 *
 * It wraps the frontier (frontier.ts), which picks every page after them: the crawl loop asks it for
 * the next page as before.
 */
import { holdsSecret } from '../leaf/pages/saved-secrets.js';
import { pageKey, roleOf, sameOrigin, withoutRole } from '../leaf/pages/url.js';
import type { Frontier, FrontierItem, Leftover } from './frontier.js';
import type { CrawlReport, NotCrawledReason } from '../leaf/report.js';

export class Checklist {
  private readonly queue: FrontierItem[] = [];

  private readonly log: (message: string) => void;

  /**
   * A previous page the crawl would not follow a link to now (`refusal`: out of its scope,
   * disallowed by robots.txt, a link that adds to a cart) is not asked for again; `skip` records why
   * (G-178). `seen` records the pages queued, so a link to one is not
   * queued twice.
   */
  // Decision: G-176
  constructor(
    private readonly frontier: Frontier,
    options: {
      previous?: CrawlReport;
      log: (message: string) => void;
      seen: (key: string) => void;
      skip: (url: string, reason: NotCrawledReason) => void;
      /** Why a link to it would not be followed now, the crawl's own rules (refusals.ts, refusalOf); null: it would. */
      refusal: (url: string) => NotCrawledReason | null;
      /** The site crawled now: a previous page elsewhere (the site moved) is not this crawl's to read. */
      origin: string;
      /** The role this crawl reads as; null signed out. A previous page read as another is not this crawl's to read (G-176). */
      role?: string | null;
    },
  ) {
    this.log = options.log;
    const elsewhere = (options.previous?.pages ?? []).filter((page) => !sameOrigin(page.url, options.origin));
    if (elsewhere.length) this.log(`The previous crawl read ${elsewhere.length} page${elsewhere.length === 1 ? '' : 's'} of ${new URL(elsewhere[0].url).origin}, not this site: not read again.`);
    // Its own role's pages only, at their plain address: the crawl keys pages so, and marks them when done (G-157).
    const role = options.role ?? null;
    // An address written with its token masked (G-480) is no address to ask for: the live link, found again, carries its own.
    const masked = (options.previous?.pages ?? []).filter((p) => holdsSecret(withoutRole(p.url)));
    if (masked.length) this.log(`${masked.length} page${masked.length === 1 ? '' : 's'} of the previous crawl had a token in the address, masked when written: found again by the links, not asked for.`);
    const queued = new Set<string>();
    for (const page of (options.previous?.pages ?? []).filter((p) => sameOrigin(p.url, options.origin) && roleOf(p.url) === role && !masked.includes(p))) {
      const url = withoutRole(page.url);
      const key = pageKey(url);
      if (queued.has(key)) continue;
      queued.add(key);
      const refused = options.refusal(url);
      if (refused) options.skip(url, refused);
      else this.queue.push({ url, depth: page.depth });
      options.seen(key);
    }
    if (this.queue.length) this.log(`Reading the ${this.queue.length} page${this.queue.length === 1 ? '' : 's'} of the previous crawl first, then looking further.`);
  }

  /** Whether the crawl may stop because pages stopped teaching it (`saturated`): never while the previous crawl's pages wait, nor while a page of the site's menu does (G-674). */
  stopsEarly(saturated: boolean): boolean {
    return saturated && this.queue.length === 0 && !this.frontier.menuWaiting;
  }

  /**
   * The next page to read: the previous crawl's, in its order, then the frontier's pick; once the crawl is `saturated`, a page of
   * the site's menu still waiting first (G-674).
   */
  next(saturated = false): FrontierItem | undefined {
    return this.queue.shift() ?? (saturated ? this.frontier.nextMenu() : undefined) ?? this.frontier.next();
  }

  /** Pages still to read, the previous crawl's included. */
  get size(): number {
    return this.queue.length + this.frontier.size;
  }

  add(item: FrontierItem): void {
    this.frontier.add(item);
  }

  recordLinks(from: string, to: Iterable<string>): void {
    this.frontier.recordLinks(from, to);
  }

  recordSample(...args: Parameters<Frontier['recordSample']>): void {
    this.frontier.recordSample(...args);
  }

  /** Pages never read: the previous crawl's left over first (not read, never gone), then the frontier's. */
  leftovers(): Leftover[] {
    return [...this.queue.map((item) => ({ url: item.url, settled: false, sampled: false, menu: this.frontier.isMenu(item.url) })), ...this.frontier.leftovers()];
  }}
