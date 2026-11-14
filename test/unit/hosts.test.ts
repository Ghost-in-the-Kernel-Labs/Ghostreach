import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FETCHED_SOURCES, fetchSource } from '../../src/project/fetch.js';
import { allowList, allowed, hostsOf, parseSources, sourcesText } from '../support/sources.js';

// No fetch leaves docs/SOURCES.md's hosts (GR-005, REV-09, TODO 4.3; 4.8 adds to it): the allow-list is read from the
// document's `in` rows, and every network use in src/ outside the crawl is either an exemption named below, with its
// reason, or (from 4.5) the lead finder's one fetch function reading an allow-listed host. The boundary, as
// docs/SOURCES.md ("What is fetched, and what is exempt") states it: src/crawl/ is exempt by design, since it reads the
// site the salesperson typed, which is the product, and what that site's own pages load or link to; never a host a search
// or a source chose. From 4.5 the one fetch function (`src/project/fetch.ts`, `FETCHED_SOURCES`) holds the list in code: it is
// held here to the document's `in` rows, host for host, and refuses every host off them before any call.

const ROOT = new URL('../../', import.meta.url);
const rows = parseSources(sourcesText());
const list = allowList(rows);

/** Every TypeScript file under src/, as `src/<path>`. */
const files = fs.readdirSync(new URL('src/', ROOT), { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts')).map((f) => `src/${f.replace(/\\/g, '/')}`);
const read = (file: string): string => fs.readFileSync(new URL(file, ROOT), 'utf8');

/** What reaches the network from TypeScript: a module that can, or a call that does. Each found as `<file> <name>`. */
const PRIMITIVES: [string, RegExp][] = [
  ['fetch', /\bfetch\(/],
  ['goto', /\.goto\(/],
  ['request', /\b(request|route)\.(get|post|put|patch|head|delete|fetch)\(/],
  ['websocket', /\bnew WebSocket\(/],
  ...['http', 'https', 'http2', 'net', 'tls', 'dgram', 'dns', 'child_process'].map((m): [string, RegExp] => [`node:${m}`, new RegExp(`from 'node:${m}'`)]),
  ...['undici', 'axios', 'got', 'node-fetch', 'ws'].map((m): [string, RegExp] => [m, new RegExp(`from '${m}'`)]),
];

/** The network uses outside src/crawl/ allowed by design, each with its reason (docs/SOURCES.md, its numbered list). */
const EXEMPT: Record<string, string> = {
  'src/project/serve.ts node:http': 'the local page listens on 127.0.0.1 (createServer); it fetches nothing',
  'src/project/serve.ts node:net': 'a type alone (AddressInfo), the bound port',
  'src/project/serve.ts node:child_process': "the platform's opener, given the page's own loopback address",
  'src/pdf/pdf.ts goto': "the review's own AUDIT.html, by a file: address",
  'src/project/crawl.ts node:child_process': "Playwright's own installer, the first-run Chromium download: a dependency's install, not a source",
};

/** The lead finder's one fetch function (TODO 4.5): the one network use outside the crawl that reads a source, to its own hosts alone. */
const FETCH_FUNCTION = 'src/project/fetch.ts fetch';

/** The lead finder's files in src/project/ (no `leads` module until Ghost rules, HANDOFF "For Ghost" I). */
const LEAD_FINDER = ['src/project/keys.ts', 'src/project/fetch.ts', 'src/project/company.ts', 'src/project/discover.ts'];

/** Each network use found in src/ outside the crawl, as `<file> <name>`. */
function uses(): string[] {
  return files.filter((f) => !f.startsWith('src/crawl/')).flatMap((file) => {
    const text = read(file);
    return PRIMITIVES.filter(([, pattern]) => pattern.test(text)).map(([name]) => `${file} ${name}`);
  });
}

describe('the allow-list of hosts, read from docs/SOURCES.md (GR-005)', () => {
  it('parses: each in row gives a lowercase host, a {company} label only leftmost', () => {
    expect(list.length).toBeGreaterThan(0);
    expect(list.filter((h) => !/^(\{company\}\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h))).toEqual([]);
    expect(list).toContain('boards-api.greenhouse.io');
  });
  it('holds no closed site, nor an excluded or unverified source', () => {
    const closed = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com'];
    expect(list.filter((h) => closed.some((c) => h === c || h.endsWith(`.${c}`)))).toEqual([]);
    expect(allowed(list, 'api.adzuna.com')).toBe(false);
    expect(allowed(list, 'www.linkedin.com')).toBe(false);
  });
  it('matches {company} as one label, never two, and nothing else', () => {
    expect(allowed(list, 'acme.recruitee.com')).toBe(true);
    expect(allowed(list, 'ACME.jobs.personio.de')).toBe(true);
    expect(allowed(list, 'a.b.recruitee.com')).toBe(false);
    expect(allowed(list, 'recruitee.com')).toBe(false);
    expect(allowed(list, 'recruitee.com.evil.example')).toBe(false);
    expect(allowed(list, 'boards-api.greenhouse.io.evil.example')).toBe(false);
    expect(allowed(list, 'evil.example')).toBe(false);
  });
});

describe('no fetch in src/ leaves the allow-list (GR-005, REV-09)', () => {
  it('finds no network use outside src/crawl/ but the exemptions docs/SOURCES.md names', () => {
    expect(uses().filter((u) => !(u in EXEMPT) && u !== FETCH_FUNCTION)).toEqual([]);
  });
  it('finds the fetch function the one use that reads a source', () => {
    expect(uses()).toContain(FETCH_FUNCTION);
  });
  it('finds each exemption still in use, so the list does not outlive its code', () => {
    const found = new Set(uses());
    expect(Object.keys(EXEMPT).filter((e) => !found.has(e))).toEqual([]);
  });
  it('names each exempt file in docs/SOURCES.md', () => {
    const text = sourcesText();
    expect([...new Set(Object.keys(EXEMPT).map((e) => e.split(' ')[0]))].filter((f) => !text.includes(`\`${f}\``))).toEqual([]);
  });
  it("finds every web address written in the lead finder's code on the allow-list (src/project/ until a leads module, 4.6)", () => {
    const leads = files.filter((f) => f.startsWith('src/leads/') || LEAD_FINDER.includes(f));
    expect(LEAD_FINDER.filter((f) => !files.includes(f))).toEqual([]);
    const hosts = leads.flatMap((f) => [...read(f).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => `${f} ${m[1]}`));
    expect(hosts.filter((h) => !allowed(list, h.split(' ')[1]))).toEqual([]);
  });
});

describe('the fetch function holds the allow-list in code (TODO 4.5)', () => {
  it("has the document's in rows, source for source and host for host, in order", () => {
    const rows = parseSources(sourcesText()).filter((r) => r.status === 'in');
    expect(FETCHED_SOURCES.map((s) => `${s.source}: ${s.hosts.join(', ')}`)).toEqual(rows.map((r) => `${r.source}: ${hostsOf(r.host).join(', ')}`));
    expect(FETCHED_SOURCES.flatMap((s) => s.hosts).sort()).toEqual([...list].sort());
  });
  it('refuses, before any call, every host the document does not allow', async () => {
    const off = ['api.adzuna.com', 'www.linkedin.com', 'www.themuse.com', 'a.b.recruitee.com', 'boards-api.greenhouse.io.evil.example', 'evil.example', '127.0.0.1'];
    let calls = 0;
    const transport = async (): Promise<Response> => {
      calls++;
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    };
    for (const host of off) {
      expect(allowed(list, host)).toBe(false);
      for (const { source } of FETCHED_SOURCES) expect((await fetchSource(source, `https://${host}/x`, {}, { data: '/nonexistent', transport })).ok).toBe(false);
    }
    expect(calls).toBe(0);
  });
});
