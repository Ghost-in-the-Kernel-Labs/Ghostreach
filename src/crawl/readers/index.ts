/**
 * The readers: each reads one kind of fact from a loaded page (docs/STRATEGIES-PLAN.md). A new kind
 * of fact (the frames on a page, its forms) is a new entry in one of the two tables below.
 *
 * Readers record; they decide nothing about the suite, and nothing about which page comes next.
 */
import type { Page } from 'playwright';
import type { Fingerprint } from '../../leaf/pages/fingerprint.js';
import { H } from '../../leaf/heuristics/suite.js';
import { firstLine } from '../error-line.js';
import type { CrawledPage } from '../../leaf/report.js';
import { CONSENT_SELECTORS, consentBannerOn } from './consent.js';
import { readControls } from './controls.js';
import { collectHeadingsOf, unseenHeadings } from './headings.js';
import { anchorsOf, readLinks, type RawLink } from './links.js';
import { readShape } from './shape.js';
import { markCredentials } from '../../leaf/pages/credential-text.js';
import { readStructure } from './structure.js';
import { readFrames } from './frames.js';
import { readMarkup } from './markup.js';
import { readSeen } from './seen.js';
import { recordedWords } from '../../leaf/pages/recorded.js';

export { readCanonical } from './canonical.js';
export { decideLanguage, readLanguage } from './language.js';
export { linkEdge, type RawLink } from './links.js';
export { readShownImages } from './images.js';

/** What the readers of one page share: what the crawl gives them, and what each leaves for the crawl. */
export interface ReadContext {
  /** The site's origin (a frame elsewhere is recorded, not read). */
  origin: string;
  /** Left by the identity readers: the page's shape, and the cookie banner's accept button. */
  fingerprint?: Fingerprint;
  bannerButton: string | null;
  /** Left by the content readers: the page's links, for the report's edges and the next pages. */
  links: RawLink[];
}

/** One reader: one kind of fact from the loaded page into its report entry, or into the context. */
type Read = (page: Page, entry: CrawledPage, ctx: ReadContext) => Promise<void>;

/**
 * A reader and its name (G-659): the name is the file it reads with, `src/crawl/readers/<name>.ts`, or `title`, read here, so an
 * error in a page's `readerErrors` says which component met it ("... (the headings reader)"). test/unit/reader-names.test.ts
 * holds every name to a file.
 */
export interface Reader {
  name: string;
  read: Read;
}

/**
 * What the page is, in this order: its title, its headings (the cookie banner looked for each time, so
 * its headings are never taken for the page's), its structure, and its shape. They run first, as the
 * page settles: the crawl then judges the page by them (same content, something new) before reading
 * what is on it.
 */
export const IDENTITY_READERS: Reader[] = [
  {
    name: 'title',
    read: async (page, entry) => {
      // Marked here, where it is first read: it goes on into the sign-in form's evidence and the log (TODO 71).
      entry.title = markCredentials((await page.title()).replace(/\s+/g, ' ').trim());
    },
  },
  {
    name: 'headings',
    read: async (page, entry, ctx) => {
      const { headings, skipped } = await collectHeadingsOf(page);
      const banner = await consentBannerOn(page, CONSENT_SELECTORS);
      Object.assign(entry, unseenHeadings(headings, skipped, banner?.headings ?? []));
      ctx.bannerButton = banner?.selector ?? null;
    },
  },
  { name: 'structure', read: async (page, entry) => readStructure(page, entry) },
  {
    name: 'shape',
    read: async (page, entry, ctx) => {
      ctx.fingerprint = await readShape(page);
      entry.fingerprint = ctx.fingerprint;
    },
  },
];

/**
 * What is on the page, in this order: its links, its controls, its frames, its markup for the audit. A reader of a new kind of fact goes here (a login form, from the controls
 * already read: docs/LOGIN-PLAN.md).
 */
export const CONTENT_READERS: Reader[] = [
  {
    name: 'links',
    read: async (page, entry, ctx) => {
      ctx.links = await readLinks(page);
      // In-page anchors (TODO 111): of the links the crawl keeps (H.LINKS_PER_PAGE_MAX), as their edges are.
      const anchors = anchorsOf(ctx.links.slice(0, H.LINKS_PER_PAGE_MAX));
      if (anchors.length) entry.anchors = anchors;
    },
  },
  {
    name: 'controls',
    read: async (page, entry) => {
      const controls = await readControls(page);
      if (controls.length > 0) entry.controls = controls;
    },
  },
  {
    name: 'frames',
    read: async (page, entry, ctx) => {
      const frames = await readFrames(page, ctx.origin);
      if (frames.length) entry.frames = frames;
    },
  },
  { name: 'markup', read: async (page, entry) => readMarkup(page, entry) },
  // Last, the browser's own list beside what the readers recorded (G-222): each one they missed, with where it lives.
  {
    name: 'seen',
    read: async (page, entry, ctx) => {
      const { seen, incomplete } = await readSeen(page, recordedWords(entry.controls, ctx.links.map((l) => ({ text: l.text, to: l.resolved })), entry.frames, entry.finalUrl));
      if (seen) entry.seen = seen;
      if (incomplete) entry.seenIncomplete = incomplete;
    },
  },
];

/** Runs readers in their order. */
// Decision: G-147
export async function runReaders(readers: readonly Reader[], page: Page, entry: CrawledPage, ctx: ReadContext): Promise<void> {
  for (const { name, read } of readers) {
    try {
      await read(page, entry, ctx);
    } catch (error) {
      // One reader's failure is the page's, never the crawl's (Fable's review, B3): a page that navigates
      // itself mid-read destroys what the readers were reading. What the others read is kept; this is said,
      // with the reader that met it (G-659), in words a person reads too: the build's summary and the suite's crawl/README.md show it.
      const why = `${firstLine(error).slice(0, 200)} (the ${name} reader)`;
      if (!entry.readerErrors?.includes(why)) entry.readerErrors = [...(entry.readerErrors ?? []), why];
    }
  }
}
