/**
 * A link the site answers with an error on purpose (item 71): a site that shows what a 404 or a 500 looks like
 * links to one. Its own words or its address name the status it answers, so it is no broken link; it is said
 * apart, as expected, with the reason. One function reads it, for the link report and for the site finding alike.
 */

/**
 * The 4xx statuses that are no visitor's error page (G-743 (2)): a login or a bar (401, 403, and a proxy's login, 407), a page that
 * wants another method than a link's GET (405: an API endpoint), what the crawler meets as an automated visitor (408, its request
 * timed out; 429, too many requests; 499, it closed the request), a page withheld on purpose where the crawler is (451), and a
 * 400, which answers the request (its cookies, its headers, an address's encoding) more than the page.
 */
const NOT_A_VISITORS_ERROR = new Set([400, 401, 403, 405, 407, 408, 429, 451, 499]);

/**
 * A link that leads nowhere: a 4xx a visitor gets as an error page (404, 410, 409 ...; not those above), or a server error (5xx).
 * A status past 599 is no server's (LinkedIn's 999 is its bot wall): never broken.
 */
// Decision: G-132, G-743
export function isBrokenStatus(page: { status: number | null }): boolean {
  const s = page.status;
  if (s === null) return false;
  return (s >= 400 && s < 500 && !NOT_A_VISITORS_ERROR.has(s)) || (s >= 500 && s < 600);
}

/** A number that is a whole status in some words: "404 page", "Error 500", not "2024" or "4040". */
const STATUS_IN_WORDS = /(?<!\d)[1-5]\d\d(?!\d)/g;

/**
 * Why a link whose address answered `status` is a demonstration of that answer, or null when it is a broken link:
 * the status number is a whole segment of its path (/status/500), or a link's words (any one of `words`) give the
 * number ("404 page"), say "not found" of a 404 or 410, "server error" of a 5xx, or name a "status code".
 * A status that is no broken link's (no error, no answer, a login) is never one: a 409 is, as a 404 (G-743 (2)).
 */
// Decision: G-132, G-743
export function answeredOnPurpose(status: number | null, path: string, words: string[]): string | null {
  if (status === null || !isBrokenStatus({ status })) return null;
  if (path.split('/').includes(String(status))) return `its address names the status it answers (${status} in ${path})`;
  for (const said of words) {
    const text = said.toLowerCase();
    const named =
      [...text.matchAll(STATUS_IN_WORDS)].some((m) => Number(m[0]) === status) ||
      ((status === 404 || status === 410) && text.includes('not found')) ||
      (status >= 500 && text.includes('server error')) ||
      /status codes?/.test(text);
    if (named) return `its own words name the status it answers ("${said}")`;
  }
  return null;
}
