/**
 * The words the audit never says (item 107, G-633, G-637), and where each is allowed. A banned word is a claim about the site that
 * a read cannot make ("secure", "passed", "clean"). `vulnerab` is banned only because no check says it: a finding of a check of
 * class security-observation (SITE-24, 25, 29 and `--vulnsec`'s SITE-36, which says "announced as" and never the word) may use it, a finding of a `reading` check never, and the audit's
 * own framing sentences never, in any review.
 */
import { CHECKS, type Check, type CheckClass } from '../../src/findings/check-catalogue.js';

const BANNED_WORDS = ['secure', 'passed', 'healthy', 'clean', 'compliant', 'no issues', 'vulnerab'];
/** The words a check of each class may use in its own finding's title, why and fix. */
const ALLOWED_IN_FINDINGS: Record<CheckClass, string[]> = { reading: [], 'security-observation': ['vulnerab'] };

const regexWithout = (allowed: string[]) => new RegExp(BANNED_WORDS.filter((w) => !allowed.includes(w)).join('|'), 'i');
/** Every banned word: the audit's framing sentences, and the findings of a `reading` check. */
export const BANNED = regexWithout([]);

/** The banned words in the text of a finding of a check of this class, or undefined. */
export const bannedIn = (text: string, cls: CheckClass = 'reading'): string | undefined => regexWithout(ALLOWED_IN_FINDINGS[cls]).exec(text)?.[0];

/** The class of the check a finding code belongs to; a code the catalogue does not hold is a `reading` one, the strictest. */
const classOf = (code: string, catalogue: readonly Check[] = CHECKS): CheckClass => catalogue.find((c) => c.code === code)?.class ?? 'reading';

/** The banned words in a finding's title, why and fix, by the class of its check. */
export function offences(finding: { code: string; title: string; why: string; fix: string }, catalogue: readonly Check[] = CHECKS): string[] {
  const cls = classOf(finding.code, catalogue);
  return [finding.title, finding.why, finding.fix].flatMap((t) => bannedIn(t, cls) ?? []);
}

/**
 * Every string, template and no-substitution template literal's text in a file, comments skipped. The parent read them with the
 * TypeScript 5 parser (`ts5`), a dependency Ghostreach does not have (1.4, docs/CUT.md): this is a lexer of the same tokens. A
 * `/` that can start a regular expression (after `(`, `,`, `=`, `:`, `[`, `!`, `&`, `|`, `?`, `{`, `}`, `;`, an operator or a
 * line start) is read as one, so a quote inside it is not a string. Escapes are kept as written but for `\'`, `\"` and `` \` ``.
 */
export function literals(source: string): string[] {
  const out: string[] = [];
  let i = 0;
  let last = '';
  const templates: number[] = []; // the brace depth at each open `${`
  let depth = 0;
  const readString = (quote: string): string => {
    let text = '';
    i++;
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') { text += source[i + 1] === quote ? quote : source.slice(i, i + 2); i += 2; continue; }
      text += source[i++];
    }
    i++;
    return text;
  };
  // A template's text from i (just past ` or }) to its end or its next `${`.
  const readTemplate = (): void => {
    let text = '';
    while (i < source.length) {
      if (source[i] === '\\') { text += source[i + 1] === '`' ? '`' : source.slice(i, i + 2); i += 2; continue; }
      if (source[i] === '`') { i++; out.push(text); last = '`'; return; }
      if (source[i] === '$' && source[i + 1] === '{') { i += 2; out.push(text); templates.push(depth); depth++; last = '{'; return; }
      text += source[i++];
    }
    out.push(text);
  };
  while (i < source.length) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '/') { while (i < source.length && source[i] !== '\n') i++; continue; }
    if (c === '/' && source[i + 1] === '*') { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 2; continue; }
    if (c === "'" || c === '"') { out.push(readString(c)); last = c; continue; }
    if (c === '`') { i++; readTemplate(); continue; }
    if (c === '{') { depth++; last = c; i++; continue; }
    if (c === '}') {
      depth--;
      if (templates.length > 0 && templates[templates.length - 1] === depth) { templates.pop(); i++; readTemplate(); continue; }
      last = c; i++; continue;
    }
    if (c === '/' && (last === '' || '(,=:[!&|?{};+-*%<>~^'.includes(last) || /\b(?:return|typeof|case|of|in)$/.test(source.slice(Math.max(0, i - 8), i).trimEnd()))) {
      i++;
      let inClass = false;
      while (i < source.length && (source[i] !== '/' || inClass)) {
        if (source[i] === '\\') i++;
        else if (source[i] === '[') inClass = true;
        else if (source[i] === ']') inClass = false;
        i++;
      }
      i++;
      while (/[a-z]/i.test(source[i] ?? '')) i++;
      last = 'r';
      continue;
    }
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return out;
}
