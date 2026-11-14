/**
 * A sign-in by another site, from one link or form on a page (docs/SAVED-SESSION-PLAN.md, step 3; G-261): "Sign in
 * with Google" and its kind. Recorded, never followed: the crawl signs in only through a site's own form, and a
 * provider's sign-in is a person's to do (a later step keeps the session they make). Three kinds of evidence, the
 * surest first:
 *   address  a known provider's own sign-in address (accounts.google.com, www.linkedin.com/oauth, ...)
 *   oauth    OAuth's shape: an /authorize (or /oauth) address that names a client_id and a redirect_uri
 *   words    the link's or button's own words: "Sign in with GitHub", "Continue with Apple"
 */
import type { ProviderSignIn } from '../leaf/report.js';

/** What the reader found: a link's address, or a form's action, and the words a person reads on it. */
export interface FoundSignInLink {
  address: string;
  words: string;
  kind: 'link' | 'form';
}

/** The providers known by their sign-in address: a host, and the path a sign-in starts at on it (any, when none). */
const KNOWN: { provider: string; host: RegExp; path?: RegExp }[] = [
  { provider: 'Google', host: /^accounts\.google\.com$/ },
  { provider: 'LinkedIn', host: /^(www\.)?linkedin\.com$/, path: /^\/oauth\// },
  { provider: 'Facebook', host: /^(www\.|m\.)?facebook\.com$/, path: /\/dialog\/oauth\b/ },
  { provider: 'Microsoft', host: /^login\.(microsoftonline\.com|live\.com)$/ },
  { provider: 'Apple', host: /^appleid\.apple\.com$/, path: /^\/auth\/authorize\b/ },
  { provider: 'GitHub', host: /^github\.com$/, path: /^\/login\/oauth\// },
];

/** A sign-in's own words: "Sign in with X", "Log in using X", "Continue with X"; the provider, or null. */
const WITH = /^(?:(?:sign|log)\s*(?:in|on|up)|continue|connect)\s+(?:with|using|via|through)\s+(.{2,40}?)\.?$/i;

/** What "with" names when it is the site's own way in, not another site: "Sign up with email", "Continue with a passkey". */
const OWN_WAY = /^(?:(?:your|an?|the)\s+)?(?:e-?mail|phone|password|username|account|magic link|passkey|code|sms|text message)\b/i;

/** The provider a sign-in's words (on one line, trimmed) name, or null. */
function named(words: string): string | null {
  const provider = WITH.exec(words)?.[1] ?? null;
  return provider && !OWN_WAY.test(provider) ? provider : null;
}

/**
 * The sign-in by another site a link or form on `page` starts, or null when it starts none. Its address is kept
 * without its query (a sign-in link carries a state that changes every load).
 */
// Decision: G-261
export function providerSignIn(found: FoundSignInLink, page: string): ProviderSignIn | null {
  let url: URL;
  try {
    url = new URL(found.address, page);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const words = found.words.replace(/\s+/g, ' ').trim().slice(0, 80);
  const known = KNOWN.find((k) => k.host.test(url.hostname) && (!k.path || k.path.test(url.pathname)));
  const oauth = /(^|\/)(authorize|oauth2?)(\/|$)/i.test(url.pathname) && url.searchParams.has('client_id') && url.searchParams.has('redirect_uri');
  const byWords = named(words);
  const evidence = known ? 'address' : oauth ? 'oauth' : byWords ? 'words' : null;
  if (!evidence) return null;
  return {
    page,
    provider: known?.provider ?? byWords ?? url.hostname,
    address: `${url.origin}${url.pathname}`,
    words,
    via: found.kind,
    evidence,
    sameSite: url.origin === new URL(page).origin,
  };
}
