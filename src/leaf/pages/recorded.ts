/**
 * Whether the crawl recorded a link or control the browser listed (G-222): one rule, read both by the
 * reader that names where a missed one lives (readers/seen.ts) and by what says it after the crawl
 * (src/group/unread.ts), so the two never disagree on what was missed. In src/pages/: what both sides of the
 * crawl know about pages (SRC-08).
 */
/** A link or control as the browser lists it (the crawl report's BrowserControl, as far as this rule reads it). */
interface Listed {
  role: string;
  name: string;
  url?: string;
}

/** Words compared as a visitor reads them: case, spacing and the punctuation around them aside. */
const plain = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();

/** What a page's readers recorded, as words, apart by kind: its links' texts, and its controls' words (its frames' with each). */
export interface Recorded {
  links: string[];
  controls: string[];
  /** Each recorded link's text with where it leads (null: not known), and the page's address to read a relative one against. */
  targets: { text: string; to: string | null }[];
  base: string | null;
}

/** A recorded link: its text, and where it leads (an absolute address) when the reader knew. */
export type RecordedLink = { text: string; to?: string | null };

/** An address as compared: absolute, without its #fragment; null when it is not one. */
function target(href: string, base: string | null): string | null {
  try {
    const url = new URL(href, base ?? undefined);
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

/** What a page's readers recorded, as words: its controls', its links' (the text of each), and its frames'. */
export function recordedWords(
  controls: { words: string[] }[] | undefined,
  links: (string | RecordedLink)[],
  frames: { url?: string | null; controls?: { words: string[] }[]; links?: { href: string; text: string }[] }[] | undefined,
  base: string | null = null,
): Recorded {
  const once = (words: string[]) => [...new Set(words.map(plain).filter(Boolean))];
  const all: RecordedLink[] = [
    ...links.map((l) => (typeof l === 'string' ? { text: l } : l)),
    // A frame's link leads where its href says, read against the frame's own address.
    ...(frames ?? []).flatMap((f) => (f.links ?? []).map((l) => ({ text: l.text, to: target(l.href, f.url ?? base) }))),
  ];
  return {
    links: once(all.map((l) => l.text)),
    controls: once([...(controls ?? []).flatMap((c) => c.words), ...(frames ?? []).flatMap((f) => (f.controls ?? []).flatMap((c) => c.words))]),
    targets: all.map((l) => ({ text: plain(l.text), to: l.to ? target(l.to, base) : null })),
    base,
  };
}

/**
 * The recorded words an entry of the browser's may be matched with, by its role (ChatGPT's third audit, 3): a
 * link only with a link, a field only with a control, so a link "Search" no longer stands for a missed search
 * box. A button, tab or menu item may be either: a link often carries those roles (`<a role="button">`).
 */
function wordsFor(role: string, recorded: Recorded): string[] {
  if (role === 'link') return recorded.links;
  if (/^(button|tab|menuitem\w*)$/.test(role)) return [...recorded.links, ...recorded.controls];
  return recorded.controls;
}

/** Two names for one thing: the same words, or one holding the other (a label shortened, a count added). */
const sameName = (r: string, n: string) => r === n || (Math.min(r.length, n.length) >= 4 && (r.includes(n) || n.includes(r)));

/**
 * One of the browser's entries is recorded when its name is a recorded word of its kind (sameName). A link
 * the browser gives an address must also lead where a recorded link of that name leads (ChatGPT's fourth
 * audit, 1: two "Help" links to two places are two links); a recorded one whose address is not known can
 * be either, so it is not taken as missed.
 */
function isRecorded(entry: Listed, recorded: Recorded): boolean {
  const n = plain(entry.name);
  if (!wordsFor(entry.role, recorded).some((r) => sameName(r, n))) return false;
  const to = entry.role === 'link' && entry.url ? target(entry.url, recorded.base) : null;
  if (!to) return true;
  const named = recorded.targets.filter((t) => sameName(t.text, n));
  return named.length === 0 || named.some((t) => t.to === null || t.to === to);
}

/** A link the crawl leaves out by design (mail, a phone number, a script): not a page, so not a gap. */
const notAPage = (s: Listed) => s.role === 'link' && /^(mailto|tel|sms|javascript):/i.test(s.url ?? '');

/** The browser's entries the readers did not record: named ones only (an unnamed one cannot be told apart), mail and phone links aside. */
// Decision: G-222
export function notRecorded<T extends Listed>(seen: T[], recorded: Recorded): T[] {
  return seen.filter((s) => s.name && !notAPage(s) && !isRecorded(s, recorded));
}
