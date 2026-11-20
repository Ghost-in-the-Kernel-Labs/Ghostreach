/** Small crawl reports for the review's catalogue tests (G-637): a page, and a report of pages with what else the crawl recorded. */
import type { CrawledPage, CrawlReport } from '../../src/leaf/report.js';

export const ORIGIN = 'https://shop.test';
export const DAY = new Date('2026-10-03T12:00:00Z');

/** A page that answered, as the crawler records it, with the markup reader's output and the title and heading structure. */
export const page = (path: string, status: number | null = 200, more: Partial<CrawledPage> = {}): CrawledPage =>
  ({ url: `${ORIGIN}${path}`, finalUrl: `${ORIGIN}${path}`, status, redirects: [], title: path, contentType: 'text/html', depth: 1, fingerprint: { hash: path, paths: ['div'] }, headings: [path], structure: { h1: [path], main: true }, markup: { lang: 'en', viewport: 'width=device-width', description: path }, ...more }) as CrawledPage;

/** A report of pages, with what else the crawl recorded (`site`, `robots`, `notFound`, `addresses`, `signIns`). */
export const report = (pages: CrawledPage[], more: Partial<CrawlReport> = {}): CrawlReport =>
  ({ startUrl: `${ORIGIN}/`, origin: ORIGIN, options: { userAgent: 'x' }, stopReason: 'complete', notCrawled: [], robots: { status: 200, source: 'parsed' }, pages, edges: pages.slice(1).map((p) => ({ from: `${ORIGIN}/`, to: p.url })), ...more }) as unknown as CrawlReport;
