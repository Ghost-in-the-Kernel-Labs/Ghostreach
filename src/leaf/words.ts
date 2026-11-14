// The words a prospect may read (P-08; Suite Builder G-636), as the contract in code: every module that writes a
// sentence the prospect sees imports this, and test/unit/words.test.ts holds the PDF's text to it.
// Decision: GR-003 (one review, one vocabulary; no flag softens or hardens it).

/** The nouns and verdicts the review uses, and nothing else, for what it found. */
export const REVIEW_WORDS = ['review', 'finding', 'findings', 'major', 'minor', 'Nothing to report', 'Why it matters', 'Likely fix'] as const;

/**
 * Banned in every prospect-visible sentence about the site: verdicts on the site or its team, and scanner vocabulary.
 * Each is matched as a whole phrase, case-insensitively.
 */
export const BANNED_PHRASES = [
  'what is wrong',
  'wrong with',
  'nothing wrong',
  'defect',
  'defects',
  'problem',
  'problems',
  'the site is broken',
  'nobody looks after',
  'nobody checked',
  'thinking less',
  'scan',
] as const;

/** The banned phrases a sentence carries, in the order they appear in BANNED_PHRASES; empty when it is clean to hand over. */
export function bannedIn(sentence: string): string[] {
  return BANNED_PHRASES.filter((phrase) => phrasePattern(phrase).test(sentence));
}

/** A whole-word, case-insensitive match of the phrase, its spaces matching any run of white space. */
function phrasePattern(phrase: string): RegExp {
  return new RegExp(`\\b${phrase.split(' ').join('\\s+')}\\b`, 'i');
}
