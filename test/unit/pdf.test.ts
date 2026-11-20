/**
 * The review's PDF (TODO 2.3): src/pdf/pdf.ts prints the audit page at US Letter (GR-006) with its colours, contextual alternates
 * off, in the browser it is given, closing only what it opened; and test/support/pdf-text.ts, the reader the crawl spec checks the
 * real PDF with, read over PDFs built here byte by byte (the real Chromium's PDF is the spec's: test/crawl/ghostreach.spec.ts).
 */
import { deflateSync } from 'node:zlib';
import type { Browser } from 'playwright';
import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, PRINT_CSS, printPdf } from '../../src/pdf/pdf.js';
import { COVER_CSS, FOOTER_TEMPLATE, HEADER_TEMPLATE, MARGIN, coverHtml } from '../../src/pdf/brand.js';
import { pdfName } from '../../src/project/review.js';
import { pdfPages, squeezed } from '../support/pdf-text.js';

const COVER = { site: 'x', date: '2026-11-14' };

/** A browser that records what is asked of it. */
function fakeBrowser() {
  const calls: string[] = [];
  const page = {
    goto: async (url: string) => void calls.push(`goto ${url}`),
    addStyleTag: async (tag: { content: string }) => void calls.push(`style ${tag.content}`),
    evaluate: async (_fn: unknown, html: string) => void calls.push(`first ${html}`),
    pdf: async (options: object) => void calls.push(`pdf ${JSON.stringify(options)}`),
    close: async () => void calls.push('page closed'),
  };
  const browser = { newPage: async () => page, close: async () => void calls.push('browser closed') };
  return { calls, browser: browser as unknown as Browser };
}

describe('printPdf (GR-006)', () => {
  it('prints the page at US Letter, backgrounds on, after the print style and the cover, the footer on, and leaves a browser it was given open', async () => {
    const { calls, browser } = fakeBrowser();
    await printPdf('/data/x/AUDIT.html', '/data/x/x site review.pdf', COVER, browser);
    expect(PAGE_SIZE).toBe('Letter');
    expect(calls).toEqual([
      'goto file:///data/x/AUDIT.html',
      `style ${PRINT_CSS}\n${COVER_CSS}`,
      `first ${coverHtml(COVER)}`,
      `pdf ${JSON.stringify({ path: '/data/x/x site review.pdf', format: 'Letter', printBackground: true, margin: MARGIN, displayHeaderFooter: true, headerTemplate: HEADER_TEMPLATE, footerTemplate: FOOTER_TEMPLATE })}`,
      'page closed',
    ]);
  });
  it('turns contextual alternates off, so a hyphen beside capitals is a hyphen in the PDF\'s text, and keeps a heading with what follows it', () => {
    expect(PRINT_CSS).toBe('*{font-variant-ligatures:no-contextual}h2,h3,summary{break-after:avoid}');
  });
  it('closes the page when printing fails', async () => {
    const { calls, browser } = fakeBrowser();
    const failing = { ...(await browser.newPage()), pdf: async () => Promise.reject(new Error('no room')) };
    await expect(printPdf('/a/AUDIT.html', '/a/b.pdf', COVER, { newPage: async () => failing } as unknown as Browser)).rejects.toThrow('no room');
    expect(calls.at(-1)).toBe('page closed');
  });
  it('names the PDF for the prospect: the site and what it is, nothing of ours', () => {
    expect(pdfName('www.example.com')).toBe('www.example.com site review.pdf');
    expect(pdfName('example.com')).not.toMatch(/ghostreach|audit/i);
  });
});

/** A PDF of the given objects (1-based), a stream as `{ dict, stream }`, deflated when `flate`; the catalogue is object 1. */
function pdf(objects: (string | { dict: string; stream: string; flate?: boolean })[]): Buffer {
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\n', 'latin1')];
  objects.forEach((o, i) => {
    if (typeof o === 'string') parts.push(Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1'));
    else {
      const body = o.flate ? deflateSync(Buffer.from(o.stream, 'latin1')) : Buffer.from(o.stream, 'latin1');
      parts.push(Buffer.from(`${i + 1} 0 obj\n<<${o.dict}${o.flate ? ' /Filter /FlateDecode' : ''} /Length ${body.length}>> stream\n`, 'latin1'), body, Buffer.from('\nendstream\nendobj\n', 'latin1'));
    }
  });
  parts.push(Buffer.from('trailer\n<</Root 1 0 R>>\n%%EOF\n', 'latin1'));
  return Buffer.concat(parts);
}

/** A ToUnicode CMap: one-byte codes, `A`..`Z` from 0x41 by range, `0` and `1` by an array, `-` at 0x01 by one entry. */
const ONE_BYTE_CMAP = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap
1 begincodespacerange <00> <FF> endcodespacerange
1 beginbfchar <01> <002D> endbfchar
2 beginbfrange <41> <5A> <0041> <30> <31> [<0030> <0031>] endbfrange
endcmap end end`;

describe('the tests\' PDF reader (test/support/pdf-text.ts)', () => {
  // A Type 3 font as Chromium writes one when it cannot embed the font: one-byte codes, widths in glyph units under a FontMatrix.
  const widths = Array.from({ length: 256 }, (_, c) => (c === 1 ? 300 : c === 0x30 || c === 0x31 ? 500 : c >= 0x41 && c <= 0x5a ? 600 : 0));
  const type3 = `<</Type /Font /Subtype /Type3 /FontMatrix [.001 0 0 -.001 0 0] /FirstChar 0 /LastChar 255 /Widths [${widths.join(' ')}] /ToUnicode 6 0 R>>`;

  it('reads each page\'s size, inherited from the page tree, and its text, glyph by glyph as Chromium places them', () => {
    // "SITE-01 A" on one line (a gap of a space before A), "BC" on the next: each glyph placed by Td from the last one's start.
    const content = 'BT /F1 10 Tf 1 0 0 -1 20 30 Tm <53> Tj 6 0 Td <49> Tj 6 0 Td <54> Tj 6 0 Td <45> Tj 6 0 Td <01> Tj 3 0 Td <30> Tj 5 0 Td <31> Tj 8 0 Td <41> Tj ET\nBT /F1 10 Tf 1 0 0 -1 20 50 Tm <42> Tj 6 0 Td <43> Tj ET';
    const file = pdf([
      '<</Type /Catalog /Pages 2 0 R>>',
      '<</Type /Pages /Kids [3 0 R 7 0 R] /Count 2 /MediaBox [0 0 612 792]>>',
      '<</Type /Page /Parent 2 0 R /Resources <</Font <</F1 5 0 R>>>> /Contents 4 0 R>>',
      { dict: '', stream: content, flate: true },
      type3,
      { dict: '', stream: ONE_BYTE_CMAP, flate: true },
      '<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 5 0 R>>>> /Contents [8 0 R 9 0 R]>>',
      { dict: '', stream: 'BT /F1 10 Tf 1 0 0 -1 20 30 Tm <4142> Tj' },
      { dict: '', stream: '[<43> -700 <44>] TJ ET', flate: true },
    ]);
    expect(pdfPages(file)).toEqual([
      { width: 612, height: 792, text: 'SITE-01 A\nBC' },
      { width: 595, height: 842, text: 'ABC D' },
    ]);
  });

  it('reads a Type 0 font\'s two-byte codes, its widths from /W, and a literal string with its escapes', () => {
    const cmap = '1 begincodespacerange <0000> <FFFF> endcodespacerange 2 beginbfchar <0003> <0067> <0004> <0028> endbfchar 1 beginbfrange <0010> <0011> <0068> endbfrange';
    const file = pdf([
      '<</Type /Catalog /Pages 2 0 R>>',
      '<</Type /Pages /Kids [3 0 R] /Count 1>>',
      '<</Type /Page /MediaBox [0 0 612 792] /Resources 4 0 R /Contents 5 0 R>>',
      '<</Font <</F2 6 0 R>>>>',
      { dict: '', stream: 'BT /F2 20 Tf 0 0 Td (\\000\\004\\000\\003\\000\\020) Tj 100 0 Td <0011> Tj ET', flate: true },
      '<</Type /Font /Subtype /Type0 /Encoding /Identity-H /DescendantFonts [7 0 R] /ToUnicode 8 0 R>>',
      '<</Type /Font /Subtype /CIDFontType2 /DW 0 /W [3 [500] 4 16 400]>>',
      { dict: '', stream: cmap, flate: true },
    ]);
    // The literal: (, g, h, each 20 * 0.4 or 0.5 wide; then i 100 along, well past where h ended: a space.
    expect(pdfPages(file)).toEqual([{ width: 612, height: 792, text: '(gh i' }]);
  });

  it('drops a code its font cannot name, and puts a line break where the pen goes back', () => {
    const file = pdf([
      '<</Type /Catalog /Pages 2 0 R>>',
      '<</Type /Pages /Kids [3 0 R] /Count 1>>',
      '<</Type /Page /MediaBox [0 0 612 792] /Resources <</Font <</F1 5 0 R>>>> /Contents 4 0 R>>',
      { dict: '', stream: 'BT /F1 10 Tf 1 0 0 -1 200 30 Tm <41FE42> Tj 1 0 0 -1 20 30 Tm <43> Tj ET' },
      type3,
      { dict: '', stream: ONE_BYTE_CMAP },
    ]);
    expect(pdfPages(file)[0].text).toBe('AB\nC');
  });

  it('squeezes a page\'s line breaks for matching a heading that wrapped', () => {
    expect(squeezed('  SITE-29 The site publishes\nno security.txt ')).toBe('SITE-29 The site publishes no security.txt');
  });
});
