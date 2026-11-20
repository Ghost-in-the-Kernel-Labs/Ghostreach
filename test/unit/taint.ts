/**
 * What a text says in its own voice, its code spans and fenced blocks taken out: the one part of the parent's taint helper
 * (test/unit/taint.ts at a4c8045) a carried test reads. Its tainted crawls (every text field with a payload) were read only by the
 * suite side's tests, and were not carried (1.4, docs/CUT.md).
 */
/**
 * What a Markdown file says in its own voice: each line outside a fenced block, its code spans taken out (CommonMark: a
 * run of backticks opens one, and the next run of the same length closes it). A site's words belong in the rest.
 */
export function ownVoice(markdown: string): string[] {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of markdown.split('\n')) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && !line.slice(line.indexOf(marker) + marker.length).trim()) fence = null;
      continue;
    }
    if (marker && !(marker[0] === '`' && line.slice(line.indexOf(marker) + marker.length).includes('`'))) {
      fence = marker;
      continue;
    }
    let own = '';
    for (let i = 0; i < line.length; ) {
      const run = /^`+/.exec(line.slice(i))?.[0];
      if (!run) {
        own += line[i++];
        continue;
      }
      let close = -1;
      for (let j = i + run.length; j < line.length; ) {
        const next = /^`+/.exec(line.slice(j))?.[0];
        if (next && next.length === run.length) {
          close = j;
          break;
        }
        j += next ? next.length : 1;
      }
      if (close < 0) {
        own += run;
        i += run.length;
      } else i = close + run.length;
    }
    out.push(own);
  }
  return out;
}
