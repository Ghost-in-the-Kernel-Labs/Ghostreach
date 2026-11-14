/**
 * Reader: the page's buttons, fields and dropdowns, each with the locator ladder's locator. Read
 * only: nothing is clicked or typed. The in-page part is controls-page.ts and locator-ladder/, bundled
 * into CONTROLS_SCRIPT. Each control is held again in Node (`heldControl`): a hostile page can rewrite the
 * built-ins the in-page half calls.
 */
import type { Frame, Page } from 'playwright';
import { CONTROLS_SCRIPT } from '../controls-script.js';
import type { PageControl } from '../../leaf/report.js';

export async function readControls(page: Page | Frame): Promise<PageControl[]> {
  const controls = await page
    .evaluate(`(() => { ${CONTROLS_SCRIPT}; return globalThis.__suiteBuilderControls(${JSON.stringify({})}); })()`)
    .catch(() => [] as PageControl[]);
  // The page's own code can rewrite what the in-page half calls: each control is held again here, its guards dropped.
  return Array.isArray(controls) ? controls.map((c) => heldControl(c)).filter((c): c is PageControl => c !== null) : [];
}

/** The fields the parent's guards reading kept on a control: never kept here (the guards are never read, GR-003), whatever a page writes. */
const GUARD_KEYS = ['limits', 'pattern', 'patternLong', 'autocomplete', 'inputMode', 'requiredAria'] as const;

/** The flags a check reads off a control: each kept only when exactly true, as the in-page code writes it. */
const FLAGS = ['required', 'disabled', 'noValidate'] as const;

/**
 * A control as a reading answered it (Node), none of its guards kept. What a check reads besides is held (the second
 * review of the fix, 2026-11-12): `required`, `disabled` and `noValidate` exactly true or not kept, `form` a text or none,
 * `words` its texts alone. Null when it is no control: no kind or no locator as text.
 */
// Decision: G-728
function heldControl(c: unknown): PageControl | null {
  if (!c || typeof c !== 'object') return null;
  const seen = c as Record<string, unknown>;
  if (typeof seen.kind !== 'string' || typeof seen.xpath !== 'string') return null;
  const control = { ...(c as PageControl) };
  for (const key of GUARD_KEYS) delete (control as Record<string, unknown>)[key];
  for (const flag of FLAGS) {
    if (seen[flag] === true) control[flag] = true;
    else delete control[flag];
  }
  if (typeof seen.form !== 'string') delete control.form;
  control.words = Array.isArray(seen.words) ? seen.words.filter((w): w is string => typeof w === 'string') : [];
  return control;
}
