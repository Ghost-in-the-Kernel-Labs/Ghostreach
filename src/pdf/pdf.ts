/**
 * The review as a PDF (TODO 2.3, REV-06): the audit page printed by the Playwright Chromium the crawl reads with (RF-03: no new
 * dependency), at the one page size (GR-006), its colours kept. The cover page and the running footer are 2.4's.
 */
import { pathToFileURL } from 'node:url';
import { chromium, type Browser } from 'playwright';

/** The one page size of every PDF; the salesperson picks nothing. */
// Decision: GR-006
export const PAGE_SIZE = 'Letter';

/**
 * Added to the page before it is printed: contextual alternates off, so the PDF's text is the page's. With them on, a font such as
 * Inter draws the hyphen and the parentheses beside capitals and figures as alternate glyphs the PDF can only name by private-use
 * code points, so "SITE-02" searched for or copied out of the PDF does not read "SITE-02". The page looks the same.
 */
export const PRINT_CSS = '*{font-variant-ligatures:no-contextual}';

/** Prints the audit page at `html` to the PDF at `out`; with `browser` (tests), in a page of it, else in a Chromium of its own. */
export async function printPdf(html: string, out: string, browser?: Browser): Promise<void> {
  const own = browser ?? (await chromium.launch());
  try {
    const page = await own.newPage();
    try {
      await page.goto(pathToFileURL(html).href);
      await page.addStyleTag({ content: PRINT_CSS });
      await page.pdf({ path: out, format: PAGE_SIZE, printBackground: true });
    } finally {
      await page.close();
    }
  } finally {
    if (!browser) await own.close();
  }
}
