/**
 * Reader: what a page's markup says to a phone, a screen reader and a search engine, for the audit
 * (docs/AUDIT-RESEARCH.md, batch 1): its language, viewport and description; the links, buttons and
 * fields a screen reader has no name for; images with no alt or no address; links to a part of
 * the page that is not there; text left from building the site; the copyright year. It records what
 * a visitor could see; whether any of it is wrong is the audit's to say (src/group/findings.ts). What runs in the page is
 * collectMarkup (src/pages/markup-reading.ts), set by READING_SCRIPT as `__suiteBuilderMarkup`: an audit test runs the same text
 * (READER_SCRIPT, G-749 slice 3).
 */
import type { Page } from 'playwright';
import { H } from '../../leaf/heuristics/suite.js';
import { READING_SCRIPT } from '../reading-script.js';
import type { CrawledPage, PageMarkup } from '../../leaf/report.js';

/** The page's markup, into its report entry. */
export async function readMarkup(page: Page, entry: CrawledPage): Promise<void> {
  const markup = (await page.evaluate(`(() => { ${READING_SCRIPT}; return __suiteBuilderMarkup(${H.MARKUP_SAMPLE}); })()`).catch(() => null)) as PageMarkup | null;
  if (markup) entry.markup = markup;
}
