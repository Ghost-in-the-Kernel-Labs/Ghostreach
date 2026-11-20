/**
 * A sign-in by another site, from one link or form (G-261; docs/SAVED-SESSION-PLAN.md, step 3): the known providers by
 * their own sign-in addresses, any provider by OAuth's shape, and a sign-in by its words alone; and what is none of
 * them (a provider's other pages, the site's own ways in, an address that is no web page).
 */
import { describe, expect, it } from 'vitest';
import { providerSignIn, type FoundSignInLink } from '../../src/crawl/providers.js';
import { providerList } from '../../src/crawl/report-read.js';

const PAGE = 'https://shop.example/login';
const link = (address: string, words = '', kind: FoundSignInLink['kind'] = 'link') => providerSignIn({ address, words, kind }, PAGE);
const said = (address: string, words = '') => {
  const s = link(address, words);
  return s && `${s.provider} ${s.evidence} ${s.address}${s.sameSite ? ' same-site' : ''}`;
};

describe('the known providers, by their own sign-in addresses', () => {
  it('Google, LinkedIn, Facebook, Microsoft, Apple and GitHub, each address kept without its query', () => {
    expect(said('https://accounts.google.com/o/oauth2/v2/auth?client_id=1&redirect_uri=x&state=abc', 'Continue')).toBe('Google address https://accounts.google.com/o/oauth2/v2/auth');
    expect(said('https://accounts.google.com/gsi/select?client_id=1')).toBe('Google address https://accounts.google.com/gsi/select');
    expect(said('https://www.linkedin.com/oauth/v2/authorization?client_id=1')).toBe('LinkedIn address https://www.linkedin.com/oauth/v2/authorization');
    expect(said('https://linkedin.com/oauth/v2/authorization')).toBe('LinkedIn address https://linkedin.com/oauth/v2/authorization');
    expect(said('https://www.facebook.com/v19.0/dialog/oauth?client_id=1')).toBe('Facebook address https://www.facebook.com/v19.0/dialog/oauth');
    expect(said('https://m.facebook.com/dialog/oauth')).toBe('Facebook address https://m.facebook.com/dialog/oauth');
    expect(said('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=1')).toBe('Microsoft address https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(said('https://login.live.com/oauth20_authorize.srf')).toBe('Microsoft address https://login.live.com/oauth20_authorize.srf');
    expect(said('https://appleid.apple.com/auth/authorize?client_id=1')).toBe('Apple address https://appleid.apple.com/auth/authorize');
    expect(said('https://github.com/login/oauth/authorize?client_id=1')).toBe('GitHub address https://github.com/login/oauth/authorize');
  });

  it('a host that only looks like a provider\'s, before or after, is none; nor its sign-in path under another', () => {
    for (const address of [
      'https://evil-linkedin.com/oauth/v2/authorization', 'https://linkedin.com.evil.test/oauth/v2/authorization', 'https://www.linkedin.com/x/oauth/v2',
      'https://evilfacebook.com/dialog/oauth', 'https://x.facebook.com/dialog/oauth',
      'https://xlogin.live.com/oauth20_authorize.srf', 'https://login.live.com.evil.test/oauth20_authorize.srf', 'https://login.microsoftonline.com.evil.test/common',
      'https://xappleid.apple.com/auth/authorize', 'https://appleid.apple.com.evil.test/auth/authorize', 'https://appleid.apple.com/x/auth/authorize',
      'https://notgithub.com/login/oauth/authorize', 'https://github.com.evil.test/login/oauth/authorize', 'https://github.com/x/login/oauth/authorize',
    ]) expect(link(address, 'Go'), address).toBeNull();
    expect(said('https://facebook.com/dialog/oauth')).toBe('Facebook address https://facebook.com/dialog/oauth');
  });

  it('a provider\'s other pages are none: a company page, a profile, a repository, another host that ends the same', () => {
    for (const address of ['https://www.facebook.com/ourshop', 'https://www.linkedin.com/company/ourshop', 'https://github.com/ourshop/site', 'https://appleid.apple.com/account/manage', 'https://notaccounts.google.com/x', 'https://accounts.google.com.evil.test/o/oauth2/auth', 'https://www.facebook.com.evil.test/dialog/oauth']) {
      expect(link(address, 'Follow us'), address).toBeNull();
    }
  });
});

describe('any provider, by OAuth\'s shape or by its words', () => {
  it('an /authorize or /oauth address naming a client_id and a redirect_uri: named by its words, else its host', () => {
    expect(said('http://localhost:4000/authorize?response_type=code&client_id=library&redirect_uri=x&state=y', 'Sign in with Fixture ID')).toBe('Fixture ID oauth http://localhost:4000/authorize');
    expect(said('https://id.company.test/oauth2/authorize?client_id=1&redirect_uri=x')).toBe('id.company.test oauth https://id.company.test/oauth2/authorize');
    expect(said('https://sso.company.test/oauth/start?client_id=1&redirect_uri=x')).toBe('sso.company.test oauth https://sso.company.test/oauth/start');
    expect(said('https://sso.company.test/oauth?client_id=1&redirect_uri=x')).toBe('sso.company.test oauth https://sso.company.test/oauth');
    // The shape needs both: a client_id alone, or a redirect_uri alone, is some other page.
    expect(link('https://id.company.test/authorize?client_id=1')).toBeNull();
    expect(link('https://id.company.test/authorize?redirect_uri=x')).toBeNull();
    expect(link('https://id.company.test/authorized-users?client_id=1&redirect_uri=x')).toBeNull();
  });

  it('its words alone: "Sign in with", "Log in using", "Sign up via", "Continue with", "Connect through", on the site or off it', () => {
    expect(said('/auth/google', 'Sign in with Google')).toBe('Google words https://shop.example/auth/google same-site');
    expect(said('/auth/sso', '  Log  in using\n Okta. ')).toBe('Okta words https://shop.example/auth/sso same-site');
    expect(link('/auth/sso', '  Log  in using\n Okta. ')?.words).toBe('Log in using Okta.');
    // The words are the whole of them: not a sentence that mentions a sign-in, nor one that goes on.
    expect(link('/auth/g', 'Please sign in with Google')).toBeNull();
    // A provider whose name ends in what the site's own ways in are called is still one.
    expect(link('/auth/g', 'Sign in with Google Account')?.provider).toBe('Google Account');
    expect(said('/auth/x', 'Sign up via GitLab')?.split(' ')[0]).toBe('GitLab');
    expect(said('/auth/a', 'Continue with Apple')?.split(' ')[0]).toBe('Apple');
    expect(said('/auth/s', 'connect through Slack')?.split(' ')[0]).toBe('Slack');
    expect(said('/auth/s', 'Sign on with SSO')?.split(' ')[0]).toBe('SSO');
    expect(said('https://other.example/start', 'Signin with Acme')?.split(' ').slice(0, 2).join(' ')).toBe('Acme words');
  });

  it('the site\'s own ways in are none: email, a password, a phone, a passkey, an account, a code', () => {
    for (const words of ['Sign up with email', 'Continue with your email', 'Log in with password', 'Sign in with a passkey', 'Continue with phone', 'Sign in with an account', 'Sign in with a magic link', 'Continue with SMS', 'Sign in with the code', 'Sign in with e-mail', 'Continue with text message', 'Sign in with username']) {
      expect(link('/next', words), words).toBeNull();
    }
    for (const words of ['Sign in', 'Continue', 'Log in with', 'Sign in with G', 'Read more about signing in with Google', 'Sign in with Google to see more of what we have to offer you today friends']) expect(link('/next', words), words).toBeNull();
  });

  it('a form posted to start one; no address that is no web page; the words kept short, on one line', () => {
    expect(link('https://github.com/login/oauth/authorize', 'Sign in with GitHub', 'form')).toMatchObject({ provider: 'GitHub', via: 'form', words: 'Sign in with GitHub', page: PAGE, sameSite: false });
    for (const address of ['mailto:a@b.example', 'javascript:void(0)', 'ftp://accounts.google.com/x', 'http://[bad']) expect(link(address, 'Sign in with Google'), address).toBeNull();
    const long = link('https://accounts.google.com/x', `Sign in\n${'very '.repeat(30)}`);
    expect(long?.words).toHaveLength(80);
    expect(long?.words).not.toContain('\n');
  });
});

describe('providerList: each provider once, with its pages', () => {
  it('in the order found, each page once', () => {
    const at = (provider: string, page: string) => ({ page, provider, address: '', words: '', via: 'link' as const, evidence: 'words' as const, sameSite: false });
    expect(providerList([at('Fixture ID', 'http://x.test/login'), at('Google', 'http://x.test/login'), at('Google', 'http://x.test/join'), at('Google', 'http://x.test/login')])).toBe('Fixture ID at /login, Google at /login and /join');
  });
});
