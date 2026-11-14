/**
 * The review as a PDF (TODO 2.3, REV-06): the audit page printed by the Playwright Chromium the crawl reads with (RF-03: no new
 * dependency), at the one page size (GR-006), its colours kept, with 2.4's brand: a cover page first and the address in a footer
 * on every page (src/pdf/brand.ts); 2.6: "What this review checked", the catalogue's list, open and last (`printLayout`).
 */
import { pathToFileURL } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { COVER_CSS, FOOTER_TEMPLATE, HEADER_TEMPLATE, MARGIN, coverHtml, type Cover } from './brand.js';

/** The one page size of every PDF; the salesperson picks nothing. */
// Decision: GR-006
export const PAGE_SIZE = 'Letter';

/**
 * Added to the page before it is printed: contextual alternates off, so the PDF's text is the page's. With them on, a font such as
 * Inter draws the hyphen and the parentheses beside capitals and figures as alternate glyphs the PDF can only name by private-use
 * code points, so "SITE-02" searched for or copied out of the PDF does not read "SITE-02". The page looks the same.
 */
export const PRINT_CSS = '*{font-variant-ligatures:no-contextual}h2,h3,summary{break-after:avoid}';

/**
 * The page laid out for print, run in the page before it is printed (TODO 2.4, 2.6): the cover `first` put first; "What this
 * review checked" moved after the last finding, so it closes the PDF, its list of checks open, since a closed `<details>` prints
 * only its summary. The page on screen keeps it after the counts, closed (AUDIT.html stays 1.6's). Self-contained: Playwright
 * sends its source to the page.
 */
// Decision: G-637
function printLayout(first: string): void {
  document.body.insertAdjacentHTML('afterbegin', first);
  const checked = document.querySelector('section.checked');
  if (!checked) return;
  checked.querySelector('details')?.setAttribute('open', '');
  const footer = document.querySelector('main > footer');
  if (footer) footer.before(checked);
  else checked.parentElement?.append(checked);
}

/**
 * Prints the audit page at `html` to the PDF at `out`, the cover naming `cover`'s site and day first; with `browser` (tests), in a
 * page of it, else in a Chromium of its own.
 */
export async function printPdf(html: string, out: string, cover: Cover, browser?: Browser): Promise<void> {
  const own = browser ?? (await chromium.launch());
  try {
    const page = await own.newPage();
    try {
      await page.goto(pathToFileURL(html).href);
      await page.addStyleTag({ content: `${PRINT_CSS}\n${COVER_CSS}` });
      await page.evaluate(printLayout, coverHtml(cover));
      await page.pdf({
        path: out, format: PAGE_SIZE, printBackground: true, margin: MARGIN,
        displayHeaderFooter: true, headerTemplate: HEADER_TEMPLATE, footerTemplate: FOOTER_TEMPLATE,
      });
    } finally {
      await page.close();
    }
  } finally {
    if (!browser) await own.close();
  }
}
