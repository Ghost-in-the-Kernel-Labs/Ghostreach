/**
 * Offline, the other hosts the pages asked while rendered (G-333, G-335; state.ts, CrawlState, which delegates here and keeps
 * whether the crawl is offline). Moved out of state.ts by what it does, for the 400-line target (C-022, C-023, J-014): the
 * body is the parent's, the site's origin passed in where it read CrawlState's own.
 */
import { H } from '../leaf/heuristics/suite.js';

export class OtherHosts {
  /** host -> resource types in the order seen, count, and the first page. */
  readonly #pageHosts = new Map<string, { types: string[]; count: number; page: string }>();
  /** Hosts the pages asked past H.OTHER_HOSTS_MAX, counted and not kept (a host asked twice past the cap counts twice). */
  #pageHostsLeft = 0;

  /** Mutable for the report (state-report.ts); CrawlState hands the crawl a read-only view. */
  get pageHosts(): Map<string, { types: string[]; count: number; page: string }> {
    return this.#pageHosts;
  }
  get pageHostsLeft(): number {
    return this.#pageHostsLeft;
  }

  /**
   * A request a page made to a host other than the site's (`origin`), kept (host, resource type, count, the first page)
   * and let go. Web addresses only; at most H.OTHER_HOSTS_MAX hosts, so a page naming hosts without end ends its list.
   */
  note(origin: string, url: string, type: string, page: string): void {
    let host: string;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
      if (parsed.hostname === new URL(origin).hostname) return;
      host = parsed.host;
    } catch {
      return;
    }
    const known = this.#pageHosts.get(host);
    if (known) {
      known.count++;
      if (!known.types.includes(type)) known.types.push(type);
    } else if (this.#pageHosts.size < H.OTHER_HOSTS_MAX) this.#pageHosts.set(host, { types: [type], count: 1, page });
    else this.#pageHostsLeft++;
  }
}
