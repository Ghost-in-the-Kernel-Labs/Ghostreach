/**
 * URL rules for the crawler: what counts as the same page, what stays on the site, and what is
 * worth opening in a browser at all.
 * In the page: BUNDLED into READER_SCRIPT (scripts/controls-script.mjs), so it may import other in-page code and be split into files
 * (the audit's linking check matches a link in the crawl's normal form, normalizeUrl).
 */

/**
 * The canonical form used as a page's identity: absolute, no #fragment, except a route's (`#/about`, `#!/about`: a
 * page of a single-page app that routes by hash, G-306). The WHATWG URL parser already lower-cases the scheme and
 * host, drops default ports and resolves ./ and ../.
 * The query string is kept, since /search?q=a and /search?q=b are different pages.
 * A session id is not part of it (G-305): see SESSION_PATH_PARAMETER.
 * Returns null for anything that is not http(s): mailto:, tel:, javascript:, data:.
 */
export function normalizeUrl(raw: string, base?: string): string | null {
  let u: URL;
  try {
    u = base === undefined ? new URL(raw) : new URL(raw, base);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.hash = hashRouteOf(u.hash) ?? '';
  // A name and password in an address never travel on (Fable's review, B10): not asked with, not written
  // into a report or a suite. An empty query is the page without one.
  u.username = '';
  u.password = '';
  if (u.search === '') u.search = '';
  // A session id names a visit, not a page; the next visit has another, or none (parabank, 2026-10-25).
  u.pathname = u.pathname.replace(SESSION_PATH_PARAMETER, '');
  for (const name of [...u.searchParams.keys()]) if (SESSION_QUERY.has(name.toLowerCase())) u.searchParams.delete(name);
  // Tracking parameters say where a visitor came from, never which page it is.
  let tracked = false;
  for (const name of [...u.searchParams.keys()]) {
    if (isTracking(name)) {
      u.searchParams.delete(name);
      tracked = true;
    }
  }
  if (tracked && [...u.searchParams].length === 0) u.search = '';
  return u.href;
}

/**
 * The session ids a server writes into an address: the servlet container's path parameter
 * (`about.htm;jsessionid=...`, in any case) and the query parameters of the Java and PHP containers.
 * Not `sid` or `session`: those are as often a page's own parameter (a season, a stream), and taking
 * them out would make two pages one.
 */
// Decision: G-305
const SESSION_PATH_PARAMETER = /;jsessionid=[^;/?#]*/gi;
const SESSION_QUERY = new Set(['jsessionid', 'phpsessid']);

/**
 * A fragment that is a route, as a hash router writes it: `#/about`, `#/search?q=a`, `#!/about` (the older form).
 * Null for any other: `#top` is a place in the page, `#/` the app's home (the page without a fragment), `#as=user` a
 * role's mark (G-145). A second `#` ends it. A route is another page of the app; the server is asked for the same
 * document (G-306).
 */
// Decision: G-306
function hashRouteOf(hash: string): string | null {
  const m = /^#!?\/[^#]+/.exec(hash);
  return m ? m[0] : null;
}

/** The route in an address (`#/about`), null when it has none. */
export function routeOf(url: string): string | null {
  const at = url.indexOf('#');
  return at < 0 ? null : hashRouteOf(url.slice(at));
}

/**
 * The document an address asks the server for: a route's address without its fragment, and without a role's mark.
 * What the crawl's router sees of the request, and the key it loads by (state.navigate).
 */
// Decision: G-306
export function documentUrl(url: string): string {
  const at = url.indexOf('#');
  return at < 0 ? url : url.slice(0, at);
}

/**
 * An address as a person reads its path: the path, then a route's (`/#/about`, `/app/#/shop/5`) without the route's
 * query. Equal to the path when there is no route, so a site without one is as it was (G-306).
 */
// Decision: G-306
export function addressPath(url: string): string {
  const route = routeOf(url);
  return new URL(url).pathname + (route === null ? '' : route.split('?')[0]);
}

/** An address's query: the address's own, else the route's (`#/search?q=a` -> `?q=a`). */
function addressSearch(url: string): string {
  const u = new URL(url);
  if (u.search) return u.search;
  const route = routeOf(url);
  const at = route?.indexOf('?') ?? -1;
  return route && at >= 0 ? route.slice(at) : '';
}

/** What a browser is opened at, host aside: the path, the query, then the route (`/shop?page=2#/cart`). */
// Decision: G-306
export function openPath(url: string): string {
  const u = new URL(url);
  return u.pathname + u.search + (routeOf(url) ?? '');
}

/**
 * Campaign and click-id parameters (Google, Meta, Microsoft, Mailchimp, HubSpot...). HubSpot's `__hstc`, `__hssc` and `__hsfp` (its
 * visitor cookie, session and fingerprint, written onto links that leave a HubSpot page) are one visit's, never a page's: on
 * irthsolutions.com (2026-11-08) one login page under 86 of them took 86 of the 100 outside links the crawl asks (G-663).
 */
const TRACKING = new Set(['gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'msclkid', 'yclid', 'twclid', 'ttclid', 'li_fat_id', 'igshid', 'mc_cid', 'mc_eid', '_ga', '_gl', '_hsenc', '_hsmi', '__hstc', '__hssc', '__hsfp', 'mkt_tok', 'srsltid']);

/**
 * An address as written (an href, "/about.htm;jsessionid=..."; absolute or not) without its session id
 * (G-305): the same cut normalizeUrl makes, for the places that keep the text a page wrote, which a
 * suite looks a link up by.
 */
export function withoutSession(text: string): string {
  const hash = text.indexOf('#');
  const head = hash < 0 ? text : text.slice(0, hash);
  const tail = hash < 0 ? '' : text.slice(hash);
  const q = head.indexOf('?');
  const path = (q < 0 ? head : head.slice(0, q)).replace(SESSION_PATH_PARAMETER, '');
  if (q < 0) return path + tail;
  const kept = head.slice(q + 1).split('&').filter((pair) => !SESSION_QUERY.has(pair.split('=')[0].toLowerCase()));
  return path + (kept.length ? `?${kept.join('&')}` : '') + tail;
}

export function isTracking(name: string): boolean {
  const n = name.toLowerCase();
  return n.startsWith('utm_') || TRACKING.has(n);
}

/**
 * A page's identity for "have we read it already": its normalized URL with a trailing slash taken
 * off the path (/about/ and /about are one page to a visitor, and many servers answer both
 * without redirecting). The URL itself is kept as found; only the comparison ignores the slash.
 */
export function pageKey(url: string): string {
  const u = new URL(url);
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '') || '/';
  return u.href;
}

/** True when both URLs share scheme, host and port. */
export function sameOrigin(a: string, b: string): boolean {
  return new URL(a).origin === new URL(b).origin;
}

/**
 * File types a browser would download or render as media rather than as a page. Links to them are
 * recorded in the report but never opened: opening a PDF makes Chromium start a download.
 */
const NON_HTML_EXTENSIONS = new Set([
  'pdf', 'zip', 'gz', 'tgz', 'rar', '7z', 'tar',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'tif', 'tiff',
  'mp3', 'mp4', 'm4a', 'wav', 'ogg', 'webm', 'mov', 'avi',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'xml', 'json', 'rss',
  'exe', 'msi', 'dmg', 'pkg', 'apk', 'iso', 'jar',
  'css', 'js', 'woff', 'woff2', 'ttf', 'otf',
]);

export function looksLikeNonHtml(url: string): boolean {
  const path = new URL(url).pathname;
  const last = path.slice(path.lastIndexOf('/') + 1);
  const dot = last.lastIndexOf('.');
  if (dot <= 0) return false;
  return NON_HTML_EXTENSIONS.has(last.slice(dot + 1).toLowerCase());
}

/**
 * Sign-in, sign-out and account pages, by their address: /wp-login.php, /wp-admin/, /login,
 * /sign-in, /logout, /my-account, ?action=logout. The crawl reads public pages only, and a test
 * that clicks "Sign In" tests the site's sign-in (site-c.example opens its own window with a script and
 * never goes to /wp-login.php), not its navigation. Whole path segments only: /login-help and
 * /register (a dog registry's) are pages like any other.
 */
/** Where a visitor signs in: the page a signed-in crawl signs in on (docs/LOGIN-PLAN.md). */
const LOGIN_SEGMENTS = new Set(['wp-login.php', 'login', 'log-in', 'logon', 'signin', 'sign-in']);
/**
 * Pages that end a session, or undo an account, by being opened: never followed, signed in or not. A site
 * that deletes an account on a GET is careless, and common enough (the fixture library's /account/delete).
 */
// Decision: G-157
const NEVER_FOLLOW_SEGMENTS = new Set([
  'logout', 'log-out', 'signout', 'sign-out',
  'delete', 'delete-account', 'remove', 'remove-account', 'close-account', 'deactivate', 'unsubscribe', 'reset-password', 'reset',
]);
/** A signed-in area: an account or an admin. Read only by a crawl signed in as a role that may. */
const ADMIN_SEGMENTS = new Set(['wp-admin', 'account', 'my-account', 'myaccount']);

/** Which kind of sign-in address a URL is, by whole path segment or its ?action=; null for a public page. */
export function signInKind(url: string): 'login' | 'never-follow' | 'admin' | null {
  const u = new URL(url);
  const action = u.searchParams.get('action')?.toLowerCase();
  if (action === 'logout' || action === 'delete' || action === 'unsubscribe') return 'never-follow';
  if (action === 'login') return 'login';
  const segments = addressPath(url).split('/').map((s) => s.toLowerCase());
  if (segments.some((s) => NEVER_FOLLOW_SEGMENTS.has(s))) return 'never-follow';
  if (segments.some((s) => LOGIN_SEGMENTS.has(s))) return 'login';
  if (segments.some((s) => ADMIN_SEGMENTS.has(s))) return 'admin';
  return null;
}

/** Path segments that do something when opened: add to a cart, a basket or a wish list, or take out of one. */
const ACTION_SEGMENTS = new Set([
  'add-to-cart', 'addtocart', 'add_to_cart', 'add-to-basket', 'add-to-bag', 'add-to-wishlist', 'add-to-wish-list', 'remove-from-cart', 'remove-from-basket',
]);

/**
 * A link that does something when it is opened (adds a book to a cart), by a path segment or a query
 * parameter (?add-to-cart=12): never followed, so the crawl leaves the site as it found it and reads
 * the cart a test's fresh browser will see (G-095).
 */
// Decision: G-170
export function isActionLink(url: string): boolean {
  const u = new URL(url);
  if ([...u.searchParams.keys()].some((k) => ACTION_SEGMENTS.has(k.toLowerCase()))) return true;
  return addressPath(url).split('/').some((s) => ACTION_SEGMENTS.has(s.toLowerCase()));
}

/** Any of the three: what an anonymous crawl leaves alone. */
// Decision: G-021
export function looksLikeSignIn(url: string): boolean {
  return signInKind(url) !== null;
}

/** A page's address as a person reads it on its own site: the path and its query (/p and /p?page=2 are two pages). */
export function shownPath(url: string): string {
  return openPath(url);
}

/** The path plus query string, which is what robots.txt rules are matched against. */
// Decision: G-021
export function robotsPath(url: string): string {
  const u = new URL(url);
  return u.pathname + u.search;
}

/**
 * The URL's pattern: its path with the last segment, and any all-digit segment, wildcarded;
 * a query string is marked with ?. /pokedex/bulbasaur -> /pokedex/*, /news/348/a-title ->
 * /news/{n}/*, /search?q=x -> /*?.
 */
/** A folder's index file: index.html, default.aspx, home.php. */
const INDEX_FILE = /^(index|default|home)\.(html?|php|aspx?|jsp)$/i;
/** A listing's page number as one segment: page-2.html, page_3, page1. */
const PAGE_FILE = /^page[-_]?\d+(\.\w+)?$/i;

/**
 * The segment of an address that names the page: the last, skipping a listing's page number (/tag/love/page/2/
 * and /catalogue/page-2.html are pages of love and of the catalogue) and a folder's index file
 * (/books/travel/index.html is travel's). "" for the top page. A page's own name is masked out of its headings
 * (src/pages/similarity.ts) and title (src/group/page-name.ts), so named by its page number, "Viewing tag: love"
 * on page 1 of a tag kept the tag's name, and quotes.toscrape.com's 128 tag pages were 128 page types
 * (2026-10-16), each unlike the next by a word.
 */
// Decision: G-226
export function nameSegment(url: string): string {
  const segments = addressPath(url).split('/').filter(Boolean);
  const last = () => segments[segments.length - 1] ?? '';
  if (INDEX_FILE.test(last())) segments.pop();
  if (PAGE_FILE.test(last())) segments.pop();
  else if (segments.length >= 2 && /^\d+$/.test(last()) && /^page$/i.test(segments[segments.length - 2])) segments.splice(-2);
  return last();
}

/**
 * A page read as a role (signed in) is its address with the role in a fragment: /account#as=member
 * (G-145). The crawl strips every fragment a site links with (normalizeUrl), so this one is never a
 * site's own. Every map, set and history keyed by address then tells the signed-in page from the
 * public one with no field of its own; a page read anonymously carries no mark, so it is as before.
 */
const ROLE_MARK = '#as=';

/** The role a page was read as; null for a page read anonymously. */
export function roleOf(url: string): string | null {
  const at = url.indexOf(ROLE_MARK);
  return at < 0 ? null : decodeURIComponent(url.slice(at + ROLE_MARK.length));
}

/** The address a browser opens: the page's address without its role. */
export function withoutRole(url: string): string {
  const at = url.indexOf(ROLE_MARK);
  return at < 0 ? url : url.slice(0, at);
}

export function urlPattern(url: string): string {
  return patterns(url);
}

/**
 * `f` worked out once for each text it is asked of: the grouping asks an address's pattern for every pair it is in
 * (item 52's scale tests). Kept to `limit` texts, then begun again, so a long-lived process does not grow without end.
 */
// Not a heuristic: a cache's bound, so memory stays bounded; any size gives the same answers.
export function remembered<T>(f: (text: string) => T, limit = 50_000): (text: string) => T {
  const seen = new Map<string, T>();
  return (text) => {
    if (seen.has(text)) return seen.get(text) as T;
    if (seen.size >= limit) seen.clear();
    const value = f(text);
    seen.set(text, value);
    return value;
  };
}

const patterns = remembered((url: string) => {
  // The role is part of the pattern: the account page signed in is another page type's (G-145).
  const role = roleOf(url);
  return role === null ? addressPattern(url) : `${addressPattern(url)}${ROLE_MARK}${encodeURIComponent(role)}`;
});

function addressPattern(url: string): string {
  const search = addressSearch(url);
  const segments = addressPath(url).split('/').filter(Boolean);
  if (segments.length === 0) return search ? '/?' : '/';
  // The part that varies is the last segment, unless that is a folder's index file: then it is the
  // segment before it (books.toscrape.com: /catalogue/category/books/travel_2/index.html, one of 50
  // categories, is /catalogue/category/books/*/index.html, not a pattern of its own).
  const indexFile = segments.length >= 2 && INDEX_FILE.test(segments[segments.length - 1]);
  const varies = indexFile ? segments.length - 2 : segments.length - 1;
  const key = segments.map((s, i) => (i === varies ? '*' : /^\d+$/.test(s) ? '{n}' : s)).join('/');
  return `/${key}${search ? '?' : ''}`;
}

/**
 * What someone types to start a crawl: "www.example.com" or "example.com/careers" become https://
 * URLs; anything with a scheme is left as it is (so ftp:// is still refused later).
 */
export function startUrlFromArg(arg: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(arg)) return arg;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i.test(arg)) return `https://${arg}`;
  return arg;
}

/**
 * An address no site has, for asking it what it says to a page that does not exist: the same for a
 * site every time (a hash of its host name), so a recrawl asks the same address.
 */
export function notFoundPath(origin: string): string {
  let hash = 0x811c9dc5;
  for (const c of new URL(origin).hostname) hash = Math.imul(hash ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return `/forecursor-no-such-page-${hash.toString(16).padStart(8, '0')}`;
}
