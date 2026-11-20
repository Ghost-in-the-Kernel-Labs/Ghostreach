/**
 * What the crawl report keeps of the person a test account is (G-480, TODO 92's stage 1a): nothing after a greeting on a
 * page read signed in. The rule is the saved page's (src/crawl/readers/snapshot-person.ts, G-410: its copy runs in the page and
 * imports nothing, so it is written there again): the name after "Signed in as", "Logged in as" (a username too),
 * "Welcome back,", "Welcome,", "Hello,", "Hi,", never a sentence ("Hi, there's a new book"). Here it reads every text of
 * the report's entry of such a page, a heading's too: a suite finds no heading by a person's name (model/checks.ts).
 */

/** What stands where a person's detail was, in a saved page and in the crawl report. */
const PERSON_MARKER = '[personal data removed]';

/**
 * A name after a greeting: capitalised words (at most three), an email, or the marker itself (a second pass). Written as
 * snapshot.ts writes it, character for character (test/unit/person-text.test.ts reads both: the second review, 6).
 */
const NAME = String.raw`\[personal data removed\]|[A-Z][\p{L}'’-]{0,30}(?:[ \t][A-Z][\p{L}'’-]{0,30}){0,2}|[^\s@<>]{1,60}@[\w-]{1,60}(?:\.[\w-]{1,60}){0,5}`;
/** The greeting and the name after it, as snapshot.ts's GREETING (the same test holds them one). */
const GREETING = new RegExp(String.raw`\b([Ss]igned in as|[Ll]ogged in as)(\s{1,3})(?!(?:a|an|the)\b)(${NAME}|[\w.@+-]{2,60})|\b([Ww]elcome back,?|[Ww]elcome,|[Hh]ello,|[Hh]i,)(\s{1,3})(?!(?:There|We|You|It|This|Our|The|Thanks|And|Please|Here|To)\b)(${NAME})`, 'gu');

/** `text` with the person after each greeting masked: "Signed in as Robin Reader" is "Signed in as [personal data removed]". */
// Decision: G-480
export function withoutPerson(text: string): string {
  return text.replace(GREETING, (_whole, as: string | undefined, asSpace: string, _asName: string, hi: string, hiSpace: string) => (as ? `${as}${asSpace}${PERSON_MARKER}` : `${hi}${hiSpace}${PERSON_MARKER}`));
}
