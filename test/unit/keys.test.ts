/**
 * The lead finder's keys (TODO 4.4; GR-023): each keyed source's key from its environment variable, which wins, else from
 * `<data>/keys.json`, saved on the local page; the page says "Key saved", "No key yet" or "Key set on this computer by its
 * settings" and never carries a key, not even in part; a source without its key is skipped and said so. Every key here is made
 * up and joined at run time from pieces (CLAUDE.md), so no key-shaped literal is in this file; the environment is the test's own
 * (`vi.stubEnv`, or the env handed to the page), restored after each test.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYED_SOURCES, keysFile, keyStates, REFUSED, removeKey, saveKey, skipLine, withKey } from '../../src/project/keys.js';
import { KEY_SAID } from '../../src/project/page-leads.js';
import { servePage, type ServedPage } from '../../src/project/serve.js';
import type { Transport } from '../../src/project/fetch.js';
import { MADE_UP_KEYS } from '../support/made-up-keys.js';
import { findSecrets } from '../support/secret-shapes-before-gate.js';
import { keysOf, parseSources, sourcesText } from '../support/sources.js';

/** A made-up key in the shape Jooble's take (hex groups), joined from pieces at run time. */
const madeUp = (seed: string): string => [`${seed}7f3a9c`, 'b2e4', '4d1f', '9a6c', `e0d8${seed}5b71c2`].join('-');
/** A run a key could be: 20 or more letters, digits, `_` or `-`, holding a letter and a digit (the secret scan's generic value). */
const KEY_SHAPED = /[A-Za-z0-9_-]{20,}/g;
const keyShaped = (text: string): string[] => [...text.matchAll(KEY_SHAPED)].map((m) => m[0]).filter((run) => /[0-9]/.test(run) && /[A-Za-z]/.test(run));
/** Every piece of a key long enough to say something of it: its groups, and its first and last six characters. */
const partsOf = (key: string): string[] => [...key.split('-').filter((p) => p.length >= 6), key.slice(0, 6), key.slice(-6)];

const VARIABLES = KEYED_SOURCES.flatMap((k) => k.variables);
const stubAll = (value: (name: string) => string | undefined): void => VARIABLES.forEach((name) => vi.stubEnv(name, value(name)));
const EMAIL = ['someone', 'example.com'].join('@');

let root: string;
let data: string;
let page: ServedPage | undefined;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ghostreach-keys-'));
  data = join(root, 'Ghostreach');
});
afterEach(async () => {
  await page?.close();
  page = undefined;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('the keyed sources (docs/SOURCES.md)', () => {
  it("names exactly the in rows' key variables, each source by its row", () => {
    const rows = parseSources(sourcesText()).filter((r) => r.status === 'in' && keysOf(r.key).length > 0);
    expect(KEYED_SOURCES.map((k) => `${k.source}: ${k.variables.join(', ')}`)).toEqual(rows.map((r) => `${r.source}: ${keysOf(r.key).join(', ')}`));
  });
  it('says where each key comes from, the environment first, and blank is not set', () => {
    expect(keyStates(data, { JOOBLE_API_KEY: madeUp('a1'), USAJOBS_API_KEY: madeUp('b2'), USAJOBS_EMAIL: '  ' }).map((k) => `${k.source} ${k.from}`)).toEqual(['Jooble computer', 'USAJOBS null']);
    expect(saveKey(data, 'USAJOBS', { key: madeUp('b3'), email: EMAIL })).toBeUndefined();
    const states = keyStates(data, { JOOBLE_API_KEY: madeUp('a1') });
    expect(states).toEqual([{ source: 'Jooble', from: 'computer' }, { source: 'USAJOBS', from: 'page', email: EMAIL }]);
    for (const key of [madeUp('a1'), madeUp('b3')]) expect(JSON.stringify(states)).not.toContain(key);
  });
});

describe('a source without its key is skipped and said so (TODO 4.4)', () => {
  it('does not run, and says the source and where a key goes, never a value', () => {
    const use = vi.fn(() => 'fetched');
    expect(withKey(KEYED_SOURCES[0], use, {}, data)).toEqual({ skipped: 'Jooble skipped: no key yet (save one under Lead sources).' });
    expect(use).not.toHaveBeenCalled();
    expect(skipLine(KEYED_SOURCES[1])).toBe('USAJOBS skipped: no key yet (save one under Lead sources).');
  });
  it('skips USAJOBS with its key and no email', () => {
    expect(withKey(KEYED_SOURCES[1], () => 1, { USAJOBS_API_KEY: madeUp('c3') }, data)).toEqual({ skipped: skipLine(KEYED_SOURCES[1]) });
  });
  it('hands the key, read when used, to the use alone', () => {
    const key = madeUp('d4');
    expect(withKey(KEYED_SOURCES[0], (k) => k.JOOBLE_API_KEY === key, { JOOBLE_API_KEY: ` ${key} ` })).toEqual({ ran: true });
  });
});

describe('a key saved from the page (GR-023)', () => {
  it('is read from keys.json when the environment has none, and the environment wins when it has one', () => {
    const saved = madeUp('f1');
    const set = madeUp('f2');
    expect(saveKey(data, 'Jooble', { key: ` ${saved} ` })).toBeUndefined();
    expect(withKey(KEYED_SOURCES[0], (k) => k.JOOBLE_API_KEY, {}, data)).toEqual({ ran: saved });
    expect(withKey(KEYED_SOURCES[0], (k) => k.JOOBLE_API_KEY, { JOOBLE_API_KEY: set }, data)).toEqual({ ran: set });
    // Without the data folder, the environment alone.
    expect(withKey(KEYED_SOURCES[0], (k) => k.JOOBLE_API_KEY, {})).toEqual({ skipped: skipLine(KEYED_SOURCES[0]) });
  });
  it('takes USAJOBS with its email, and each part from where it is set', () => {
    const key = madeUp('f3');
    expect(saveKey(data, 'USAJOBS', { key, email: EMAIL })).toBeUndefined();
    expect(withKey(KEYED_SOURCES[1], (k) => k, {}, data)).toEqual({ ran: { USAJOBS_API_KEY: key, USAJOBS_EMAIL: EMAIL } });
    const other = ['other', 'example.org'].join('@');
    expect(withKey(KEYED_SOURCES[1], (k) => k.USAJOBS_EMAIL, { USAJOBS_EMAIL: other }, data)).toEqual({ ran: other });
  });
  it('refuses a key or an email that does not read as one, in a sentence that does not repeat it, and writes nothing', () => {
    const bad = [madeUp('g1').slice(0, 7), `${madeUp('g2')} ${madeUp('g3')}`, `${madeUp('g4')}\u0007`, madeUp('g5').repeat(6), `${madeUp('g6')}é`];
    for (const key of bad) {
      const why = saveKey(data, 'Jooble', { key });
      expect(why).toBe(REFUSED.key);
      for (const part of partsOf(key)) expect(why).not.toContain(part);
    }
    expect(saveKey(data, 'USAJOBS', { key: madeUp('g7'), email: 'not an address' })).toBe(REFUSED.email);
    expect(saveKey(data, 'USAJOBS', { key: madeUp('g7') })).toBe(REFUSED.email);
    expect(saveKey(data, 'Adzuna', { key: madeUp('g8') })).toBe(REFUSED.source);
    expect(existsSync(keysFile(data))).toBe(false);
  });
  it('is written whole, readable by its owner alone on Linux, and leaves no temporary file', () => {
    expect(saveKey(data, 'Jooble', { key: madeUp('h1') })).toBeUndefined();
    expect(saveKey(data, 'USAJOBS', { key: madeUp('h2'), email: EMAIL })).toBeUndefined();
    expect(JSON.parse(readFileSync(keysFile(data), 'utf8'))).toEqual({ JOOBLE_API_KEY: madeUp('h1'), USAJOBS_API_KEY: madeUp('h2'), USAJOBS_EMAIL: EMAIL });
    expect(readdirSync(data)).toEqual(['keys.json']);
    if (process.platform !== 'win32') expect(statSync(keysFile(data)).mode & 0o777).toBe(0o600);
  });
  it('Remove deletes it; the file goes when nothing is left in it', () => {
    saveKey(data, 'Jooble', { key: madeUp('i1') });
    saveKey(data, 'USAJOBS', { key: madeUp('i2'), email: EMAIL });
    removeKey(data, 'USAJOBS');
    expect(readFileSync(keysFile(data), 'utf8')).not.toContain(madeUp('i2'));
    expect(readFileSync(keysFile(data), 'utf8')).not.toContain(EMAIL);
    expect(withKey(KEYED_SOURCES[1], () => 1, {}, data)).toEqual({ skipped: skipLine(KEYED_SOURCES[1]) });
    if (process.platform !== 'win32') expect(statSync(keysFile(data)).mode & 0o777).toBe(0o600);
    removeKey(data, 'Jooble');
    expect(existsSync(keysFile(data))).toBe(false);
    removeKey(data, 'Jooble');
    expect(existsSync(keysFile(data))).toBe(false);
  });
});

describe("the local page saves a key and never shows one (TODO 4.4's check, GR-023)", () => {
  /** A transport that counts its calls: saving a key fetches nothing. */
  let calls = 0;
  const counting: Transport = async () => {
    calls += 1;
    return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
  };
  const own = (): string => new URL(page!.url).origin;
  const post = async (path: string, fields: Record<string, string>, headers: Record<string, string> = {}): Promise<{ status: number; text: string }> => {
    const res = await fetch(new URL(path, page!.url), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: own(), ...headers },
      body: new URLSearchParams(fields).toString(),
    });
    return { status: res.status, text: await res.text() };
  };
  const get = async (path = '/'): Promise<string> => (await fetch(new URL(path, page!.url))).text();
  async function serve(env: Record<string, string> = {}): Promise<void> {
    calls = 0;
    page = await servePage(data, async () => null, counting, env);
  }
  const said = (source: string, what: string): string => `<strong>${source}</strong> <span class="state">${what}</span>`;

  it('saves a key and an email, says "Key saved", and no route, file of the reviews, or output carries the key', async () => {
    const out: string[] = [];
    const spy = (stream: NodeJS.WriteStream) => vi.spyOn(stream, 'write').mockImplementation((chunk: string | Uint8Array) => (out.push(String(chunk)), true));
    spy(process.stdout);
    spy(process.stderr);
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void out.push(args.map(String).join(' ')));
    const jooble = madeUp('k1');
    const usajobs = madeUp('k2');
    await serve();
    expect(await get()).toContain(said('Jooble', KEY_SAID.none));
    const bodies: string[] = [];
    const saved = await post('/keys/save', { source: 'Jooble', key: jooble });
    expect(saved.status).toBe(200);
    bodies.push(saved.text);
    bodies.push((await post('/keys/save', { source: 'USAJOBS', key: usajobs, email: EMAIL })).text);
    const html = await get();
    bodies.push(html, await get('/favicon.svg'), await get('/reviews/x/y.pdf'), await get('/no-such-page'));
    bodies.push((await post('/keys/save', { source: 'Jooble', key: `${jooble} x` })).text);
    bodies.push((await post('/discover/run', {})).text, (await post('/keys/save', { source: 'Jooble', key: jooble }, { origin: 'http://evil.example' })).text);
    bodies.push(await (await fetch(new URL('/keys/save', page!.url), { method: 'PUT' })).text());
    expect(html).toContain(said('Jooble', KEY_SAID.page));
    expect(html).toContain(said('USAJOBS', KEY_SAID.page));
    expect(html).toContain(`type="email" maxlength="254" autocomplete="off" value="${EMAIL}"`);
    expect(html).toContain('<form method="post" action="/keys/remove"><input type="hidden" name="source" value="Jooble"><button>Remove</button></form>');
    await page!.close();
    page = undefined;
    const everything = [...bodies, ...out].join('\n');
    for (const key of [jooble, usajobs]) for (const part of partsOf(key)) expect(everything).not.toContain(part);
    expect(findSecrets(everything)).toEqual([]);
    expect(keyShaped(everything)).toEqual([]);
    // The key is in keys.json alone: nothing else the data folder holds carries it.
    for (const name of readdirSync(data, { recursive: true, encoding: 'utf8' }).filter((n) => n !== 'keys.json')) {
      const path = join(data, name);
      if (statSync(path).isFile()) expect(readFileSync(path, 'utf8')).not.toContain(jooble.slice(0, 10));
    }
    // The search used the saved keys: the one transport call to each keyed host was made by the run, never by a save.
    expect(calls).toBeGreaterThan(0);
  });
  it('fetches nothing to save or remove a key', async () => {
    await serve();
    await post('/keys/save', { source: 'Jooble', key: madeUp('l1') });
    await post('/keys/remove', { source: 'Jooble' });
    expect(calls).toBe(0);
    expect(existsSync(keysFile(data))).toBe(false);
    expect(await get()).toContain(said('Jooble', KEY_SAID.none));
  });
  it('holds no key of any shape the scanner knows, each saved as Jooble\'s key in turn', async () => {
    await serve();
    for (const [shape, key] of Object.entries(MADE_UP_KEYS)) {
      const answer = (await post('/keys/save', { source: 'Jooble', key })).text;
      const html = await get();
      for (const text of [answer, html]) {
        expect(text.includes(key), shape).toBe(false);
        expect(findSecrets(text), shape).toEqual([]);
      }
    }
  });
  it('refuses a bad key under its source, without repeating it', async () => {
    await serve();
    const key = `${madeUp('m1')} ${madeUp('m2')}`;
    const { status, text } = await post('/keys/save', { source: 'Jooble', key });
    expect(status).toBe(200);
    expect(text).toContain(`<p class="refused">${REFUSED.key}</p>`);
    expect(text).toContain('<details open>');
    for (const part of partsOf(key)) expect(text).not.toContain(part);
    expect(existsSync(keysFile(data))).toBe(false);
  });
  it('refuses a key from another origin, with no origin, not as a form, or too long; writes nothing', async () => {
    await serve();
    const key = madeUp('n1');
    expect((await post('/keys/save', { source: 'Jooble', key }, { origin: 'http://evil.example' })).status).toBe(403);
    const bare = await fetch(new URL('/keys/save', page!.url), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `source=Jooble&key=${key}` });
    expect(bare.status).toBe(403);
    expect((await post('/keys/save', { source: 'Jooble', key }, { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await post('/keys/save', { source: 'Jooble', key, pad: 'x'.repeat(70 * 1024) })).status).toBe(413);
    expect(existsSync(keysFile(data))).toBe(false);
    saveKey(data, 'Jooble', { key });
    expect((await post('/keys/remove', { source: 'Jooble' }, { origin: 'http://evil.example' })).status).toBe(403);
    expect(existsSync(keysFile(data))).toBe(true);
  });
  it('says a key set by the computer\'s settings wins, with no box to save one, and never shows it', async () => {
    const set = madeUp('o1');
    saveKey(data, 'Jooble', { key: madeUp('o2') });
    await serve({ JOOBLE_API_KEY: set });
    const html = await get();
    expect(html).toContain(said('Jooble', KEY_SAID.computer));
    expect(html).not.toContain('<input type="hidden" name="source" value="Jooble">');
    expect(html).toContain(said('USAJOBS', KEY_SAID.none));
    for (const part of [...partsOf(set), ...partsOf(madeUp('o2'))]) expect(html).not.toContain(part);
  });
  it('reads the process environment when the page is given none', async () => {
    stubAll((name) => (name === 'USAJOBS_EMAIL' ? EMAIL : madeUp(name.length.toString(16))));
    page = await servePage(data, async () => null);
    const html = await get();
    expect(html).toContain(said('Jooble', KEY_SAID.computer));
    expect(html).toContain(said('USAJOBS', KEY_SAID.computer));
    for (const name of VARIABLES) expect(html).not.toContain(process.env[name]);
    expect(keyShaped(html)).toEqual([]);
  });
  it('guides each source to its key: a closed <details>, plain steps, the provider\'s own links in a new tab', async () => {
    await serve();
    const html = await get();
    expect(html.match(/<details class="guide"><summary>How do I get a key\?<\/summary>/g)).toHaveLength(2);
    for (const href of ['https://jooble.org/api/about', 'https://developer.usajobs.gov/apirequest/', 'https://developer.usajobs.gov/guides/terms-of-service']) {
      expect(html).toContain(`<a href="${href}" target="_blank" rel="noopener noreferrer">`);
    }
    const guides = html.match(/<details class="guide">[\s\S]*?<\/details>/g) ?? [];
    for (const guide of guides) for (const link of guide.match(/<a [^>]*>/g) ?? []) expect(link).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('needs a key from Ghost');
  });
  it('says an unreadable keys.json in one line and leaves it as it is', async () => {
    mkdirSync(data, { recursive: true });
    writeFileSync(keysFile(data), '{not JSON');
    await serve();
    expect(await get()).toContain('<p class="error">keys.json in the data folder cannot be read, so it is left as it is and nothing is written to it.</p>');
    expect((await post('/keys/save', { source: 'Jooble', key: madeUp('p1') })).status).toBe(200);
    expect(readFileSync(keysFile(data), 'utf8')).toBe('{not JSON');
  });
  it('would find a key had one reached the page (the check can fail)', async () => {
    await serve();
    const html = await get();
    expect(findSecrets(html.replace('</body>', `${MADE_UP_KEYS['GitHub token']}</body>`)).length).toBeGreaterThan(0);
    expect(keyShaped(html.replace('</body>', `${madeUp('e5')}</body>`)).length).toBeGreaterThan(0);
    expect(partsOf(madeUp('e5')).some((part) => `x${madeUp('e5').slice(-6)}`.includes(part))).toBe(true);
  });
});
