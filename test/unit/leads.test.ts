/**
 * What the salesperson keeps on a company row of the lead finder (TODO 4.8 on): the website typed in a text box, since no source
 * gives one, held to a site's test and kept in the data folder, never looked up (no fetch, no search engine; GR-005); a closed
 * site's posting pasted (4.9), kept as a note and never fetched. No network: the page's lead finder is handed a transport that
 * records every call, and the one fetch function is watched (`fetchSource`, spied on as the module is loaded); neither is called.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discoveryFile, type DiscoveryRun } from '../../src/project/discover.js';
import { companiesFile, type CompanyLookup } from '../../src/project/company.js';
import { fetchSource, type Transport } from '../../src/project/fetch.js';
import { CLOSED_SITES, companyKey, keepPosting, keepWebsite, postingsOf, readNotes, websiteOf } from '../../src/project/leads.js';
import { parseSources, sourcesText } from '../support/sources.js';
import { servePage, type ServedPage } from '../../src/project/serve.js';

// The one fetch function, watched: every module of the program that imports it gets this spy.
vi.mock('../../src/project/fetch.js', async (original) => {
  const real = await original<typeof import('../../src/project/fetch.js')>();
  return { ...real, fetchSource: vi.fn(real.fetchSource) };
});

let data: string;
let calls: string[];
let page: ServedPage | undefined;

/** The lead finder's network: records each address asked and answers nothing. */
const transport: Transport = async (url) => {
  calls.push(url);
  return new Response('', { status: 404 });
};

/** A last discovery run of two companies, as `keepRun` writes it. */
const RUN: DiscoveryRun = {
  at: '2026-11-14T12:00:00.000Z',
  search: { titles: ['QA engineer'], location: 'remote' },
  rows: [
    { company: 'ACME Robotics', title: 'QA Engineer', url: 'https://remotive.com/remote-jobs/qa/qa-engineer-1', source: 'Remotive', at: '2026-11-13T00:00:00.000Z', others: 0 },
    { company: 'Globex Corporation', title: 'SDET', url: 'https://arbeitnow.com/view/sdet-globex-2', source: 'Arbeitnow', at: '2026-11-12T00:00:00.000Z', others: 1 },
  ],
  skipped: [],
};

/** A company lane lookup typed as a site, and one typed as a name, as `keepLookup` writes them. */
const LOOKUPS: CompanyLookup[] = [
  { asked: 'initech.com', at: '2026-11-14T10:00:00.000Z', slugs: ['initech'], boards: [], unanswered: [] },
  { asked: 'Hooli', at: '2026-11-14T09:00:00.000Z', slugs: ['hooli'], boards: [], unanswered: [] },
];

/** A raw form post, as the page's own browser sends it unless said otherwise (`null`: no `Origin`). */
function post(url: string, path: string, fields: Record<string, string>, origin: string | null = new URL(url).origin): Promise<{ status: number; text: string }> {
  const { port } = new URL(url);
  return new Promise((done, fail) => {
    const headers = { host: `127.0.0.1:${port}`, 'content-type': 'application/x-www-form-urlencoded', ...(origin === null ? {} : { origin }) };
    const req = request({ host: '127.0.0.1', port, path, method: 'POST', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (body += c));
      res.on('end', () => done({ status: res.statusCode ?? 0, text: body }));
    });
    req.on('error', fail);
    req.end(new URLSearchParams(fields).toString());
  });
}

beforeEach(() => {
  data = mkdtempSync(join(tmpdir(), 'ghostreach-leads-'));
  calls = [];
  vi.mocked(fetchSource).mockClear();
  writeFileSync(discoveryFile(data), JSON.stringify({ search: RUN.search, run: RUN }));
  writeFileSync(companiesFile(data), JSON.stringify({ lookups: LOOKUPS }));
});
afterEach(async () => {
  await page?.close();
  page = undefined;
  rmSync(data, { recursive: true, force: true });
});

describe('the website a salesperson types (TODO 4.8)', () => {
  it('keeps a typed site as a review would take it, by company; refuses what is not a site; blank forgets it', () => {
    expect(keepWebsite(data, 'ACME Robotics', 'acme-robotics.com')).toBeNull();
    expect(readNotes(data)).toEqual({ 'acme robotics': { name: 'ACME Robotics', website: 'https://acme-robotics.com' } });
    // The company lane's "Acme Robotics, Inc." is the same company.
    expect(websiteOf(readNotes(data), 'Acme Robotics, Inc.')).toBe('https://acme-robotics.com');
    expect(keepWebsite(data, 'ACME Robotics', 'not a site')).toBe('Not a web address: not a site');
    expect(keepWebsite(data, 'ACME Robotics', 'javascript:alert(1)')).toBe('Not a web address: javascript:alert(1)');
    expect(keepWebsite(data, '  ', 'acme.com')).toBe('That row names no company.');
    expect(websiteOf(readNotes(data), 'ACME Robotics')).toBe('https://acme-robotics.com');
    expect(keepWebsite(data, 'ACME Robotics', ' ')).toBeNull();
    expect(websiteOf(readNotes(data), 'ACME Robotics')).toBeUndefined();
    expect(companyKey('ACME Robotics')).toBe('acme robotics');
    // A name that is an object's own word is a company like any other.
    expect(websiteOf(readNotes(data), 'Constructor')).toBeUndefined();
    expect(keepWebsite(data, 'Constructor', 'constructor.example')).toBeNull();
    expect(websiteOf(readNotes(data), 'Constructor')).toBe('https://constructor.example');
  });

  it('shows a text box on every company row without a site; a lookup typed as a site has that site', async () => {
    page = await servePage(data, async () => null, transport, {});
    const html = await (await fetch(page.url)).text();
    expect(html).not.toMatch(/<script/i);
    for (const name of ['ACME Robotics', 'Globex Corporation', 'Hooli']) {
      expect(html).toContain(`<span class="state">no website given</span>\n<form method="post" action="/company/site"><input type="hidden" name="company" value="${name}"><label>Website: <input name="site" type="text" maxlength="300" placeholder="acme.com" value=""></label>`);
    }
    expect(html).toContain('<input type="hidden" name="company" value="initech.com"><label>Website: <input name="site" type="text" maxlength="300" placeholder="acme.com" value="https://initech.com">');
    expect(calls).toEqual([]);
  });

  it('keeps the typed site from the row\'s form and shows it there; refuses a bad one under its row; fetches nothing', async () => {
    page = await servePage(data, async () => null, transport, {});
    const kept = await post(page.url, '/company/site', { company: 'Globex Corporation', site: 'globex.example' });
    expect(kept.status).toBe(200);
    expect(kept.text).toContain('value="Globex Corporation"><label>Website: <input name="site" type="text" maxlength="300" placeholder="acme.com" value="https://globex.example">');
    const refused = await post(page.url, '/company/site', { company: 'Hooli', site: '<b>hooli</b>' });
    expect(refused.text).toContain('<p class="refused">Not a web address: &lt;b&gt;hooli&lt;/b&gt;</p>\n<form method="post" action="/company/site"><input type="hidden" name="company" value="Hooli">');
    expect(readNotes(data)).toEqual({ 'globex': { name: 'Globex Corporation', website: 'https://globex.example' } });
    expect(calls).toEqual([]);
  });

  it('refuses a post from another origin or from none, keeping nothing', async () => {
    page = await servePage(data, async () => null, transport, {});
    for (const origin of [null, 'null', 'http://evil.example']) {
      expect((await post(page.url, '/company/site', { company: 'Hooli', site: 'hooli.example' }, origin)).status).toBe(403);
    }
    expect(readNotes(data)).toEqual({});
  });
});

describe('the paste lane (TODO 4.9)', () => {
  const POSTING = 'https://www.linkedin.com/jobs/view/4001001/?trk=x';

  it('names one closed site per paste-only row of docs/SOURCES.md', () => {
    const closed = parseSources(sourcesText()).filter((r) => r.status === 'paste only').map((r) => `${r.source.toLowerCase()}.com`);
    expect([...CLOSED_SITES]).toEqual(closed);
  });

  it('keeps a closed site\'s posting on its company, newest first, none twice; refuses any other address', () => {
    const at = new Date('2026-11-14T12:00:00Z');
    expect(keepPosting(data, 'Hooli', POSTING, at)).toBeNull();
    expect(keepPosting(data, 'Hooli', 'uk.indeed.com/viewjob?jk=abc', at)).toBeNull();
    expect(keepPosting(data, 'Hooli', POSTING, at)).toBeNull();
    expect(postingsOf(readNotes(data), 'Hooli, Inc.').map((p) => p.url)).toEqual([POSTING, 'https://uk.indeed.com/viewjob?jk=abc']);
    const refused = 'Not a posting on LinkedIn, Indeed, Glassdoor or ZipRecruiter (an https address).';
    for (const text of ['https://hooli.example/jobs/1', 'http://www.linkedin.com/jobs/view/1', 'https://linkedin.com.evil.example/x', 'https://user:pw@www.glassdoor.com/x', 'https://www.ziprecruiter.com:8443/x', 'javascript:alert(1)', 'not an address', '']) {
      expect([text, keepPosting(data, 'Hooli', text, at)]).toEqual([text, refused]);
    }
    expect(fetchSource).not.toHaveBeenCalled();
  });

  it('is offered on every company row; a pasted posting is shown as an escaped link, opened by no one but the salesperson, and the fetch function is never called', async () => {
    page = await servePage(data, async () => null, transport, {});
    const blank = await (await fetch(page.url)).text();
    expect(blank.match(/<form method="post" action="\/company\/posting">/g)).toHaveLength(4);
    const network = vi.spyOn(globalThis, 'fetch');
    const pasted = `${POSTING}&q="><script>alert(1)</script>`;
    const kept = await post(page.url, '/company/posting', { company: 'Globex Corporation', posting: pasted });
    expect(network).not.toHaveBeenCalled();
    network.mockRestore();
    expect(kept.status).toBe(200);
    expect(kept.text).not.toMatch(/<script/i);
    const href = new URL(pasted).href;
    expect(kept.text).toContain(`<li><a href="${href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" rel="noopener noreferrer">`);
    expect(kept.text).toContain('<span class="day">pasted ');
    const refused = await post(page.url, '/company/posting', { company: 'Hooli', posting: 'https://hooli.example/jobs/1' });
    expect(refused.text).toContain('<p class="refused">Not a posting on LinkedIn, Indeed, Glassdoor or ZipRecruiter (an https address).</p>');
    expect(fetchSource).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('refuses a post from another origin or from none, keeping nothing', async () => {
    page = await servePage(data, async () => null, transport, {});
    for (const origin of [null, 'null', 'http://evil.example']) {
      expect((await post(page.url, '/company/posting', { company: 'Hooli', posting: POSTING }, origin)).status).toBe(403);
    }
    expect(readNotes(data)).toEqual({});
  });
});
