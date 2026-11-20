/**
 * The lead finder's keys (TODO 4.4): one named environment variable per keyed `in` source of docs/SOURCES.md, read only where a
 * fetch uses it; the local page says "key present" or "needs a key from Ghost" per source and never carries a key; a source without its key
 * is skipped and said so. Every key here is made up and joined at run time from pieces (CLAUDE.md), so no key-shaped literal is in
 * this file; the environment is the test's own (`vi.stubEnv`), restored after each test.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYED_SOURCES, keyStates, skipLine, withKey } from '../../src/project/keys.js';
import { servePage, type ServedPage } from '../../src/project/serve.js';
import { MADE_UP_KEYS } from '../support/made-up-keys.js';
import { findSecrets } from '../support/secret-shapes-before-gate.js';
import { keysOf, parseSources, sourcesText } from '../support/sources.js';

/** A made-up key in the shape Jooble's take (hex groups), joined from pieces at run time. */
const madeUp = (seed: string): string => [`${seed}7f3a9c`, 'b2e4', '4d1f', '9a6c', `e0d8${seed}5b71c2`].join('-');
/** A run a key could be: 20 or more letters, digits, `_` or `-`, holding a letter and a digit (the secret scan's generic value). */
const KEY_SHAPED = /[A-Za-z0-9_-]{20,}/g;
const keyShaped = (text: string): string[] => [...text.matchAll(KEY_SHAPED)].map((m) => m[0]).filter((run) => /[0-9]/.test(run) && /[A-Za-z]/.test(run));

const VARIABLES = KEYED_SOURCES.flatMap((k) => k.variables);
const stubAll = (value: (name: string) => string | undefined): void => VARIABLES.forEach((name) => vi.stubEnv(name, value(name)));

let root: string;
let page: ServedPage | undefined;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ghostreach-keys-'));
});
afterEach(async () => {
  await page?.close();
  page = undefined;
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe('the keyed sources (docs/SOURCES.md)', () => {
  it("names exactly the in rows' key variables, each source by its row", () => {
    const rows = parseSources(sourcesText()).filter((r) => r.status === 'in' && keysOf(r.key).length > 0);
    expect(KEYED_SOURCES.map((k) => `${k.source}: ${k.variables.join(', ')}`)).toEqual(rows.map((r) => `${r.source}: ${keysOf(r.key).join(', ')}`));
  });
  it('says present only when every variable is set, and blank is not set', () => {
    stubAll(() => undefined);
    vi.stubEnv('JOOBLE_API_KEY', madeUp('a1'));
    vi.stubEnv('USAJOBS_API_KEY', madeUp('b2'));
    vi.stubEnv('USAJOBS_EMAIL', '  ');
    expect(keyStates().map((k) => `${k.source} ${k.present}`)).toEqual(['Jooble true', 'USAJOBS false']);
    expect(JSON.stringify(keyStates())).not.toContain(madeUp('a1'));
  });
});

describe('a source without its key is skipped and said so (TODO 4.4)', () => {
  it('does not run, and says the source and the variable, never a value', () => {
    const jooble = KEYED_SOURCES[0];
    const use = vi.fn(() => 'fetched');
    const result = withKey(jooble, use, {});
    expect(use).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: 'Jooble skipped: no key (set JOOBLE_API_KEY).' });
    expect(skipLine(KEYED_SOURCES[1])).toBe('USAJOBS skipped: no key (set USAJOBS_API_KEY and USAJOBS_EMAIL).');
  });
  it('skips USAJOBS with its key and no email', () => {
    expect(withKey(KEYED_SOURCES[1], () => 1, { USAJOBS_API_KEY: madeUp('c3') })).toEqual({ skipped: skipLine(KEYED_SOURCES[1]) });
  });
  it('hands the key, read when used, to the use alone', () => {
    const key = madeUp('d4');
    expect(withKey(KEYED_SOURCES[0], (k) => k.JOOBLE_API_KEY === key, { JOOBLE_API_KEY: ` ${key} ` })).toEqual({ ran: true });
  });
});

describe("the local page shows key present or absent, never a key (TODO 4.4's check)", () => {
  async function pageHtml(): Promise<string> {
    page = await servePage(join(root, 'Ghostreach'), async () => null);
    const res = await fetch(page.url);
    return res.text();
  }

  it('says key present for a set key, and the page holds no key-shaped string', async () => {
    stubAll((name) => (name === 'USAJOBS_EMAIL' ? 'someone@example.com' : madeUp(name.length.toString(16))));
    const html = await pageHtml();
    expect(html).toContain('Jooble <span class="state">key present</span>');
    expect(html).toContain('USAJOBS <span class="state">key present</span>');
    for (const name of VARIABLES) expect(html).not.toContain(process.env[name]);
    expect(findSecrets(html)).toEqual([]);
    expect(keyShaped(html)).toEqual([]);
  });
  it('holds no key of any shape the scanner knows, each set as Jooble\'s key in turn', async () => {
    for (const [shape, key] of Object.entries(MADE_UP_KEYS)) {
      vi.stubEnv('JOOBLE_API_KEY', key);
      const html = await pageHtml();
      expect(html.includes(key), shape).toBe(false);
      expect(findSecrets(html), shape).toEqual([]);
      await page?.close();
      page = undefined;
    }
  });
  it('says a source without its key needs one from Ghost, naming no variable (launch fixes 5)', async () => {
    stubAll(() => '');
    const html = await pageHtml();
    expect(html).toContain('Jooble <span class="state">needs a key from Ghost</span>');
    expect(html).toContain('USAJOBS <span class="state">needs a key from Ghost</span>');
    expect(html).not.toContain('skipped until');
  });
  it('would find a key had one reached the page (the check can fail)', async () => {
    stubAll(() => '');
    const html = await pageHtml();
    const planted = html.replace('</body>', `${MADE_UP_KEYS['GitHub token']}</body>`);
    expect(findSecrets(planted).length).toBeGreaterThan(0);
    expect(keyShaped(html.replace('</body>', `${madeUp('e5')}</body>`)).length).toBeGreaterThan(0);
  });
});
