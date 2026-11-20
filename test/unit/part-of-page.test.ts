/** isPagePart (src/crawl/part-of-page.ts, G-377): an HTML answer with no document around it is a part of a page, not a page. */
import { describe, expect, it } from 'vitest';
import { isPagePart } from '../../src/crawl/part-of-page.js';

describe('isPagePart', () => {
  it("is true for the-internet's /infinite_scroll/N: paragraphs and a link, nothing of a document", () => {
    expect(isPagePart("<br />Aut est vel nam facere.    <a href='/infinite_scroll/19'>next page</a>")).toBe(true);
    expect(isPagePart('<div class="item">One</div><div class="item">Two</div>')).toBe(true);
  });

  it('is false for a page with any of a doctype, html, head, body or title, in any case', () => {
    for (const html of ['<!doctype html><p>x</p>', '<!DOCTYPE html>\n<p>x</p>', '<html><p>x</p></html>', '<HTML lang="en"><p>x</p>', '<head><meta charset="utf-8"></head><p>x</p>', '<body>x</body>', '<title>Hello</title><p>x</p>', '<html\n>x', '<html/>']) {
      expect(isPagePart(html), html).toBe(false);
    }
  });

  it("is false for a bare frameset, the-internet's /nested_frames: a page of frames is a page (the first rebuild of 2026-11-04 left it out)", () => {
    expect(isPagePart('<frameset frameborder="1" rows="50%,50%">\n  <frame src="/frame_top" name="frame-top">\n</frameset>')).toBe(false);
  });

  it('is not fooled by tags whose names start the same: header, headline, bodyguard, titles', () => {
    expect(isPagePart('<header>Top</header><p>x</p>')).toBe(true);
    expect(isPagePart('<headline>x</headline><bodyguard>y</bodyguard><titles>z</titles>')).toBe(true);
  });

  it('is false for an empty answer: nothing says it is a part of anything', () => {
    expect(isPagePart('')).toBe(false);
    expect(isPagePart('  \n ')).toBe(false);
  });
});
