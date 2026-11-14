/**
 * Reader: the page's sign-in forms (docs/LOGIN-PLAN.md, step 2), found in the page by
 * collectLoginForms (controls-page.ts, bundled into CONTROLS_SCRIPT), each given its role. Read only:
 * the crawl never types into one or sends it.
 */
import type { Page } from 'playwright';
import { CONTROLS_SCRIPT } from '../controls-script.js';
import type { FoundLoginForm, LoginForm } from '../../leaf/report.js';

export async function readLoginForms(page: Page): Promise<FoundLoginForm[]> {
  const forms = await page
    .evaluate(`(() => { ${CONTROLS_SCRIPT}; return globalThis.__suiteBuilderLoginForms(); })()`)
    .catch(() => [] as FoundLoginForm[]);
  return Array.isArray(forms) ? (forms as FoundLoginForm[]) : [];
}

/** Address segments of an admin area: /admin/login, /wp-admin/, /administrator. */
const ADMIN_SEGMENTS = new Set(['admin', 'wp-admin', 'administrator', 'administration']);
/** Words that name an admin's sign-in: "Administrator sign in", "Admin login". */
const ADMIN_WORDS = /\b(admin|administrator|administration)\b/i;

/**
 * A login form's role, and what decided it: admin when its address or its words (the form's name, the
 * heading by it, the page's title) name an admin area; user otherwise, with no evidence, since nothing
 * named it admin. The heading is no name for the form (G-752) but is evidence of its role.
 */
// Decision: G-155
export function loginRole(url: string, title: string, form: string | null, heading?: string | null): Pick<LoginForm, 'role' | 'evidence'> {
  const evidence: string[] = [];
  const path = new URL(url).pathname;
  if (path.split('/').some((s) => ADMIN_SEGMENTS.has(s.toLowerCase()))) evidence.push(`address ${path}`);
  for (const words of [form, heading, title]) {
    const line = `words "${words}"`;
    if (words && ADMIN_WORDS.test(words) && !evidence.includes(line)) evidence.push(line);
  }
  return { role: evidence.length > 0 ? 'admin' : 'user', evidence };
}
