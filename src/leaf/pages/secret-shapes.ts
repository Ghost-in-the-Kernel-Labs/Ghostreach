/**
 * What a key, a token or a private key looks like: the one list (TODO 90's shapes, TODO 92's stage 0, G-410). The crawl
 * masks each where a page is saved (crawl/pages/: saved-secrets.ts, from readers/inert.ts), and a scan of anything about
 * to leave (a commit, a built suite, a pack) reads the same list through findSecrets, naming where and which shape,
 * never the value.
 *
 * A shape is the vendor's own prefix and length (Anthropic, OpenAI, AWS, Google, GitHub, npm, Slack, Stripe, Atlassian, HuggingFace, GitLab),
 * a private key block, a token of three parts (a JWT), a bearer token, or a long value with a digit in it right after a
 * word like key, token or secret.
 *
 * Every pattern reads one serialized page or line at a time: no shape crosses a tag (`<`, `>`) or a quote, so a masked
 * page is still the same markup, and the marker matches no shape, so a text masked twice is the same text. No pattern
 * looks ahead over the rest of a run, and a run is either taken whole by its match (a secret is masked whole, however
 * long: the second review's second pass, 4) or ends at a character its class lacks, where no other start can be inside
 * it: a page of near misses, however long, is read in one pass (finding 1). Bounded only where a run could hold the next
 * start: a private key's body (8 KB: past it, the rest is left, test/unit/secret-shapes.test.ts) and Bearer's spaces (4).
 *
 * In the page: BUNDLED into CONTROLS_SCRIPT (scripts/controls-script.mjs), so it may import other in-page code and be split into files.
 */

/** What stands where a secret was: no spaces, so an address and a file name keep their shape; it reads as what it replaced. */
export const SECRET_MARKER = 'secret-removed';

/**
 * Whether a value is the marker, or the marker numbered (`secret-removed-2`): the crawl report's form, where two different
 * secrets in one place would otherwise read as one (G-480, report-scrub.ts). Never masked again, so masking twice is masking once.
 */
export function isSecretMarker(value: string): boolean {
  return /^secret-removed(?:-[1-9][0-9]{0,5})?$/.test(value);
}

/** What a secret is replaced by: the marker by default; the crawl report's writer gives each value its own (G-480). */
export type MarkerFor = (secret: string) => string;
const MARKER: MarkerFor = () => SECRET_MARKER;

/** One shape: its name (said by a scan instead of the value) and its pattern, global. */
interface SecretShape {
  name: string;
  pattern: RegExp;
  /** Literals of which every match holds at least one, as written (case alike): a text holding none is not read by the pattern. */
  needs: readonly string[];
}

/** Where a key's body starts and ends: never beside a letter, digit or one of its own marks. */
const END = '(?![A-Za-z0-9_-])';
const START = '(?<![A-Za-z0-9_-])';

/** Each vendor's own shape, then the shapes any vendor's secret takes. */
// Decision: G-410
const SECRET_SHAPES: readonly SecretShape[] = [
  { name: 'Anthropic key', pattern: new RegExp(`${START}sk-ant-[A-Za-z0-9_-]{20,}${END}`, 'g'), needs: ['sk-ant-'] },
  { name: 'OpenAI key', pattern: new RegExp(`${START}sk-(?:proj|svcacct|admin|None)-[A-Za-z0-9_-]{20,}${END}|${START}sk-[A-Za-z0-9]{32,}${END}`, 'g'), needs: ['sk-'] },
  { name: 'AWS access key', pattern: new RegExp(`${START}(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}${END}`, 'g'), needs: ['AKIA', 'ASIA', 'ABIA', 'ACCA'] },
  { name: 'Google key', pattern: new RegExp(String.raw`${START}AIza[0-9A-Za-z_-]{35}${END}|${START}GOCSPX-[A-Za-z0-9_-]{20,}${END}|${START}ya29\.[0-9A-Za-z_-]{20,}${END}`, 'g'), needs: ['AIza', 'GOCSPX-', 'ya29.'] },
  { name: 'GitHub token', pattern: new RegExp(`${START}gh[pousr]_[A-Za-z0-9]{36,}${END}|${START}github_pat_[A-Za-z0-9_]{22,}${END}`, 'g'), needs: ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_'] },
  { name: 'npm token', pattern: new RegExp(`${START}npm_[A-Za-z0-9]{36}${END}`, 'g'), needs: ['npm_'] },
  { name: 'Slack token', pattern: new RegExp(String.raw`${START}xox[abposre]-[A-Za-z0-9-]{10,}${END}|hooks\.slack\.com/services/T[A-Za-z0-9]{1,40}/B[A-Za-z0-9]{1,40}/[A-Za-z0-9]{8,}`, 'g'), needs: ['xox', 'hooks.slack.com/services/T'] },
  { name: 'Stripe key', pattern: new RegExp(`${START}(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}${END}|${START}whsec_[A-Za-z0-9]{24,}${END}`, 'g'), needs: ['sk_', 'rk_', 'whsec_'] },
  { name: 'Atlassian token', pattern: new RegExp(`${START}ATATT3[A-Za-z0-9_=-]{40,}${END}`, 'g'), needs: ['ATATT3'] },
  // G-450: a HuggingFace token and a GitLab token. A Cloudflare or a BytePlus key has no prefix: only NAMED_VALUE finds one.
  { name: 'HuggingFace token', pattern: new RegExp(`${START}hf_[A-Za-z0-9]{30,}${END}`, 'g'), needs: ['hf_'] },
  { name: 'GitLab token', pattern: new RegExp(`${START}glpat-[A-Za-z0-9_-]{20,}${END}`, 'g'), needs: ['glpat-'] },
  // A block from its first line: the lines of key after it (never two dashes, so never into the next block's first line),
  // then its last line when it has one; written plainly or encoded in an address (a space as %20 or +). Never across a
  // tag or a quote, and at most 8 KB of key: a 4096-bit key is about 3 KB.
  { name: 'private key', pattern: /-----BEGIN(?:[A-Z ]|%20|\+){0,40}PRIVATE(?: |%20|\+)KEY(?: BLOCK)?-----(?:[A-Za-z0-9+/=\s:,%.]|-(?!-)){0,8192}(?:-----END(?:[A-Z ]|%20|\+){0,40}PRIVATE(?: |%20|\+)KEY(?: BLOCK)?-----)?/g, needs: ['-----BEGIN'] },
  // Three parts, the first two a JSON object's base64 ("eyJ" is `{"`).
  { name: 'JWT', pattern: new RegExp(String.raw`${START}eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*${END}`, 'g'), needs: ['eyJ'] },
  { name: 'bearer token', pattern: /(?<=\bBearer\s{1,4})[A-Za-z0-9._~+/-]{16,}={0,2}/g, needs: ['Bearer'] },
];

/**
 * A long value right after a word that names a secret and a colon or an equals sign (`api_key=...`, `"token": "..."`,
 * `data-session="..."`): only the value, and only when it has a digit and a letter in it (isNamedValue, in the code that
 * reads the match, never a lookahead over the rest of the run).
 */
const NAMED_VALUE = /(?<=\b[A-Za-z0-9_-]{0,40}?(?:key|token|secret|passw(?:or)?d|pwd|session(?:id)?|auth|authorization|csrf|xsrf|signature|credential)s?["']?\s{0,3}[:=]\s{0,3}["']?)[A-Za-z0-9+/_.-]{16,}={0,2}/gi;

/** What every NAMED_VALUE match holds: a colon or an equals sign. */
const NAMED_NEEDS: readonly string[] = [':', '='];

/**
 * Whether a pattern can match in `text` at all: it holds one of the literals every match of the pattern holds. A plain substring
 * search, far cheaper than a regex over a megabyte, and exact: a text without the literal has no match to lose, so the pattern is
 * skipped and the findings are those of reading every pattern (test/unit/secret-shapes-differential.test.ts holds this against
 * the scanner before the gate). A text with the literal is read by the pattern, whole, as before.
 */
function mayMatch(text: string, needs: readonly string[]): boolean {
  return needs.some((literal) => text.includes(literal));
}

/** Whether a value after a secret's name is one: a digit and a letter in it, and not the marker. */
function isNamedValue(value: string): boolean {
  return !isSecretMarker(value) && /[0-9]/.test(value) && /[A-Za-z]/.test(value);
}

/**
 * The longest run of a token's characters the patterns are trusted with. A regex engine recurses on one greedy run, and
 * a run of about 6 MB throws RangeError ("Maximum call stack size exceeded"), which the crawl's reader read as a page to
 * drop. Past this run a text is read again with each such run taken whole as a secret (fail closed): no real key is a
 * megabyte long, and the retry happens only when the first read threw, so a text that reads is read as before.
 */
const LONGEST_RUN = 1_000_000; // not a heuristic: the longest run a regex engine reads without overflowing its stack (about 6 MB), kept far under it

/** The characters a run holds, by char code (a table, not a chain of comparisons: the scan below reads every character of a 10 MB text): a letter, a digit or one of `+/_.=-`. */
const RUN_CHARS = new Uint8Array(128);
for (const c of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/_.=-') RUN_CHARS[c.charCodeAt(0)] = 1;

/** Whether `c` (a char code) can be in a run a pattern reads greedily. */
function inRun(c: number): boolean {
  return c < 128 && RUN_CHARS[c] === 1;
}

/** Where each run of LONGEST_RUN characters or more starts and ends: a plain scan, nothing to recurse. */
function oversizeRuns(text: string): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  let start = -1;
  for (let i = 0; i <= text.length; i++) {
    if (i < text.length && inRun(text.charCodeAt(i))) { if (start < 0) start = i; continue; }
    if (start >= 0 && i - start >= LONGEST_RUN) runs.push({ start, end: i });
    start = -1;
  }
  return runs;
}

/** `text` with every secret shape masked (by `markerFor`, the marker by default); a run too long to read (LONGEST_RUN) is masked whole. */
// Decision: G-410
export function maskSecrets(text: string, markerFor: MarkerFor = MARKER): string {
  try {
    return maskIn(text, markerFor);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    const runs = oversizeRuns(text);
    if (runs.length === 0) throw e;
    const parts: string[] = [];
    let at = 0;
    for (const { start, end } of runs) { parts.push(text.slice(at, start), markerFor(text.slice(start, end))); at = end; }
    parts.push(text.slice(at));
    return maskIn(parts.join(''), markerFor);
  }
}

function maskIn(text: string, markerFor: MarkerFor): string {
  let out = text;
  // A numbered marker is 16 characters, as long as a bearer token's shortest: never masked again.
  for (const { pattern, needs } of SECRET_SHAPES) if (mayMatch(out, needs)) out = out.replace(pattern, (found) => (isSecretMarker(found) ? found : markerFor(found)));
  return mayMatch(out, NAMED_NEEDS) ? out.replace(NAMED_VALUE, (value) => (isNamedValue(value) ? markerFor(value) : value)) : out;
}
