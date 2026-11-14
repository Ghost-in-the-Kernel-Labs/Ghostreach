/**
 * Reader: each link and form on a loaded page that could start a sign-in by another site, with its address and the
 * words a person reads on it (G-261). Facts only: which are sign-ins is providers.ts's to say, and the crawl
 * follows none of them.
 * In the page: SELF-CONTAINED: inPage goes to page.evaluate() whole, so it uses nothing this file imports or declares beside it.
 */
import type { Page } from 'playwright';
import type { FoundSignInLink } from '../providers.js';

/** Run in the page (no imports): every link's address and words, every form's action and its buttons' words. */
function inPage(): FoundSignInLink[] {
  const words = (el: Element) => ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
  const out: FoundSignInLink[] = [];
  for (const a of Array.from(document.querySelectorAll('a[href]'))) out.push({ address: (a as HTMLAnchorElement).href, words: words(a), kind: 'link' });
  for (const form of Array.from(document.querySelectorAll('form'))) {
    const buttons = Array.from(form.querySelectorAll('button, input[type="submit"], input[type="image"]'));
    const said = buttons.map((b) => (b instanceof HTMLInputElement ? b.value || b.alt : words(b))).filter(Boolean);
    out.push({ address: (form as HTMLFormElement).action, words: said.join(' ') || words(form), kind: 'form' });
  }
  return out;
}

/** The links and forms of the page, as found; none when the page cannot be read. */
export async function readSignInLinks(page: Page): Promise<FoundSignInLink[]> {
  const found = await page.evaluate(inPage).catch(() => [] as FoundSignInLink[]);
  return Array.isArray(found) ? found : [];
}
