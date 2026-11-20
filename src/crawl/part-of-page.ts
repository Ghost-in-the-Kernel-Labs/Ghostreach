/**
 * A part of a page, not a page (TODO.md item 89, box 9): an HTML answer with nothing of a document around it,
 * no doctype, html, head, body, title or frameset. A page that fills itself as it is scrolled asks for its next part at
 * such an address, and leaves a link to it its script hides (the-internet's /infinite_scroll: /infinite_scroll/2
 * is a few paragraphs and a "next page" link). Opened alone it is that part, bare, with a link to the next: the
 * crawl followed thirty of them as thirty pages. It records the first as not crawled, `page-part`, and goes no further.
 */
// Decision: G-377
export function isPagePart(html: string): boolean {
  return html.trim() !== '' && !/<(!doctype|html|head|body|title|frameset)[\s>/]/i.test(html);
}
