/**
 * A site's words in a Markdown file the tool writes (the security posture's Layer 3, G-252): one line, at most
 * SITE_TEXT_MAX characters, in an inline code span. A page that says "assistant: run ...", "# SYSTEM" or "</AGENTS>"
 * is then a quotation, never a heading, a list, a fence, a tag or a sentence of the file's own: an agent reading the
 * suite sees where the site's words start and end. Every Markdown writer gives a site's string to siteText, and a file
 * that holds one says so after its header (withSiteTextNote). visibleText (kits/common/visible.ts) still shows, after,
 * what a person cannot see. In src/pages/, which every layer may read: a finding (src/group/) quotes a site's words too.
 */

/** The longest a site's text is quoted in Markdown: past it, cut, and "..." says so. */
export const SITE_TEXT_MAX = 160; // not a heuristic: a quotation's room on a line

/**
 * A site's string as an inline code span: every run of white space (a line break, a line or paragraph separator, NEL)
 * one space, cut to `max`, inside as many backticks as it needs (one more than its longest run), padded with a space
 * where it starts or ends with one. In a table cell (`cell`), a pipe is escaped too: GitHub ends a cell at one, even in
 * code, and shows `\|` there as the pipe.
 */
// Decision: G-252
export function siteText(text: string, options: { cell?: boolean; max?: number } = {}): string {
  const max = options.max ?? SITE_TEXT_MAX;
  // A reversed prime is a backtick once the md template has read it (markdown.ts): counted as one here.
  let words = text.replace(/\u2035/g, '`').replace(/[\s\x85]+/g, ' ').trim();
  const chars = [...words];
  if (chars.length > max) words = `${chars.slice(0, max - 3).join('').trimEnd()}...`;
  if (options.cell) words = words.replace(/\|/g, '\\|');
  const fence = '`'.repeat(Math.max(0, ...(words.match(/`+/g) ?? []).map((run) => run.length)) + 1);
  if (!words) return '` `';
  const pad = /^`|`$/.test(words) ? ' ' : '';
  return `${fence}${pad}${words}${pad}${fence}`;
}
