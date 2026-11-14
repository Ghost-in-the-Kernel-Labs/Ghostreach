/**
 * Reader: the page's structure, what proves a page loaded whatever its words say (Reviewer E's
 * generated-suite plan, phase 7): the main headings (h1) a visitor sees, and whether a main region
 * (<main>, role="main") is shown. A copy edit changes a heading's words, not that there is one. What runs in the page is
 * collectStructure (src/pages/structure-reading.ts), set by READING_SCRIPT as `__forecursorStructure`: an audit test runs the
 * same text (READER_SCRIPT, G-749 slice 3).
 */
import type { Page } from 'playwright';
import { READING_SCRIPT } from '../reading-script.js';
import type { CrawledPage } from '../../leaf/report.js';

/** The page's structure, into its report entry. */
export async function readStructure(page: Page, entry: CrawledPage): Promise<void> {
  entry.structure = (await page.evaluate(`(() => { ${READING_SCRIPT}; return __forecursorStructure(); })()`)) as { h1: string[]; main: boolean };
}
