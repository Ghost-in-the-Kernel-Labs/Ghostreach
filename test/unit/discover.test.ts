/**
 * The discovery lane (TODO 4.7, RF-08): one saved search, kept in the data folder, run on request across every discovery-lane
 * `in` source of docs/SOURCES.md through the one fetch function, a keyed source only with its key; postings filtered by the company
 * lane's title rule and deduped by company, the newest kept and the rest counted; a source over its cap, without its key, or
 * failing skipped and named, never waited on. No network: every answer is a fixture of `test/support/boards/`, synthetic from the
 * provider's own documented response, handed back by an in-memory transport that records each call. Keys are made up, joined at
 * run time.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SEARCH, DISCOVERY, MAX_SEARCH_TITLES, discover, discoveryFile, keepRun, parseSearch, readDiscovery, saveSearch, stamp, type SavedSearch } from '../../src/project/discover.js';
import { bucketsFile, FETCHED_SOURCES, type Transport } from '../../src/project/fetch.js';
import { servePage, type ServedPage } from '../../src/project/serve.js';
import { parseSources, sourcesText } from '../support/sources.js';
import * as arbeitnow from '../support/boards/arbeitnow.js';
import * as jooble from '../support/boards/jooble.js';
import * as remotive from '../support/boards/remotive.js';
import * as usajobs from '../support/boards/usajobs.js';

const JOOBLE_KEY = ['made', 'up', 'jooble', 'key'].join('-');
const USAJOBS_KEY = ['made', 'up', 'usajobs', 'key'].join('-');
const EMAIL = ['someone', 'example.com'].join('@');
const KEYS = { JOOBLE_API_KEY: JOOBLE_KEY, USAJOBS_API_KEY: USAJOBS_KEY, USAJOBS_EMAIL: EMAIL };

interface Asked {
  url: string;
  init: RequestInit;
}

let data: string;
let asked: Asked[];
let page: ServedPage | undefined;

const json = (body: string, type: string, status = 200): Response => new Response(body, { status, headers: { 'Content-Type': type } });

/** The four sources' fixtures: Jooble finds its search for "QA engineer" alone; USAJOBS the same answer for every title. */
const sources = (override: (url: string) => Response | null = () => null): Transport => async (url, init) => {
  asked.push({ url, init });
  const hit = override(url);
  if (hit) return hit;
  if (url.startsWith('https://jooble.org/')) return json(String(init.body).includes('"QA engineer') ? jooble.SEARCH : jooble.NONE, jooble.TYPE);
  if (url.startsWith('https://www.arbeitnow.com/')) return json(arbeitnow.PAGE, arbeitnow.TYPE);
  if (url.startsWith('https://remotive.com/')) return json(remotive.JOBS, remotive.TYPE);
  if (url.startsWith('https://data.usajobs.gov/')) return json(usajobs.SEARCH, usajobs.TYPE);
  return new Response('', { status: 404 });
};

const NOW = (): Date => new Date('2026-11-14T12:00:00Z');
const hostsAsked = (): string[] => asked.map((a) => new URL(a.url).hostname);

beforeEach(() => {
  data = mkdtempSync(join(tmpdir(), 'ghostreach-discover-'));
  asked = [];
});
afterEach(async () => {
  await page?.close();
  page = undefined;
  rmSync(data, { recursive: true, force: true });
});

describe('the discovery-lane sources (docs/SOURCES.md)', () => {
  it('are the in rows of the discovery lane, in order, each a source the fetch function may read', () => {
    const rows = parseSources(sourcesText()).filter((r) => r.lane === 'discovery' && r.status === 'in').map((r) => r.source);
    expect(DISCOVERY.map((s) => s.source)).toEqual(rows);
    expect(DISCOVERY.filter((s) => !FETCHED_SOURCES.some((f) => f.source === s.source)).map((s) => s.source)).toEqual([]);
  });
  it('has a fixture per source, each naming the provider page it is synthetic from', () => {
    const fixtures = { Jooble: jooble, Arbeitnow: arbeitnow, Remotive: remotive, USAJOBS: usajobs };
    expect(Object.keys(fixtures)).toEqual(DISCOVERY.map((s) => s.source));
    for (const [name, fixture] of Object.entries(fixtures)) {
      const file = readFileSync(new URL(`../support/boards/${name.toLowerCase()}.ts`, import.meta.url), 'utf8');
      expect(file).toContain(`synthetic, from ${fixture.DOC}`);
    }
  });
});

describe('a run (TODO 4.7)', () => {
  it('asks every source once a page, one row per company: the newest QA posting, the rest counted', async () => {
    const run = await discover(DEFAULT_SEARCH, { data, transport: sources(), now: NOW, env: KEYS });
    expect(run.skipped).toEqual([]);
    expect(run.rows).toEqual([
      // Jooble's "Acme Robotics, Inc." and Arbeitnow's "ACME Robotics" are one company: the newer stands.
      { company: 'ACME Robotics', title: 'QA Engineer (m/w/d)', url: 'https://arbeitnow.com/view/qa-engineer-mwd-acme-robotics-1001', source: 'Arbeitnow', at: '2026-11-13T10:00:00.000Z', others: 1 },
      { company: 'Globex Corporation', title: 'QA Lead', url: 'https://remotive.com/remote-jobs/qa/made-up-9001', source: 'Remotive', at: '2026-11-13T08:00:00.000Z', others: 1 },
      // USAJOBS answered every title with the same posting: one posting, counted once.
      { company: 'Made Up Systems Agency', title: 'IT Specialist (Test Automation)', url: 'https://www.usajobs.gov/job/800001', source: 'USAJOBS', at: '2026-11-11T00:00:00.000Z', others: 0 },
      // http, and another host: the address is not kept; the title is text.
      { company: 'Hooli', title: 'SDET <script>alert(1)</script>', source: 'Jooble', at: '2026-11-09T09:00:00.000Z', others: 1 },
      { company: 'Umbrella', title: 'QA Analyst', source: 'Jooble', at: '2026-11-08T09:00:00.000Z', others: 0 },
    ]);
    // Jooble and USAJOBS once a title, Arbeitnow and Remotive once: ten calls, each a first page.
    expect(hostsAsked().sort()).toEqual([...Array(4).fill('data.usajobs.gov'), ...Array(4).fill('jooble.org'), 'remotive.com', 'www.arbeitnow.com'].sort());
    expect(asked.find((a) => a.url.startsWith('https://remotive.com/'))?.url).toBe('https://remotive.com/api/remote-jobs?category=qa&limit=100');
    const usa = asked.filter((a) => a.url.startsWith('https://data.usajobs.gov/')).map((a) => new URL(a.url).searchParams);
    expect(usa.map((p) => p.get('PositionTitle'))).toEqual(DEFAULT_SEARCH.titles);
    expect(usa.every((p) => p.get('RemoteIndicator') === 'True' && p.get('ResultsPerPage') === '100')).toBe(true);
    const joobleBodies = asked.filter((a) => a.url.startsWith('https://jooble.org/')).map((a) => JSON.parse(String(a.init.body)));
    expect(joobleBodies[0]).toEqual({ keywords: 'QA engineer remote', location: '', page: 1 });
  });

  it('hands each keyed source its key, and no row, skip line or kept file holds one', async () => {
    const run = await discover(DEFAULT_SEARCH, { data, transport: sources(), now: NOW, env: KEYS });
    expect(asked.find((a) => a.url.startsWith('https://jooble.org/'))?.url).toBe(`https://jooble.org/api/${JOOBLE_KEY}`);
    expect(asked.find((a) => a.url.startsWith('https://data.usajobs.gov/'))?.init.headers).toEqual({ 'User-Agent': EMAIL, 'Authorization-Key': USAJOBS_KEY });
    keepRun(data, run);
    const kept = readFileSync(discoveryFile(data), 'utf8');
    for (const secret of [JOOBLE_KEY, USAJOBS_KEY, EMAIL]) expect(kept).not.toContain(secret);
  });

  it('runs the keyless sources alone without keys, each keyed one skipped and named, never called', async () => {
    const run = await discover(DEFAULT_SEARCH, { data, transport: sources(), now: NOW, env: {} });
    expect(run.skipped).toEqual(['Jooble skipped: no key (set JOOBLE_API_KEY).', 'USAJOBS skipped: no key (set USAJOBS_API_KEY and USAJOBS_EMAIL).']);
    expect(hostsAsked().sort()).toEqual(['remotive.com', 'www.arbeitnow.com']);
    expect(run.rows.map((r) => `${r.company} ${r.source} ${r.others}`)).toEqual(['ACME Robotics Arbeitnow 0', 'Globex Corporation Remotive 0', 'Hooli Remotive 0']);
  });

  it('skips and names a source over its cap at once, never waited on, the others run', async () => {
    // Remotive: two calls a minute. The third run in the same minute does not call it.
    await discover(DEFAULT_SEARCH, { data, transport: sources(), now: NOW, env: {} });
    await discover(DEFAULT_SEARCH, { data, transport: sources(), now: NOW, env: {} });
    asked = [];
    const started = Date.now();
    const third = await discover(DEFAULT_SEARCH, { data, transport: sources(), now: NOW, env: {} });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(third.skipped).toEqual(['Jooble skipped: no key (set JOOBLE_API_KEY).', 'Remotive: over its cap of 2 a minute; skipped.', 'USAJOBS skipped: no key (set USAJOBS_API_KEY and USAJOBS_EMAIL).']);
    expect(hostsAsked()).toEqual(['www.arbeitnow.com']);
    expect(third.rows.map((r) => r.company)).toEqual(['ACME Robotics']);
  });

  it("skips Jooble past its 100 calls of the UTC day, before any call", async () => {
    const day = Date.UTC(2026, 10, 14);
    writeFileSync(bucketsFile(data), JSON.stringify({ Jooble: { day: { start: day, used: 100 } } }));
    const run = await discover(DEFAULT_SEARCH, { data, transport: sources(), now: NOW, env: KEYS });
    expect(run.skipped).toEqual(['Jooble: over its cap of 100 a day (UTC); skipped.']);
    expect(hostsAsked()).not.toContain('jooble.org');
    expect(run.rows.map((r) => r.company)).toContain('Made Up Systems Agency');
  });

  it('names a source that fails or answers out of its documented shape, and keeps the rest', async () => {
    const run = await discover(DEFAULT_SEARCH, {
      data,
      now: NOW,
      env: {},
      transport: sources((url) => {
        if (url.startsWith('https://www.arbeitnow.com/')) return new Response('busy', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        if (url.startsWith('https://remotive.com/')) return json('{"jobs":"none"}', remotive.TYPE);
        return null;
      }),
    });
    expect(run.skipped).toEqual(['Jooble skipped: no key (set JOOBLE_API_KEY).', 'Arbeitnow: answered 503.', 'Remotive: answered in a shape its documentation does not give.', 'USAJOBS skipped: no key (set USAJOBS_API_KEY and USAJOBS_EMAIL).']);
    expect(run.rows).toEqual([]);
  });

  it('searches a place: Jooble and USAJOBS by it, Arbeitnow by the postings that name it', async () => {
    const berlin: SavedSearch = { titles: ['QA engineer'], location: 'Berlin' };
    const run = await discover(berlin, { data, transport: sources(), now: NOW, env: KEYS });
    expect(JSON.parse(String(asked.find((a) => a.url.startsWith('https://jooble.org/'))?.init.body))).toEqual({ keywords: 'QA engineer', location: 'Berlin', page: 1 });
    const usa = new URL(asked.find((a) => a.url.startsWith('https://data.usajobs.gov/'))!.url).searchParams;
    expect([usa.get('LocationName'), usa.get('RemoteIndicator')]).toEqual(['Berlin', null]);
    expect(run.rows.filter((r) => r.source === 'Arbeitnow').map((r) => r.company)).toEqual(['ACME Robotics', 'Berlin Testing GmbH']);
  });
});

describe('the saved search', () => {
  it('reads the roadmap titles, remote, until one is saved; saves one; keeps the last run beside it', () => {
    expect(readDiscovery(data)).toEqual({ search: { titles: ['QA engineer', 'test automation', 'SDET', 'QA analyst'], location: 'remote' } });
    saveSearch(data, { titles: ['SDET'], location: 'Austin' });
    const run = { at: '2026-11-14T12:00:00.000Z', search: { titles: ['SDET'], location: 'Austin' }, rows: [], skipped: [] };
    keepRun(data, run);
    saveSearch(data, { titles: ['QA lead'], location: 'remote' });
    expect(readDiscovery(data)).toEqual({ search: { titles: ['QA lead'], location: 'remote' }, run });
  });
  it('parses the form: one title a line, none twice, at most five, and a location', () => {
    expect(parseSearch(' QA engineer \r\n\nqa engineer\nSDET', ' remote ')).toEqual({ search: { titles: ['QA engineer', 'SDET'], location: 'remote' } });
    expect(parseSearch('\n \n', 'remote')).toEqual({ refused: 'Type at least one title.' });
    expect(parseSearch(Array.from({ length: MAX_SEARCH_TITLES + 1 }, (_, i) => `QA ${i}`).join('\n'), 'remote')).toEqual({ refused: 'At most 5 titles.' });
    expect(parseSearch('SDET', '  ')).toEqual({ refused: 'Type a location, or remote.' });
  });
  it('reads each documented day: Unix seconds, ISO with or without a zone; anything else none', () => {
    expect(stamp(1794564000)).toBe('2026-11-13T10:00:00.000Z');
    expect(stamp('2026-11-13T08:00:00')).toBe('2026-11-13T08:00:00.000Z');
    expect(stamp('2026-11-13T08:00:00+01:00')).toBe('2026-11-13T07:00:00.000Z');
    for (const bad of ['soon', null, undefined, {}, 1e20]) expect(stamp(bad)).toBe('');
  });
});

describe('the discovery lane on the local page (TODO 4.7)', () => {
  /** A raw form post (fetch may not set `Origin`), as the page's own browser sends it unless said otherwise. */
  const post = (path: string, fields: Record<string, string>, origin?: string): Promise<{ status: number; text: string }> => {
    const { port } = new URL(page!.url);
    return new Promise((done, fail) => {
      const headers = { host: `127.0.0.1:${port}`, 'content-type': 'application/x-www-form-urlencoded', ...(origin === undefined ? {} : { origin }) };
      const req = request({ host: '127.0.0.1', port, path, method: 'POST', headers }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => (body += c));
        res.on('end', () => done({ status: res.statusCode ?? 0, text: body }));
      });
      req.on('error', fail);
      req.end(new URLSearchParams(fields).toString());
    });
  };
  const own = (): string => new URL(page!.url).origin;

  it('shows the saved search in a form, no script; saves an edit; refuses a bad one and says why', async () => {
    page = await servePage(data, async () => null, sources(), {});
    const blank = await (await fetch(page.url)).text();
    expect(blank).not.toMatch(/<script/i);
    // One form, one "Search" button (launch fixes 5); the route that saves alone still takes a post.
    expect(blank).not.toContain('<form method="post" action="/discover/search">');
    expect(blank).toContain('<form method="post" action="/discover/run">');
    expect(blank).toContain('>QA engineer\ntest automation\nSDET\nQA analyst</textarea>');
    expect(blank).toContain('The search has not run yet.');
    const saved = await post('/discover/search', { titles: 'SDET\n<b>QA</b>', location: 'remote' }, own());
    expect(saved.status).toBe(200);
    expect(saved.text).toContain('>SDET\n&lt;b&gt;QA&lt;/b&gt;</textarea>');
    expect(readDiscovery(data).search).toEqual({ titles: ['SDET', '<b>QA</b>'], location: 'remote' });
    expect((await post('/discover/search', { titles: '', location: 'remote' }, own())).text).toContain('<p class="refused">Type at least one title.</p>');
    expect(asked).toEqual([]);
  });

  it('runs the search: one row per company, titles as text, a kept address a link, each skipped source named', async () => {
    page = await servePage(data, async () => null, sources(), {});
    const res = await post('/discover/run', {}, own());
    expect(res.status).toBe(200);
    const html = res.text;
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('3 companies.');
    expect(html).toContain('<li><strong>ACME Robotics</strong>: <a href="https://arbeitnow.com/view/qa-engineer-mwd-acme-robotics-1001" rel="noreferrer">QA Engineer (m/w/d)</a> <span class="day">Arbeitnow, 2026-11-13</span>');
    expect(html).toContain('<p class="error">Skipped: Jooble skipped: no key (set JOOBLE_API_KEY).</p>');
    expect(html).toContain('<p class="error">Skipped: USAJOBS skipped: no key (set USAJOBS_API_KEY and USAJOBS_EMAIL).</p>');
    // Kept, and shown again from the data folder.
    expect(await (await fetch(page.url)).text()).toContain('<strong>Globex Corporation</strong>');
  });

  it('writes a posting title as text, never as markup (P-16)', async () => {
    page = await servePage(data, async () => null, sources(), KEYS);
    const html = (await post('/discover/run', {}, own())).text;
    expect(html).toContain('<strong>Hooli</strong>: SDET &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain(JOOBLE_KEY);
    expect(html).not.toContain(USAJOBS_KEY);
  });

  it('refuses a post from another origin or from none, asking no source and keeping nothing', async () => {
    page = await servePage(data, async () => null, sources(), KEYS);
    for (const origin of [undefined, 'null', 'http://evil.example']) {
      expect((await post('/discover/run', {}, origin)).status).toBe(403);
      expect((await post('/discover/search', { titles: 'x', location: 'y' }, origin)).status).toBe(403);
    }
    expect(asked).toEqual([]);
    expect(readDiscovery(data)).toEqual({ search: DEFAULT_SEARCH });
  });
});
