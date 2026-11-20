/**
 * Text that gives a credential (Ghost, 2026-10-30, TODO 71: a prospect's reviewer found `LogInWithTomsmithAndSuperSecretPa...`
 * in a published suite, made from a login page's "Enter tomsmith for the username and SuperSecretPassword! for the
 * password"). A name is made from what a thing is, its role and its label; a value the page shows for a field is
 * no part of it. Every name made from text (toPascalCase, toUpperSnake) leaves such a sentence out.
 * In the page: BUNDLED into CONTROLS_SCRIPT and READING_SCRIPT (scripts/controls-script.mjs), so it may import other in-page code and be split into files.
 */

/** What a credential is for. A field's own label ("Password", "Enter your password") names no value and is not matched on its own. */
const KIND = "(?:user ?name|user ?id|password|passcode|passphrase|pin|token|secret|api[ -]?key)";
/** Words that follow "enter" and the like where no value is given: "Enter your password", "Use a valid token". */
const NO_VALUE = "(?:your|a|an|the|valid|new|current|correct|any|my|our|this|that|it|them|both|one|all|each|some)";

/**
 * The three shapes of a sentence that gives a credential:
 *  - an instruction naming a value and what it is for: "Enter tomsmith for the username", "use admin as the password"
 *    (the value and the "for" at most 200 characters apart, so a page's long text costs a scan, not a search per word);
 *  - a kind and its value: "Password: hunter2", "the password is Pa55word!" (after "is", only a value that looks like
 *    one: a digit or a symbol in it, so "your password is required" is not one);
 *  - a word that is a password fused with other words: "SuperSecretPassword!", "MySecretToken" (a mark after the kind, or
 *    "Secret" before it: "ForgotPassword" names a page, TODO 89, and is no value).
 */
const GIVES_A_VALUE = [
  new RegExp(String.raw`\b(?:enter|use|type|try|input|log ?in (?:with|as)|sign ?in (?:with|as))\s+(?!${NO_VALUE}\b)\S+[^.]{0,200}?\b(?:for|as)\s+(?:the |your )?${KIND}\b`, 'i'),
  new RegExp(String.raw`\b${KIND}\s*[:=]\s*[^\s(*]`, 'i'),
  new RegExp(String.raw`\b${KIND}\s+(?:is|are)\s+["'“]?(?=\S*[0-9!@#$%^&*_])\S+`, 'i'),
  /[a-z](?:Password|Passcode|Secret|Token|ApiKey)[0-9!@#$%^&*_]/,
  /Secret(?:Password|Passcode|Token|ApiKey)/,
];

/** Whether a sentence gives a credential's value. */
function givesCredential(sentence: string): boolean {
  return GIVES_A_VALUE.some((shape) => shape.test(sentence));
}

/**
 * What stands in a saved page or the crawl report for a sentence that gives a credential (TODO 71), as
 * `email@example.com` stands for an address (G-197): a placeholder that reads as what it replaced. It
 * gives no credential, so a text marked twice is the same text.
 */
export const CREDENTIAL_MARKER = '[credential removed]';

/** A sentence and the space after it: the last one runs to the end of the text. */
const SENTENCE = /[\s\S]+?(?:(?<=[.!?])\s+(?=[A-Z0-9])|$)/g;

/** `text` with each sentence that gives a credential replaced by the marker, the rest as it was: "Log in. Password: hunter2" -> "Log in. [credential removed]" */
export function markCredentials(text: string): string {
  return text.replace(SENTENCE, (sentence) => {
    const body = sentence.trim();
    if (!givesCredential(body)) return sentence;
    const lead = sentence.length - sentence.trimStart().length;
    return sentence.slice(0, lead) + CREDENTIAL_MARKER + sentence.slice(lead + body.length);
  });
}
