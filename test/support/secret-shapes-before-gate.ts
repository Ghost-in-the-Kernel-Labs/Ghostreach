/**
 * FROZEN COPY of src/pages/secret-shapes.ts as it was before the candidate gate (Ghost, 2026-11-06, the 10 MB test's speed fix):
 * the reference that test/unit/secret-shapes-differential.test.ts holds the live scanner against, detection for detection.
 * Never edited to follow the live file: a change to what a shape finds is a decision that retires this copy.
 *
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
 */

/** What stands where a secret was: no spaces, so an address and a file name keep their shape; it reads as what it replaced. */
const SECRET_MARKER = 'secret-removed';

/**
 * Whether a value is the marker, or the marker numbered (`secret-removed-2`): the crawl report's form, where two different
 * secrets in one place would otherwise read as one (G-480, report-scrub.ts). Never masked again, so masking twice is masking once.
 */
function isSecretMarker(value: string): boolean {
  return /^secret-removed(?:-[1-9][0-9]{0,5})?$/.test(value);
}

/** What a secret is replaced by: the marker by default; the crawl report's writer gives each value its own (G-480). */
export type MarkerFor = (secret: string) => string;
const MARKER: MarkerFor = () => SECRET_MARKER;

/** One shape: its name (said by a scan instead of the value) and its pattern, global. */
interface SecretShape {
  name: string;
  pattern: RegExp;
}

/** Where a key's body starts and ends: never beside a letter, digit or one of its own marks. */
const END = '(?![A-Za-z0-9_-])';
const START = '(?<![A-Za-z0-9_-])';

/** Each vendor's own shape, then the shapes any vendor's secret takes. */
// Decision: G-410
const SECRET_SHAPES: readonly SecretShape[] = [
  { name: 'Anthropic key', pattern: new RegExp(`${START}sk-ant-[A-Za-z0-9_-]{20,}${END}`, 'g') },
  { name: 'OpenAI key', pattern: new RegExp(`${START}sk-(?:proj|svcacct|admin|None)-[A-Za-z0-9_-]{20,}${END}|${START}sk-[A-Za-z0-9]{32,}${END}`, 'g') },
  { name: 'AWS access key', pattern: new RegExp(`${START}(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}${END}`, 'g') },
  { name: 'Google key', pattern: new RegExp(String.raw`${START}AIza[0-9A-Za-z_-]{35}${END}|${START}GOCSPX-[A-Za-z0-9_-]{20,}${END}|${START}ya29\.[0-9A-Za-z_-]{20,}${END}`, 'g') },
  { name: 'GitHub token', pattern: new RegExp(`${START}gh[pousr]_[A-Za-z0-9]{36,}${END}|${START}github_pat_[A-Za-z0-9_]{22,}${END}`, 'g') },
  { name: 'npm token', pattern: new RegExp(`${START}npm_[A-Za-z0-9]{36}${END}`, 'g') },
  { name: 'Slack token', pattern: new RegExp(String.raw`${START}xox[abposre]-[A-Za-z0-9-]{10,}${END}|hooks\.slack\.com/services/T[A-Za-z0-9]{1,40}/B[A-Za-z0-9]{1,40}/[A-Za-z0-9]{8,}`, 'g') },
  { name: 'Stripe key', pattern: new RegExp(`${START}(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}${END}|${START}whsec_[A-Za-z0-9]{24,}${END}`, 'g') },
  { name: 'Atlassian token', pattern: new RegExp(`${START}ATATT3[A-Za-z0-9_=-]{40,}${END}`, 'g') },
  // G-450: a HuggingFace token and a GitLab token. A Cloudflare or a BytePlus key has no prefix: only NAMED_VALUE finds one.
  { name: 'HuggingFace token', pattern: new RegExp(`${START}hf_[A-Za-z0-9]{30,}${END}`, 'g') },
  { name: 'GitLab token', pattern: new RegExp(`${START}glpat-[A-Za-z0-9_-]{20,}${END}`, 'g') },
  // A block from its first line: the lines of key after it (never two dashes, so never into the next block's first line),
  // then its last line when it has one; written plainly or encoded in an address (a space as %20 or +). Never across a
  // tag or a quote, and at most 8 KB of key: a 4096-bit key is about 3 KB.
  { name: 'private key', pattern: /-----BEGIN(?:[A-Z ]|%20|\+){0,40}PRIVATE(?: |%20|\+)KEY(?: BLOCK)?-----(?:[A-Za-z0-9+/=\s:,%.]|-(?!-)){0,8192}(?:-----END(?:[A-Z ]|%20|\+){0,40}PRIVATE(?: |%20|\+)KEY(?: BLOCK)?-----)?/g },
  // Three parts, the first two a JSON object's base64 ("eyJ" is `{"`).
  { name: 'JWT', pattern: new RegExp(String.raw`${START}eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*${END}`, 'g') },
  { name: 'bearer token', pattern: /(?<=\bBearer\s{1,4})[A-Za-z0-9._~+/-]{16,}={0,2}/g },
];

/**
 * A long value right after a word that names a secret and a colon or an equals sign (`api_key=...`, `"token": "..."`,
 * `data-session="..."`): only the value, and only when it has a digit and a letter in it (isNamedValue, in the code that
 * reads the match, never a lookahead over the rest of the run).
 */
const NAMED_VALUE = /(?<=\b[A-Za-z0-9_-]{0,40}?(?:key|token|secret|passw(?:or)?d|pwd|session(?:id)?|auth|authorization|csrf|xsrf|signature|credential)s?["']?\s{0,3}[:=]\s{0,3}["']?)[A-Za-z0-9+/_.-]{16,}={0,2}/gi;

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

/** Whether `c` (a char code) can be in a run a pattern reads greedily: a letter, a digit or one of `+/_.=-`. */
function inRun(c: number): boolean {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 43 || c === 47 || c === 95 || c === 46 || c === 61 || c === 45;
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

/** One finding: the shape's name, where it starts and how long it is (so a caller can hash the match, never say it). */
interface Found {
  shape: string;
  index: number;
  length: number;
}

/** Where in `text` each shape is found, by name and place: what a scan says, never the value. */
// Decision: G-450
export function findSecrets(text: string): Found[] {
  try {
    return findIn(text);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    const runs = oversizeRuns(text);
    if (runs.length === 0) throw e;
    // Each long run blanked, its length kept, so every other place stays where it was; each is said as a shape of its own.
    let blanked = text;
    for (const { start, end } of runs) blanked = blanked.slice(0, start) + ' '.repeat(end - start) + blanked.slice(end);
    return [...findIn(blanked), ...runs.map((r) => ({ shape: 'oversize run', index: r.start, length: r.end - r.start }))].sort((a, b) => a.index - b.index);
  }
}

function findIn(text: string): Found[] {
  const found: Found[] = [];
  for (const { name, pattern } of SECRET_SHAPES) for (const m of text.matchAll(pattern)) found.push({ shape: name, index: m.index ?? 0, length: m[0].length });
  for (const m of text.matchAll(NAMED_VALUE)) if (isNamedValue(m[0])) found.push({ shape: 'named secret', index: m.index ?? 0, length: m[0].length });
  return found.sort((a, b) => a.index - b.index);
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
  for (const { pattern } of SECRET_SHAPES) out = out.replace(pattern, (found) => (isSecretMarker(found) ? found : markerFor(found)));
  return out.replace(NAMED_VALUE, (value) => (isNamedValue(value) ? markerFor(value) : value));
}
