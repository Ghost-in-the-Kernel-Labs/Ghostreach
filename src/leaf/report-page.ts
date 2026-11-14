/**
 * The crawl report's parts of one page (report.ts's CrawledPage): what its load showed, its markup, its frames, its sign-in
 * forms, its controls and its in-page links. Moved out of report.ts, unchanged, to keep each file under the largest-file
 * target (docs/AGENT.md); report.ts re-exports what the other modules read.
 */

/**
 * What a page's load showed (src/crawl/load-watch.ts, G-201): its timing, its failed requests, its
 * scripts' errors, its insecure requests, and some of its own response headers. Each absent when none.
 */
export interface PageLoad {
  /** From the request to the first byte of the page's answer, ms (navigation timing), to 100 ms; kept from H.TIMING_FLOOR_MS on. */
  firstByteMs?: number;
  /** From the request to the page's load event, ms, to 100 ms, kept from H.TIMING_FLOOR_MS on; images, media and fonts not fetched, so a visitor's is longer. */
  loadMs?: number;
  /**
   * The page's load event had not fired `afterMs` after its document was parsed (H.LOAD_WAIT_MS): the crawl read the page as it stood
   * and went on (G-615). Not a measured load time, so `loadMs` is absent on such a page. `hosts`: the hosts, by name only (no path, no query),
   * of the requests still pending at that moment, `own` when it is the page's own host; absent when none was listed. Since 2026-11-06.
   */
  unfinished?: { afterMs: number; hosts?: { host: string; own: boolean }[] };
  /** Scripts, style sheets and data requests that answered an error or nothing: "/js/app.js (404)". */
  failed?: Sample;
  /**
   * Data requests (fetch, XHR) to another site's host that answered an error or nothing: "log.example.com/event (ERR_NAME_NOT_RESOLVED)".
   * Kept apart from `failed`: a third party's logging, most often, which the page may not need (G-377). Since 2026-11-04.
   */
  failedElsewhere?: Sample;
  /** Scripts and style sheets on another site's host that answered an error or nothing: "player.example.net/api.js (403)". Kept apart from `failed`: many such services turn an automated visitor away (G-657). Since 2026-11-08. */
  failedOtherSite?: Sample;
  /** Errors the page's own scripts threw and nothing caught (since 2026-11-08, those whose stack starts on another site's script are apart; since 2026-11-11, those whose stack names no script, G-734). */
  scriptErrors?: Sample;
  /** Errors thrown by another site's script (the first address in the error's stack is on another site's host), nothing catching them (G-657). Since 2026-11-08. */
  scriptErrorsOtherSite?: Sample;
  /**
   * Errors nothing caught whose stack names no script address ("A network error occurred.", a browser's own error; a thrown value
   * that is not an Error): which script threw them, the site's or another's, the crawl cannot tell (G-734). Since 2026-11-11.
   */
  scriptErrorsUnknownSource?: Sample;
  /** http:// requests from an https page (mixed content). */
  insecure?: Sample;
  /** Some of the page's own response headers, lower-cased: strict-transport-security, content-security-policy, x-frame-options, x-content-type-options, server, x-powered-by. */
  headers?: Record<string, string>;
  /** Words of the page that may name the software it runs (TODO 62, G-701): recorded as the page gave them, judged by nobody here. Since 2026-11-10. */
  software?: SoftwareWords;
}

/**
 * What a page gave away of the software it runs, as it gave it (TODO 62, G-701): read from what the browser already loaded, nothing
 * asked. `files`: its script and style sheet addresses whose file name holds a dotted number or whose query names `ver=`, said as
 * load-watch says an address (the path on the site, host and path elsewhere) with only the `ver=` of the query kept;
 * `generator`: its `<meta name="generator">` content; `banners`: the opening comment of each script it loaded whose first lines
 * hold a dotted number. Each cut short, at most H.SOFTWARE_WORDS_MAX of each; each absent when there is none.
 */
export interface SoftwareWords {
  files?: string[];
  generator?: string;
  banners?: string[];
}

/** Some of what a page shows of one kind: how many, and the first few, each said in a few words. */
export interface Sample {
  count: number;
  first: string[];
}

/**
 * A page's markup as the audit reads it (readers/markup.ts). Each sample is only what a visitor
 * could see; absent when there is none.
 */
export interface PageMarkup {
  /** The html element's lang; null without one. */
  lang: string | null;
  /** The viewport meta tag's content; null without one. */
  viewport: string | null;
  /** The meta description; null without one. */
  description: string | null;
  /** Links and buttons with nothing for a screen reader to say: no text, label, title or image alt. */
  unnamed?: Sample;
  /** Fields with no label: none pointing at them, no aria-label or title, and no placeholder (before 2026-11-08, a field with only a placeholder too). */
  unlabelled?: Sample;
  /** Fields whose only name is a placeholder: no label, aria-label or title (G-665; since 2026-11-08). */
  placeholderOnly?: Sample;
  /** Images with no alt attribute at all (alt="" says the image is decoration, and counts). */
  noAlt?: Sample;
  /** Images with no address (an empty src): drawn as a broken box. Whether an image loads is not read: the crawl fetches none. */
  noSrc?: Sample;
  /** Links to a place on the page (#part) that no element on it has. */
  deadAnchors?: Sample;
  /** Text left from building the site: lorem ipsum, TODO:, test strings. */
  placeholder?: Sample;
  /** The latest year a copyright notice names, and the year the crawl read it. */
  copyright?: { year: number; seen: number };
}

/**
 * A frame on a crawled page (readers/frames.ts). `path` finds it: the locator of each frame element
 * to go through, in the document that holds it, outermost first, this frame's last. A frame on the
 * site is read (`headings`, `links`, `controls`); another site's is recorded, never read.
 */
export interface PageFrame {
  path: string[];
  /** The address it loaded; null for a srcdoc frame, which has none. */
  url: string | null;
  /** On the site's own origin, or with no address of its own (srcdoc, about:blank). */
  sameSite: boolean;
  /** Displayed with a size a visitor sees: false for a hidden captcha frame. */
  shown: boolean;
  /** Set when its address is on a host the suites block as ads (G-049). */
  ad?: true;
  title: string | null;
  width: number;
  height: number;
  /** What a same-site frame shows, read as a page's are. Absent when it shows none, or is another site's. */
  headings?: string[];
  links?: { href: string; text: string }[];
  controls?: PageControl[];
}

/** A field or button of a login form: its locator, and what a person calls it. */
interface LoginField {
  xpath: string;
  words: string[];
}

/** A sign-in form on the page, as found in it (controls-page.ts): its fields by locator and words, the form's name. Its role is decided outside (readers/login.ts). */
export interface FoundLoginForm {
  form: string | null;
  /** The heading by the form: never its name (G-752), only evidence of its role (G-155). Absent when there is none. */
  heading?: string;
  username: LoginField | null;
  password: LoginField;
  submit: LoginField | null;
}

/**
 * A sign-in form the crawl found (docs/LOGIN-PLAN.md, step 2; since report version 6), never sent:
 * where, its role and why, its fields. `via`: on a page the crawl read (one a redirect led to,
 * /admin to /admin/login), or on a sign-in link's page, opened only to read its form.
 */
export interface LoginForm {
  url: string;
  via: 'page' | 'sign-in-link';
  form: string | null;
  role: 'user' | 'admin';
  /** What named it admin: its address, or words on it ('address /admin/login', 'words "Administrator sign in"'); empty for user. */
  evidence: string[];
  username: LoginField | null;
  password: LoginField;
  submit: LoginField | null;
}

/**
 * A sign-in by another site the crawl found (docs/SAVED-SESSION-PLAN.md, step 3; G-261): "Sign in with Google" on a
 * page, recorded and never followed. `address`: where it starts, without its query (its state changes every load).
 * `evidence`: `address` (a known provider's own), `oauth` (OAuth's shape: client_id and redirect_uri), `words`
 * ("Sign in with X" alone). `sameSite`: it starts on the site (/auth/google), which then sends the person on.
 */
export interface ProviderSignIn {
  page: string;
  provider: string;
  address: string;
  words: string;
  via: 'link' | 'form';
  evidence: 'address' | 'oauth' | 'words';
  sameSite: boolean;
}

/** A control on a crawled page (not a link): what the AI looks up to turn a story's words into a locator. */
export interface PageControl {
  /** button, text field, email field, dropdown, checkbox, radio, text area, tab, expander... */
  kind: string;
  /** What a person calls it: its label, text, aria-label, placeholder... most direct first (up to 3). */
  words: string[];
  region: 'header' | 'footer' | 'main';
  /** The form it is in, by its label or the heading above it ("Contact Us", "search"). */
  form?: string;
  /** The page requires it (the `required` attribute, or aria-required): a form is not sent without it. */
  required?: true;
  /** A dropdown's first options a visitor can choose (at most five; a disabled or hidden placeholder left out), as they read them; absent for other controls, and in reports before 2026-10-03. */
  options?: string[];
  /** A field that held a value as the page loaded (its own default, or one a script set, today's date say); `value` is what it held, when it is kept. Absent in reports before 2026-10-04. */
  filled?: true;
  /**
   * What a text field, range or text area held as the page loaded: its value attribute, or what a script set (G-322). A test
   * expects it, not an empty field. Never a password's, a box's or a colour's; absent for an empty field, one holding more than
   * 200 characters, and in reports before 2026-10-25. Dropped from a page read signed in (a person's details, G-197), where
   * `filled` still says it held something.
   */
  value?: string;
  /** Its value read differently on another visit (the second look, src/crawl/second-look.ts) or on another page of its type: a token, a time. A test does not check its value (G-322). Absent when it read the same, and in reports before 2026-10-25. */
  changes?: true;
  /** Its form has novalidate: the browser sends it whatever its required fields hold. Absent in reports before 2026-10-04. */
  noValidate?: true;
  /** Disabled as the page loaded (the disabled attribute, or aria-disabled): nothing can be typed into it yet. Absent in reports before 2026-10-04. */
  disabled?: true;
  /**
   * The locator ladder's XPath: relative, and unique on the page it was read from. For a control inside a web
   * component, its host's (XPath cannot reach into a shadow root): `shadow` says the rest of the way.
   */
  xpath: string;
  stability: 'Strong' | 'OK' | 'Fragile';
  /**
   * Inside a web component's open shadow root (G-222): the component (the innermost host's tag) and, from the
   * host `xpath` finds, a CSS selector per shadow root on the way, the control's last. Tested only in the
   * unstable family (TODO 38). Absent for a control in the document, and in reports before 2026-10-11.
   */
  shadow?: { component: string; inside: string[] };
  /**
   * Under --sec only (item 107, G-728 part 2, G-733): the limits the page writes on a field, as written (`min` and `max` as
   * text, a date's being text); absent when it has none, or the crawl was not asked --sec (`options.sec`).
   */
  limits?: GuardLimits;
  /** Under --sec only: the `pattern` attribute's text, when at most H.GUARD_PATTERN_CHARS_MAX characters; a longer one is not kept and `patternLong` says so. */
  pattern?: string;
  patternLong?: true;
  /** Under --sec only: the `autocomplete` attribute, lower case, at most 60 characters. */
  autocomplete?: string;
  /** Under --sec only: the `inputmode` attribute, lower case, at most 20 characters (for the report and --mobile; no test of it). */
  inputMode?: string;
  /**
   * Under --sec only, beside `required`: the page marks the field required by `aria-required` alone, or on an element that
   * is no form field, so the browser does not enforce it (a finding, never a check; G-728 part 5, GRD-07).
   */
  requiredAria?: true;
}

/** A field's limits as the page writes them (`PageControl.limits`; a length over 1,000,000 is not kept). */
interface GuardLimits {
  maxLength?: number;
  minLength?: number;
  min?: string;
  max?: string;
  step?: string;
}

/**
 * A `<form>` holding a control the crawl recorded, as --sec reads it (item 107, G-728 part 2): where and how it sends, never
 * what. `form` is the same string as its controls' `form`. `action`: the address the browser would send to, resolved,
 * scheme, host and path only, each segment's `;` parameters left out, at most H.GUARD_ACTION_CHARS_MAX characters (`actionQuery`: it had a query, never kept); another scheme than http or https, the scheme alone (`javascript:`). `hidden`: its hidden fields' names, at most
 * H.GUARD_HIDDEN_NAMES_MAX, each up to 60 characters; never a value. Which name reads as an anti-forgery token is src/sec/'s
 * decision, so the rule can change without a recrawl.
 */
export interface GuardForm {
  form: string;
  action: string;
  actionQuery?: true;
  method: 'get' | 'post' | 'dialog';
  hidden?: string[];
  /** True when the form has more hidden fields than H.GUARD_HIDDEN_NAMES_MAX: a name not kept may be its token. */
  hiddenMore?: true;
}

/** A link or control as the browser lists it for a visitor (its accessibility tree): its ARIA role and its accessible name. */
export interface BrowserControl {
  /** button, link, textbox, combobox, checkbox, radio, tab, menuitem... */
  role: string;
  /** Its accessible name (its words, label or aria-label); empty when it has none. */
  name: string;
  /** A link's address, as the page writes it. */
  url?: string;
  /**
   * Where it lives, found on the page for each one the readers did not record (G-222): inside an open shadow
   * root (its host's tag), in the cookie banner (the suite's CookieBanner's, never a gap), on the page itself
   * (its tag: the readers' own gap), or out of any script's reach
   * (the browser lists it, no script finds it: most likely a closed shadow root). Absent for one recorded,
   * and in reports before 2026-10-11.
   */
  where?: { in: 'shadow'; host: string } | { in: 'banner' } | { in: 'page'; tag: string } | { in: 'unreachable' };
}

/** What opens a dropdown: a link (by its href) or another control (by its tag), and its text. */
export type MenuTrigger = { href: string; text: string } | { tag: string; text: string };

/** An in-page link (`#employers`) and what it points at, as the page answered (readers/links.ts, anchors-page.ts). */
export interface PageAnchor {
  /** The link: its href as written, its text as an edge's, where it sits and whether a visitor sees it, as on LinkEdge. */
  href: string;
  text: string;
  region?: 'header' | 'footer' | 'banner';
  hidden?: true;
  /** The fragment decoded; whether an element has it (id, or an `<a name>`); that element's heading (itself, or the first inside). */
  id: string;
  exists: boolean;
  heading?: string;
  /** How many elements carry the target's id, when more than one; `top`: no element, so the top of the page (HTML's rule). */
  sameId?: number;
  top?: true;
  /** Its target has no box as the page loads (display:none, or not rendered: a tab panel, a hidden page), so a click cannot show it; absent when drawn, or no target. */
  undrawn?: true;
}
