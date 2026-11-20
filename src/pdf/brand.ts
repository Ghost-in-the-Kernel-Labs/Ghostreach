/**
 * The review's brand (TODO 2.4, ROADMAP §1): a cover page and a running footer, both Suite Builder's and Ghost's, added to the
 * audit page only as it is printed, so AUDIT.html stays the parent's but for 1.6's lines. The cover names the wordmark, the site,
 * the day it was read, who prepared it and Ghost's address; the footer carries the address on every page. Text, not an image: the
 * prospect can search and copy it, and nothing new is installed (RF-03). This program's own name is never printed.
 */
import { ADDRESS, BYLINE } from '../leaf/words.js';

/** What the cover names: the site's host, as the audit's heading names it, and the day it was read (YYYY-MM-DD, the page's own form). */
export interface Cover {
  site: string;
  date: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The page's margins in print: room above for nothing and below for the footer; the page's own width is kept, edge to edge. */
export const MARGIN = { top: '0.4in', bottom: '0.6in', left: '0', right: '0' };

/** The cover's style: one Letter page (11in less the margins), the wordmark at the top, the site and the day mid-page, the byline and the address at the foot. */
export const COVER_CSS = `.brand-cover{box-sizing:border-box;height:9.9in;break-after:page;display:flex;flex-direction:column;justify-content:space-between;padding:0.6in 0.8in;color:#1d1d1b;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.brand-cover .wordmark{font-size:30px;font-weight:700;letter-spacing:-.01em;border-left:8px solid #1d1d1b;padding-left:14px;line-height:1.1}
.brand-cover .kind{font-size:18px;color:#6b6a65;margin:0 0 8px}.brand-cover .site{font-size:40px;font-weight:700;margin:0 0 12px;overflow-wrap:anywhere}
.brand-cover .date{font-size:18px;margin:0}.brand-cover .by{font-size:14px;margin:0 0 4px}.brand-cover .address{font-size:14px;color:#6b6a65;margin:0}`;

/** The cover page's HTML, put first in the page's body before it is printed. */
export function coverHtml(cover: Cover): string {
  return `<section class="brand-cover"><div class="wordmark">Suite Builder</div>
<div><p class="kind">Automated site review</p><p class="site">${esc(cover.site)}</p><p class="date">${esc(cover.date)}</p></div>
<div><p class="by">${esc(BYLINE)}</p><p class="address">${esc(ADDRESS)}</p></div></section>`;
}

/** The running footer, on every page: the address, centred, small and dim. Chromium draws it in the bottom margin with a font size of its own unless one is given. */
export const FOOTER_TEMPLATE = `<div style="width:100%;text-align:center;font:9px system-ui,sans-serif;color:#6b6a65">${ADDRESS}</div>`;

/** No running header: an empty template, else Chromium prints the page's title and date there. */
export const HEADER_TEMPLATE = '<div></div>';
