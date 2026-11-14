/**
 * What the shipped package must not say of where its code came from (J-052, J-053): the markers of the lineage, and the few
 * strings that carry one on purpose, each with its reason. `test/crawl/package.spec.ts` holds the packed tarball to it; the
 * build drops every comment (`tsconfig.build.json`, `removeComments`), so what is left is strings and names.
 */
import { PIN } from './pin.js';

/** Each marker, named for the report: a decision or journal id, the pin, the cut's documents and words, the parent's layout. */
const MARKERS: readonly [string, RegExp][] = [
  ['a decision id of the parent (G-nnn)', /\bG-\d{3}\b/g],
  ['a Ghostreach decision id (GR-nnn)', /\bGR-\d{3}\b/g],
  ['a Ghost-Core contract id (C-0nn)', /\bC-0\d\d\b/g],
  ['a journal id (J-0nn)', /\bJ-0\d\d\b/g],
  ['the pin commit', new RegExp(`\\b${PIN || 'a4c8045'}`, 'g')],
  ['the cut list', /CUT\.md/g],
  ['the template', /Ghost-Core/gi],
  ["the parent's repository", /suite-builder/gi],
  ["the parent's name", /Suite ?Builder/g],
  ["the parent's layout", /src\/(kits|model)\b/g],
  ["the parent's model", /Suite IR/g],
  ['the parent named', /\bthe parent\b|\bparent's\b/gi],
  ['a word of the cut', /\bcopied from\b|\bcut from\b|\bcut out\b/gi],
  ["the parent's commands", /\bsuite (build|audit)\b/gi],
];

/** A string a shipped file may hold although a marker matches inside it, and why. */
export interface Allowed {
  file: string;
  text: string;
  why: string;
}

export const ALLOWED: readonly Allowed[] = [
  { file: 'dist/leaf/words.js', text: "'Prepared with Suite Builder, Ghost in the Kernel Labs'", why: 'the byline on the PDF cover and the page footer: the brand the prospect sees' },
  { file: 'dist/pdf/brand.js', text: '<div class="wordmark">Suite Builder</div>', why: "the PDF cover's wordmark" },
  { file: 'dist/audit/audit.js', text: '| Suite Builder`', why: "the review page's title" },
  { file: 'dist/audit/audit.js', text: "by Suite Builder's crawler in a real browser", why: 'the page says who read the site' },
  { file: 'dist/audit/audit.js', text: "Read by Suite Builder's crawler, which identifies itself", why: "the page's footer" },
  { file: 'dist/cli/main.js', text: 'writes its Suite Builder PDF', why: 'the salesperson is told whose PDF it writes' },
  { file: 'dist/leaf/report.js', text: "'SuiteBuilder'", why: 'the product token a robots.txt addresses the crawler by, as the footer says' },
  { file: 'dist/leaf/report.js', text: 'Ghost-in-the-Kernel-Labs-suite-builder-docs)', why: "the crawler's address in its user agent, which a site's owner reads in a log" },
  { file: 'dist/leaf/pages/url.js', text: '`/suite-builder-no-such-page-', why: "the address the crawler asks a site for to see its not-found page, under the crawler's name" },
  { file: 'dist/crawl/state-report.js', text: "tool: 'suite-builder'", why: "the crawl file's format mark, which the golden crawls carry" },
  { file: 'dist/crawl/report-read.js', text: "report?.tool !== 'suite-builder'", why: "the crawl file's format mark, read back" },
  { file: 'dist/crawl/report-read.js', text: 'was made by a newer Suite Builder (', why: "the reader's refusal of a newer crawl file, in the brand's name" },
  { file: 'dist/crawl/report-read.js', text: 'Update Suite Builder, or crawl', why: "the same refusal's fix" },
  { file: 'dist/crawl/trackers.js', text: 'on links copied from its posts', why: "Facebook's link redirect, not the lineage" },
];

/** Every marker in a shipped file not inside one of its allowed strings, as `<file>: <marker> "<match>"`. */
export function leaks(files: readonly { path: string; text: string }[], allowed: readonly Allowed[] = ALLOWED): string[] {
  return files.flatMap(({ path, text }) => {
    const covered = allowed
      .filter((a) => a.file === path)
      .flatMap((a) => [...text.matchAll(new RegExp(a.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].map((m) => [m.index, m.index + a.text.length]));
    return MARKERS.flatMap(([name, marker]) =>
      [...text.matchAll(marker)]
        .filter((m) => !covered.some(([from, to]) => m.index >= from && m.index + m[0].length <= to))
        .map((m) => `${path}: ${name} "${m[0]}"`),
    );
  });
}

/** Each allowed string its file no longer holds: an entry kept past its use. */
export const unused = (files: readonly { path: string; text: string }[], allowed: readonly Allowed[] = ALLOWED): string[] =>
  allowed.filter((a) => !files.find((f) => f.path === a.file)?.text.includes(a.text)).map((a) => `${a.file}: "${a.text}"`);
