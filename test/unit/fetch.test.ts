/**
 * The lead finder's one fetch function (TODO 4.5, P-16): a redirect is not followed, HTML comes back as text, JSON parsed; each
 * capped source's bucket, persisted in the data folder, refuses the call past its cap (Jooble's 101st of a UTC day, across a
 * restart); a host off its source's row refused before any call; a timeout and an oversized body refused; nothing printed and no
 * line naming the address. No network: the calls go to a server of the test's own on 127.0.0.1 (the address rewritten by the
 * transport, the request as the function made it), or to a transport that answers in memory. Every key is made up and joined at
 * run time from pieces.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { bucketsFile, fetchSource, htmlToText, type Transport } from '../../src/project/fetch.js';

const KEY = ['9c1e', 'ab7f', '4e02', 'b8d3', '61aa'].join('') + 'f00d';
const JOOBLE = `https://jooble.org/api/${KEY}`;

const HTML = `<!doctype html><html><head><title>Not this</title><style>p { color: red }</style>
<script>alert("no")</script></head><body><!-- a comment -->
<h1>QA Engineer</h1><p>Test <b>automation</b> &amp; tooling &lt;3&gt; &#8211; remote&nbsp;first</p>
<ul><li>Playwright</li><li>CI</li></ul><noscript>no</noscript><img src="x.png" alt="logo"></body></html>`;

let hits: Record<string, number> = {};
let server: Server;
let local = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    hits[path] = (hits[path] ?? 0) + 1;
    if (path === '/moved') return void res.writeHead(302, { Location: '/target' }).end();
    if (path === '/target') return void res.writeHead(200, { 'Content-Type': 'text/plain' }).end('followed');
    if (path === '/page') return void res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(HTML);
    if (path === '/jobs') return void res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"jobs":[{"title":"SDET"}]}');
    if (path === '/missing') return void res.writeHead(404, { 'Content-Type': 'text/plain' }).end('no');
    if (path === '/big') return void res.writeHead(200, { 'Content-Type': 'text/plain' }).end('x'.repeat(5000));
    if (path === '/chunked') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      for (let i = 0; i < 5; i++) res.write('y'.repeat(1000));
      return void res.end();
    }
    if (path === '/binary') return void res.writeHead(200, { 'Content-Type': 'image/png' }).end('png');
    if (path === '/slow') return; // never answers
    if (path.startsWith('/api/')) return void res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ method: req.method }));
    res.writeHead(404).end();
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  local = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((done) => server.close(() => done()));
});

/** The platform's fetch, sent to the test's server: the path and the request as the function made them, the host made local. */
const toLocal: Transport = (url, init) => {
  const { pathname, search } = new URL(url);
  return fetch(`${local}${pathname}${search}`, init);
};
/** A transport answering in memory, counting its calls. */
const inMemory = (): Transport & { calls: number } => {
  const t = Object.assign(async () => {
    t.calls++;
    return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });
  }, { calls: 0 });
  return t;
};

let data: string;
beforeEach(() => {
  hits = {};
  data = mkdtempSync(join(tmpdir(), 'ghostreach-fetch-'));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(data, { recursive: true, force: true });
});

describe('the one fetch function (TODO 4.5)', () => {
  it('does not follow a redirect: the 3xx is refused and its target never asked', async () => {
    const got = await fetchSource('Greenhouse', 'https://boards-api.greenhouse.io/moved', {}, { data, transport: toLocal });
    expect(got).toEqual({ ok: false, why: 'Greenhouse: answered with a redirect (302); not followed.' });
    expect(hits).toEqual({ '/moved': 1 });
  });
  it('gives HTML back as text: no tag, no script or style, the references read', async () => {
    const got = await fetchSource('Arbeitnow', 'https://www.arbeitnow.com/page', {}, { data, transport: toLocal });
    expect(got).toEqual({ ok: true, kind: 'text', text: 'QA Engineer\nTest automation & tooling <3> – remote first\nPlaywright\nCI' });
  });
  it('gives JSON back parsed, and sends the request as given (Jooble\'s POST)', async () => {
    expect(await fetchSource('Lever', 'https://api.lever.co/jobs', {}, { data, transport: toLocal })).toEqual({ ok: true, kind: 'json', json: { jobs: [{ title: 'SDET' }] } });
    expect(await fetchSource('Jooble', JOOBLE, { method: 'POST', body: '{"keywords":"QA"}', headers: { 'Content-Type': 'application/json' } }, { data, transport: toLocal }))
      .toEqual({ ok: true, kind: 'json', json: { method: 'POST' } });
  });
  it('refuses an error status, a body that is not text, and JSON that does not parse', async () => {
    expect(await fetchSource('Ashby', 'https://api.ashbyhq.com/missing', {}, { data, transport: toLocal })).toEqual({ ok: false, why: 'Ashby: answered 404.' });
    expect(await fetchSource('Ashby', 'https://api.ashbyhq.com/binary', {}, { data, transport: toLocal })).toEqual({ ok: false, why: 'Ashby: the answer is not text (image/png).' });
    const broken: Transport = async () => new Response('{nope', { headers: { 'Content-Type': 'application/json' } });
    expect(await fetchSource('Ashby', 'https://api.ashbyhq.com/x', {}, { data, transport: broken })).toEqual({ ok: false, why: 'Ashby: the answer is not JSON.' });
  });
  it('times out', async () => {
    const got = await fetchSource('Ashby', 'https://api.ashbyhq.com/slow', {}, { data, transport: toLocal, timeoutMs: 200 });
    expect(got).toEqual({ ok: false, why: 'Ashby: timed out.' });
  });
  it('caps the body, declared or streamed', async () => {
    const why = 'USAJOBS: the answer is larger than 1000 bytes; not read.';
    expect(await fetchSource('USAJOBS', 'https://data.usajobs.gov/big', {}, { data, transport: toLocal, maxBytes: 1000 })).toEqual({ ok: false, why });
    expect(await fetchSource('USAJOBS', 'https://data.usajobs.gov/chunked', {}, { data, transport: toLocal, maxBytes: 1000 })).toEqual({ ok: false, why });
    expect(await fetchSource('USAJOBS', 'https://data.usajobs.gov/chunked', {}, { data, transport: toLocal, maxBytes: 5000 })).toEqual({ ok: true, kind: 'text', text: 'y'.repeat(5000) });
  });
});

describe('the hosts: only the source\'s own, from its in row (GR-005)', () => {
  const refusedHosts: [string, string][] = [
    ['Greenhouse', 'https://api.lever.co/v0/postings/acme'],
    ['Recruitee', 'https://a.b.recruitee.com/api/offers/'],
    ['Recruitee', 'https://recruitee.com/api/offers/'],
    ['Personio', 'https://acme.jobs.personio.de.evil.example/xml'],
    ['Jooble', 'http://jooble.org/api/x'],
    ['Jooble', 'https://jooble.org:8443/api/x'],
    ['Jooble', 'https://user:pass@jooble.org/api/x'],
    ['Remotive', 'https://127.0.0.1/api/remote-jobs'],
    ['Remotive', 'not an address'],
  ];
  it.each(refusedHosts)('%s refuses %s without a call', async (source, url) => {
    const transport = inMemory();
    const got = await fetchSource(source, url, {}, { data, transport });
    expect(got.ok).toBe(false);
    expect(transport.calls).toBe(0);
  });
  it('refuses a source that is not an in row (Adzuna, The Muse, LinkedIn) without a call', async () => {
    const transport = inMemory();
    for (const [source, url] of [['Adzuna', 'https://api.adzuna.com/v1/api/jobs/us/search/1'], ['The Muse', 'https://www.themuse.com/api/public/jobs'], ['LinkedIn', 'https://www.linkedin.com/jobs']]) {
      expect(await fetchSource(source, url, {}, { data, transport })).toEqual({ ok: false, why: `${source}: not a source the lead finder may read.` });
    }
    expect(transport.calls).toBe(0);
  });
  it('takes a {company} host as one label, any case', async () => {
    const transport = inMemory();
    expect((await fetchSource('Personio', 'https://ACME.jobs.personio.de/xml', {}, { data, transport })).ok).toBe(true);
    expect((await fetchSource('Recruitee', 'https://acme-labs.recruitee.com/api/offers/', {}, { data, transport })).ok).toBe(true);
    expect(transport.calls).toBe(2);
  });
});

describe('the per-source bucket, persisted in the data folder (TODO 4.5\'s check)', () => {
  const day = new Date('2026-11-14T09:00:00Z');
  it("refuses Jooble's 101st call of a UTC day, across a restart, and lets the next day's first through", async () => {
    const transport = inMemory();
    for (let i = 0; i < 60; i++) expect((await fetchSource('Jooble', JOOBLE, { method: 'POST' }, { data, transport, now: () => day })).ok).toBe(true);
    // A restart: the module loaded afresh, nothing of the first held in memory; the count is the data folder's.
    vi.resetModules();
    const restarted = (await import('../../src/project/fetch.js')).fetchSource;
    const later = new Date('2026-11-14T23:59:00Z');
    for (let i = 0; i < 40; i++) expect((await restarted('Jooble', JOOBLE, { method: 'POST' }, { data, transport, now: () => later })).ok).toBe(true);
    expect(transport.calls).toBe(100);
    expect(await restarted('Jooble', JOOBLE, { method: 'POST' }, { data, transport, now: () => later })).toEqual({ ok: false, why: 'Jooble: over its cap of 100 a day (UTC); skipped.' });
    expect(transport.calls).toBe(100);
    expect(JSON.parse(readFileSync(bucketsFile(data), 'utf8')).Jooble.day.used).toBe(100);
    expect((await restarted('Jooble', JOOBLE, { method: 'POST' }, { data, transport, now: () => new Date('2026-11-15T00:00:01Z') })).ok).toBe(true);
  });
  it("holds Remotive to 2 a minute and 4 a day, each source's bucket its own", async () => {
    const transport = inMemory();
    const at = (iso: string) => ({ data, transport, now: () => new Date(iso) });
    const remotive = (iso: string) => fetchSource('Remotive', 'https://remotive.com/api/remote-jobs', {}, at(iso));
    expect((await remotive('2026-11-14T10:00:01Z')).ok).toBe(true);
    expect((await remotive('2026-11-14T10:00:30Z')).ok).toBe(true);
    expect(await remotive('2026-11-14T10:00:59Z')).toEqual({ ok: false, why: 'Remotive: over its cap of 2 a minute; skipped.' });
    expect((await fetchSource('Jooble', JOOBLE, {}, at('2026-11-14T10:00:59Z'))).ok).toBe(true);
    expect((await remotive('2026-11-14T10:01:00Z')).ok).toBe(true);
    expect((await remotive('2026-11-14T10:01:01Z')).ok).toBe(true);
    expect(await remotive('2026-11-14T11:00:00Z')).toEqual({ ok: false, why: 'Remotive: over its cap of 4 a day (UTC); skipped.' });
    expect(transport.calls).toBe(5);
  });
  it('keeps no file for a source with no stated cap', async () => {
    await fetchSource('Greenhouse', 'https://boards-api.greenhouse.io/v1/boards/acme/jobs', {}, { data, transport: inMemory() });
    expect(existsSync(bucketsFile(data))).toBe(false);
  });
  it('refuses a capped call when the file cannot be read, and leaves the file as it was', async () => {
    writeFileSync(bucketsFile(data), '{broken');
    const transport = inMemory();
    expect(await fetchSource('Jooble', JOOBLE, {}, { data, transport })).toEqual({ ok: false, why: 'Jooble: its call count (buckets.json in the data folder) cannot be read; not fetched.' });
    expect(transport.calls).toBe(0);
    expect(readFileSync(bucketsFile(data), 'utf8')).toBe('{broken');
  });
});

describe('never logs an address (a key may ride in it)', () => {
  it('prints nothing, and no line it returns holds the address or the key', async () => {
    const written: string[] = [];
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, method).mockImplementation((...args) => void written.push(args.join(' ')));
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => (written.push(String(chunk)), true));
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => (written.push(String(chunk)), true));
    const thrower: Transport = async (url) => {
      throw new TypeError(`fetch failed: ${url}`);
    };
    const results = [
      await fetchSource('Jooble', `https://jooble.org/moved?k=${KEY}`, {}, { data, transport: toLocal }),
      await fetchSource('Jooble', `https://jooble.org/missing?k=${KEY}`, {}, { data, transport: toLocal }),
      await fetchSource('Jooble', `https://jooble.org/slow?k=${KEY}`, {}, { data, transport: toLocal, timeoutMs: 100 }),
      await fetchSource('Jooble', JOOBLE, {}, { data, transport: thrower }),
      await fetchSource('Jooble', `https://jooble.org.evil.example/api/${KEY}`, {}, { data, transport: thrower }),
    ];
    vi.restoreAllMocks();
    expect(written).toEqual([]);
    expect(results.map((r) => (r.ok ? 'ok' : r.why))).toEqual([
      'Jooble: answered with a redirect (302); not followed.',
      'Jooble: answered 404.',
      'Jooble: timed out.',
      'Jooble: could not be reached.',
      'Jooble: the address is not one of its hosts; not fetched.',
    ]);
    expect(JSON.stringify(results)).not.toContain(KEY);
  });
});

describe('htmlToText', () => {
  it('keeps a lone < as text, drops an unclosed tag and an unclosed script to the end', () => {
    expect(htmlToText('a < b <i>c</i>')).toBe('a < b c');
    expect(htmlToText('kept <a href="x')).toBe('kept');
    expect(htmlToText('kept<script>var x = "<p>";')).toBe('kept');
  });
  it('reads a page of near misses in linear time', () => {
    const started = performance.now();
    htmlToText('<script>'.repeat(50_000) + '<!--'.repeat(50_000) + '<a'.repeat(50_000));
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
