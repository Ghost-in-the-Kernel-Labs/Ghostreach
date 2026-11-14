/**
 * The sign-ins a crawl finds, never sent and never followed (state.ts, CrawlState, which delegates here): the site's own
 * sign-in forms (CrawlReport.loginForms) and the sign-ins by another site (CrawlReport.providerSignIns, G-261). Moved out of
 * state.ts by what it does, for the 400-line target (C-022, C-023, J-014): the bodies are the parent's.
 */
import { pageKey } from '../leaf/pages/url.js';
import type { FoundLoginForm, LoginForm, ProviderSignIn } from '../leaf/report.js';
import { providerSignIn, type FoundSignInLink } from './providers.js';
import { loginRole } from './readers/login.js';

export class SignIns {
  /** The sign-in forms found so far, never sent (CrawlReport.loginForms). */
  readonly #loginForms: LoginForm[] = [];
  /** The sign-ins by another site found so far, never followed (CrawlReport.providerSignIns, G-261). */
  readonly #providerSignIns: ProviderSignIn[] = [];
  /** The same-site addresses that start one (/auth/google): refused as sign-in, never followed. */
  readonly #providerStarts = new Set<string>();

  /** The lists as the report takes them (state-report.ts); CrawlState hands the crawl read-only views. */
  get loginForms(): LoginForm[] {
    return this.#loginForms;
  }
  get providerSignIns(): ProviderSignIn[] {
    return this.#providerSignIns;
  }
  get providerStarts(): ReadonlySet<string> {
    return this.#providerStarts;
  }

  /** A sign-in form found on a page, given its role; one already recorded there (the same password field) is not recorded again. */
  addLoginForm(url: string, title: string, found: FoundLoginForm, via: LoginForm['via']): LoginForm | null {
    if (this.#loginForms.some((f) => f.url === url && f.password.xpath === found.password.xpath)) return null;
    const form: LoginForm = { url, via, form: found.form, ...loginRole(url, title, found.form, found.heading),username: found.username, password: found.password, submit: found.submit };
    this.#loginForms.push(form);
    return form;
  }

  /** Each link or form on a page that starts a sign-in by another site, recorded once a page and provider; the ones recorded. */
  addProviderSignIns(page: string, found: FoundSignInLink[]): ProviderSignIn[] {
    const added: ProviderSignIn[] = [];
    for (const f of found) {
      const signIn = providerSignIn(f, page);
      if (!signIn) continue;
      if (signIn.sameSite) this.#providerStarts.add(pageKey(signIn.address));
      if (this.#providerSignIns.some((s) => s.page === page && s.provider === signIn.provider)) continue;
      this.#providerSignIns.push(signIn);
      added.push(signIn);
    }
    return added;
  }
}
