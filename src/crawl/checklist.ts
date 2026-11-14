/**
 * The crawl's checklist: it wraps the frontier (frontier.ts), which picks every page, and says when the crawl may stop
 * early. The parent's recrawl read a previous crawl's pages first here (G-090); a review is never a recrawl (GR-003), so
 * the frontier's pick is the only one.
 */
import type { Frontier, FrontierItem, Leftover } from './frontier.js';

export class Checklist {
  constructor(private readonly frontier: Frontier) {}

  /** Whether the crawl may stop because pages stopped teaching it (`saturated`): never while a page of the site's menu waits (G-674). */
  stopsEarly(saturated: boolean): boolean {
    return saturated && !this.frontier.menuWaiting;
  }

  /** The next page to read: the frontier's pick; once the crawl is `saturated`, a page of the site's menu still waiting first (G-674). */
  next(saturated = false): FrontierItem | undefined {
    return (saturated ? this.frontier.nextMenu() : undefined) ?? this.frontier.next();
  }

  /** Pages still to read. */
  get size(): number {
    return this.frontier.size;
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

  /** Pages never read. */
  leftovers(): Leftover[] {
    return this.frontier.leftovers();
  }
}
