/**
 * Is the crawl still learning? Ghost (2026-09-29): a crawl should stop when the site stops teaching
 * it anything, not at a fixed count. A page is new when its shape is unlike every shape met so far
 * (SHAPES_AGREE, the grouping's own test) or its address pattern is new (/careers/*, /blog/*): a
 * site builder draws every page in one shape, so the shape alone would stop its crawl too soon.
 * After SATURATION_PAGES pages in a row with nothing new, the crawl is saturated.
 */
import type { Fingerprint } from '../leaf/pages/fingerprint.js';
import { likeness, SHAPES_AGREE } from '../leaf/pages/similarity.js';
import { urlPattern } from '../leaf/pages/url.js';

export class Discovery {
  private readonly shapes: Fingerprint[] = [];
  private readonly patterns = new Set<string>();
  /** The page numbers (1 for the first page read) where something new was met. */
  readonly newAt: number[] = [];
  private quiet = 0;

  /** `patience`: pages in a row with nothing new before the crawl is saturated; 0 never is (--long). */
  constructor(private readonly patience: number) {}

  /** Records the page read as number `n`; true when it taught something new. */
  // Decision: G-022
  see(n: number, url: string, fingerprint: Fingerprint): boolean {
    const pattern = urlPattern(url);
    const sample = (f: Fingerprint) => ({ url, fingerprint: f, headings: [] });
    const newShape = !this.shapes.some((f) => likeness(sample(f), sample(fingerprint)).shape >= SHAPES_AGREE);
    const newPattern = !this.patterns.has(pattern);
    if (newShape) this.shapes.push(fingerprint);
    this.patterns.add(pattern);
    if (newShape || newPattern) {
      this.newAt.push(n);
      this.quiet = 0;
      return true;
    }
    this.quiet++;
    return false;
  }

  get saturated(): boolean {
    return this.patience > 0 && this.quiet >= this.patience;
  }
}
