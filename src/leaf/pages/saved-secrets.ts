/**
 * What a saved page (crawl/pages/) keeps of a secret (G-410, TODO 92's stage 0): nothing. Every key of a known shape
 * (secret-shapes.ts), the value of every parameter in an address named like a token, whatever it looks like (a reset or
 * magic link's code is often short and plain), and a name and password written into an address. All read as text, over
 * the whole file, so no path through the markup is missed; each pattern reads a run once (the second review's finding 1).
 * What the crawler typed to sign in is masked in the page itself, where tags and attribute names cannot be touched
 * (snapshotHtml, `typed`).
 * In the page: BUNDLED into CONTROLS_SCRIPT (scripts/controls-script.mjs), so it may import other in-page code and be split into files.
 */
import { isSecretMarker, type MarkerFor, maskSecrets, SECRET_MARKER } from './secret-shapes.js';

/**
 * A query or fragment parameter whose value is a credential: a token, a session, a signature (an S3 or Google signed
 * address), a key, a sign-in or reset code, a password. Read ignoring case, `-`, `_` and `.`: X-Amz-Signature is
 * xamzsignature.
 */
const TOKEN_NAMES = new Set(['token', 'session', 'sessionid', 'sid', 'sig', 'signature', 'key', 'apikey', 'auth', 'code', 'secret', 'password', 'passwd', 'pwd', 'otp', 'csrf', 'xsrf', 'jsessionid', 'phpsessid', 'credential', 'keypairid', 'magic', 'ticket']);
const TOKEN_ENDINGS = /(token|secret|signature|password|sessionid|apikey|credential|csrf)$/;

/** Whether a parameter so named carries a credential. */
// Decision: G-410
function isTokenParameter(name: string): boolean {
  const plain = name.toLowerCase().replace(/[-_.]/g, '');
  return TOKEN_NAMES.has(plain) || TOKEN_ENDINGS.test(plain);
}

/**
 * Each parameter in an address, anywhere in `text`, written plainly or percent-encoded inside another address: after
 * `?`, `&`, `;` (an `&amp;`), `#`, or their encodings, a name, `=`, and the value up to the next separator, quote,
 * space or tag. Each piece of the value starts with a character the one before cannot hold, so a value is read once.
 */
const PARAMETER = /((?:[?&;#]|%3[Ff]|%26|%23)([A-Za-z0-9_.-]{1,64})(?:=|%3[Dd]))([^&"'#\s<>%]*(?:%(?!26|3[Ff]|23)[0-9A-Fa-f]{2}[^&"'#\s<>%]*)*)/g;

/** `text` with the value of every token-like parameter in an address masked, its name kept: `?token=abc` is `?token=secret-removed`. */
function maskTokenParameters(text: string, markerFor: MarkerFor = () => SECRET_MARKER): string {
  return text.replace(PARAMETER, (whole, lead: string, name: string, value: string) => (value && !isSecretMarker(value) && isTokenParameter(name) ? `${lead}${markerFor(value)}` : whole));
}

/** A name and password written into an address (`https://ada:pw@host/`): both masked. */
const USER_INFO = /(?<=\/\/)[^/\s"'<>@:]+:[^/\s"'<>@]+(?=@)/g;

/** The shortest typed value masked: a shorter one ("admin", "demo") is a word of many pages. */
const SHORTEST_TYPED = 6; // not a heuristic: below it a typed value is a common word, and masking it would take the page's own words

/**
 * `text` that is not a page (an API document saved beside the pages, a locator read against one) without what the
 * crawler typed to sign in (G-410; the second review's second pass, 1 and 3): each value of SHORTEST_TYPED characters or
 * more, as typed, escaped for JSON or encoded for an address, as a whole word, is the marker. A saved page is masked in
 * the page itself instead (snapshotHtml, `typed`), where tags and attribute names cannot be touched.
 */
// Decision: G-410
export function withoutTyped(text: string, typed: readonly string[], anyCase = false, markerFor: MarkerFor = () => SECRET_MARKER): string {
  let out = text;
  for (const value of typed) {
    if (value.length < SHORTEST_TYPED) continue;
    const forms = [...new Set([value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value)])].map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // `anyCase` (the crawl report, G-480): ROBIN.READER too, a heading or a title written in capitals. Never inside an
    // address's scheme and host (G-480, the third review, 3): an account named after the site leaves the site's address.
    // `markerFor` is given the value as typed, however it was written (the report numbers two that would read as one).
    const pattern = new RegExp(`(?<![A-Za-z0-9])(?:${forms.join('|')})(?![A-Za-z0-9])`, anyCase ? 'gi' : 'g');
    out = out.split(SCHEME_AND_HOST).map((piece, i) => (i % 2 === 1 ? piece : piece.replace(pattern, () => markerFor(value)))).join('');
  }
  return out;
}

/** An address's scheme and host (and port), kept whole as one piece of a split (its one group). */
const SCHEME_AND_HOST = /([A-Za-z][A-Za-z0-9+.-]{0,30}:\/\/[^/\s"'<>?#]*)/;

/**
 * What of `typed` is masked in the texts of a crawl of the site at `origin` (G-480; the third review, 3): never a value
 * that is a word of the site's own host (a demo account `library` on library.test, `example` on example.com), which the
 * site's own name, title and headings hold as its words, not the account's.
 */
// Decision: G-480
export function typedToMask(typed: readonly string[], origin: string): string[] {
  let words: string[] = [];
  try {
    words = new URL(origin).hostname.toLowerCase().split(/[.-]/);
  } catch {
    // not an address: every value is masked
  }
  return typed.filter((value) => !words.includes(value.toLowerCase()));
}

/**
 * What a saved page (or a file saved beside it, or a locator read against one) keeps of a secret: every shape masked,
 * every token-like parameter's value masked, and a name and password in an address masked.
 */
// Decision: G-410
export function withoutSecrets(text: string, markerFor: MarkerFor = () => SECRET_MARKER): string {
  // A name and password first, whole: a key inside one is then no secret of its own, so each pass meets the same values
  // (the crawl report numbers them, G-480; the second review, 4a).
  return maskTokenParameters(maskSecrets(text.replace(USER_INFO, (found) => markerFor(found)), markerFor), markerFor);
}

/** Where a marker stands in a text: the plain one or a numbered one (G-480), as a whole word. */
const MARKER_IN_TEXT = /(?<![A-Za-z0-9_-])secret-removed(?:-[1-9][0-9]{0,5})?(?![A-Za-z0-9_])/;

/**
 * Whether an address (or any text) holds a secret, masked or not: a key of a known shape, a token-like parameter's value,
 * a name and password, or the marker one of them left (G-480). A locator never matches such an address whole: the live
 * site's token is another, and the marker is no address (model/locators.ts).
 */
// Decision: G-480
export function holdsSecret(text: string): boolean {
  return MARKER_IN_TEXT.test(text) || withoutSecrets(text) !== text;
}
