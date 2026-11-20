/**
 * The company lane (TODO 4.6, RF-07): a company typed on the local page is looked up on each company-lane source of
 * docs/SOURCES.md through the one fetch function, its board names derived by a stated rule, probing bounded and stopped at a
 * source's first board, its QA, test and SDET roles listed by a stated title rule, every field from a board kept as data (P-16).
 * No network: every answer is a fixture of `test/support/boards/`, one per source, each synthetic from the provider's own
 * documented response, handed back by an in-memory transport that records each address asked.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BOARDS, MAX_CALLS, MAX_SLUGS, candidateSlugs, companiesFile, isQaTitle, keepLookup, keptUrl, lookUpCompany, readLookups } from '../../src/project/company.js';
import { FETCHED_SOURCES, type Transport } from '../../src/project/fetch.js';
import { MAYBE, NO_BOARD, PASTE_LANE } from '../../src/project/page-leads.js';
import { servePage, type ServedPage } from '../../src/project/serve.js';
import { parseSources, sourcesText } from '../support/sources.js';
import * as ashby from '../support/boards/ashby.js';
import * as greenhouse from '../support/boards/greenhouse.js';
import * as lever from '../support/boards/lever.js';
import * as personio from '../support/boards/personio.js';
import * as recruitee from '../support/boards/recruitee.js';
import * as smartrecruiters from '../support/boards/smartrecruiters.js';

/** A fixture answer: its body and type; any address not given answers 404, as each source does for a name it does not hold. */
type Answers = Record<string, { body: string; type: string }>;

let data: string;
let asked: string[];
let page: ServedPage | undefined;

/** The transport: the fixture for each address given, else 404; every address asked recorded. */
const boards = (answers: Answers): Transport => async (url) => {
  asked.push(url);
  const hit = answers[url];
  return hit ? new Response(hit.body, { headers: { 'Content-Type': hit.type } }) : new Response('{"ok":false}', { status: 404, headers: { 'Content-Type': 'application/json' } });
};

beforeEach(() => {
  data = mkdtempSync(join(tmpdir(), 'ghostreach-company-'));
  asked = [];
});
afterEach(async () => {
  await page?.close();
  page = undefined;
  rmSync(data, { recursive: true, force: true });
});

describe('the company-lane sources (docs/SOURCES.md)', () => {
  it('are the in rows of the company lane, each a source the fetch function may read', () => {
    const rows = parseSources(sourcesText()).filter((r) => r.lane === 'company' && r.status === 'in').map((r) => r.source);
    expect(BOARDS.map((b) => b.source)).toEqual(rows);
    expect(BOARDS.filter((b) => !FETCHED_SOURCES.some((s) => s.source === b.source)).map((b) => b.source)).toEqual([]);
  });
  it('has a fixture per source, each naming the provider page it is synthetic from', () => {
    const fixtures = { Greenhouse: greenhouse, Lever: lever, Ashby: ashby, SmartRecruiters: smartrecruiters, Recruitee: recruitee, Personio: personio };
    expect(Object.keys(fixtures)).toEqual(BOARDS.map((b) => b.source));
    for (const [name, fixture] of Object.entries(fixtures)) {
      const file = readFileSync(new URL(`../support/boards/${name.toLowerCase()}.ts`, import.meta.url), 'utf8');
      expect(file).toContain(`synthetic, from ${fixture.DOC}`);
    }
  });
});

describe('candidate board names (the rule in candidateSlugs)', () => {
  it('derives a name its words joined, then hyphenated, its legal form and accents dropped', () => {
    expect(candidateSlugs('Acme Robotics, Inc.')).toEqual({ slugs: ['acmerobotics', 'acme-robotics'], companyDomain: null });
    expect(candidateSlugs('  Zürich Läbs GmbH ')).toEqual({ slugs: ['zurichlabs', 'zurich-labs'], companyDomain: null });
    expect(candidateSlugs('Stripe').slugs).toEqual(['stripe']);
  });
  it("derives a site its domain's own label, then without hyphens, and keeps the domain", () => {
    expect(candidateSlugs('https://www.acme-robotics.com/about')).toEqual({ slugs: ['acme-robotics', 'acmerobotics'], companyDomain: 'acme-robotics.com' });
    expect(candidateSlugs('careers.acme.co.uk')).toEqual({ slugs: ['acme'], companyDomain: 'acme.co.uk' });
    expect(candidateSlugs('acme.io')).toEqual({ slugs: ['acme'], companyDomain: 'acme.io' });
  });
  it('never tries the first word alone, nothing that is not one DNS label, and at most MAX_SLUGS', () => {
    expect(candidateSlugs('General Motors').slugs).not.toContain('general');
    expect(candidateSlugs('').slugs).toEqual([]);
    expect(candidateSlugs('!!!').slugs).toEqual([]);
    expect(candidateSlugs('a'.repeat(90)).slugs).toEqual([]);
    expect(candidateSlugs('Acme Robotics').slugs.length).toBeLessThanOrEqual(MAX_SLUGS);
  });
});

describe('QA, test and SDET titles (the rule in isQaTitle)', () => {
  it('matches the trade', () => {
    for (const title of ['Senior QA Engineer', 'SDET II', 'Software Engineer in Test', 'Quality Assurance Specialist', 'Test Automation Engineer', 'Performance Test Engineer', 'Manual Tester', 'QA & Release Engineer (m/w/d)', 'Lead, Testing Engineering', 'qa analyst']) {
      expect([title, isQaTitle(title)]).toEqual([title, true]);
    }
  });
  it('passes near misses by', () => {
    for (const title of ['Test Kitchen Chef', 'Contest Manager', 'Attestation Analyst', 'Latest Products Lead', 'Protest Coordinator', 'test job', 'Product Engineer', 'Q&A Moderator', 'Aqua Park Manager', 'Quality Control Inspector']) {
      expect([title, isQaTitle(title)]).toEqual([title, false]);
    }
  });
});

describe('a posting address kept (P-16)', () => {
  const gh = BOARDS[0];
  it("keeps https on the source's own domain or the company's, nothing else", () => {
    expect(keptUrl('https://boards.greenhouse.io/acme/jobs/1', gh, null)).toBe('https://boards.greenhouse.io/acme/jobs/1');
    expect(keptUrl('https://jobs.acme.com/1', gh, 'acme.com')).toBe('https://jobs.acme.com/1');
    for (const url of ['https://jobs.acme.com/1', 'http://boards.greenhouse.io/acme/jobs/1', 'https://boards.greenhouse.io:8443/x', 'https://u:p@boards.greenhouse.io/x', 'https://greenhouse.io.evil.example/x', 'javascript:alert(1)', 'not a url', 42, null]) {
      expect(keptUrl(url, gh, url === 'https://jobs.acme.com/1' ? null : 'acme.com')).toBeUndefined();
    }
  });
});

describe('a lookup (TODO 4.6)', () => {
  const G = (slug: string): string => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;

  it('finds a company on Greenhouse under one name and lists its QA, test and SDET roles', async () => {
    const lookup = await lookUpCompany('Acme Robotics', { data, transport: boards({ [G('acme-robotics')]: { body: greenhouse.BOARD, type: greenhouse.TYPE } }) });
    expect(lookup.slugs).toEqual(['acmerobotics', 'acme-robotics']);
    expect(lookup.boards).toEqual([
      {
        source: 'Greenhouse',
        slug: 'acme-robotics',
        open: 7,
        roles: [
          { title: 'Senior QA Engineer', url: 'https://boards.greenhouse.io/acmerobotics/jobs/4001001' },
          // Typed by name, the company's domain is not known: its careers page is not kept, nor http, nor another host.
          { title: 'Software Engineer in Test' },
          { title: 'QA Lead' },
          { title: 'Test Automation Engineer <img src=x onerror=alert(1)>' },
        ],
      },
    ]);
    expect(lookup.unanswered).toEqual([]);
    // Greenhouse asked under both names; nothing after its board.
    expect(asked.filter((u) => u.startsWith('https://boards-api.greenhouse.io/'))).toEqual([G('acmerobotics'), G('acme-robotics')]);
  });

  it("keeps the company's careers address when its site was typed", async () => {
    const lookup = await lookUpCompany('www.acme-robotics.com', { data, transport: boards({ [G('acme-robotics')]: { body: greenhouse.BOARD, type: greenhouse.TYPE } }) });
    expect(lookup.boards[0].roles[1]).toEqual({ title: 'Software Engineer in Test', url: 'https://www.acme-robotics.com/careers?gh_jid=4001002' });
    expect(lookup.boards[0].roles[2]).toEqual({ title: 'QA Lead' });
  });

  it("reads each source's documented answer, stopping at each source's first board", async () => {
    const lookup = await lookUpCompany('Acme Robotics', {
      data,
      transport: boards({
        [G('acmerobotics')]: { body: greenhouse.NO_QA, type: greenhouse.TYPE },
        [G('acme-robotics')]: { body: greenhouse.BOARD, type: greenhouse.TYPE },
        'https://api.eu.lever.co/v0/postings/acmerobotics?mode=json': { body: lever.BOARD, type: lever.TYPE },
        'https://api.ashbyhq.com/posting-api/job-board/acmerobotics': { body: ashby.BOARD, type: ashby.TYPE },
        'https://api.smartrecruiters.com/v1/companies/acmerobotics/postings?limit=100': { body: smartrecruiters.EMPTY, type: smartrecruiters.TYPE },
        'https://api.smartrecruiters.com/v1/companies/acme-robotics/postings?limit=100': { body: smartrecruiters.BOARD, type: smartrecruiters.TYPE },
        'https://acmerobotics.recruitee.com/api/offers/': { body: recruitee.BOARD, type: recruitee.TYPE },
        'https://acme-robotics.jobs.personio.de/xml': { body: personio.BOARD, type: personio.TYPE },
      }),
    });
    expect(lookup.boards.map((b) => `${b.source} ${b.slug} ${b.open}: ${b.roles.map((r) => `${r.title}${r.url ? ` <${r.url}>` : ''}`).join('; ')}`)).toEqual([
      'Greenhouse acmerobotics 1: ',
      'Lever acmerobotics 2: SDET II <https://jobs.eu.lever.co/acmerobotics/5ac21346-8e0c-4494-8e7a-3eb92ff70001>',
      'Ashby acmerobotics 2: QA Automation Engineer <https://jobs.ashbyhq.com/acmerobotics/qa-automation-engineer>',
      'SmartRecruiters acme-robotics 2: Quality Assurance Specialist',
      'Recruitee acmerobotics 2: Performance Test Engineer <https://acmerobotics.recruitee.com/o/performance-test-engineer>',
      'Personio acme-robotics 2: QA & Release Engineer (m/w/d)',
    ]);
    // A source stops at its first board: Greenhouse's second name, and Recruitee's, never asked.
    expect(asked).not.toContain(G('acme-robotics'));
    expect(asked).not.toContain('https://acme-robotics.recruitee.com/api/offers/');
  });

  it('on no source: no board, every name asked once per source and instance, never past MAX_CALLS', async () => {
    const lookup = await lookUpCompany('Nobody Hires Here, Ltd', { data, transport: boards({}) });
    expect(lookup.boards).toEqual([]);
    expect(lookup.unanswered).toEqual([]);
    expect(asked.length).toBe(lookup.slugs.length * 7);
    expect(new Set(asked).size).toBe(asked.length);
    expect(MAX_CALLS).toBe(21);
    asked = [];
    const most = await lookUpCompany('https://www.no-board-here.co.uk', { data, transport: boards({}) });
    expect(most.slugs).toEqual(['no-board-here', 'noboardhere']);
    expect(asked.length).toBe(14);
    expect(asked.length).toBeLessThanOrEqual(MAX_CALLS);
  });

  it('says which source could not be asked, and asks it no further', async () => {
    const transport: Transport = async (url) => {
      asked.push(url);
      if (url.startsWith('https://api.ashbyhq.com/')) return new Response('busy', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      if (url.startsWith('https://boards-api.greenhouse.io/')) return new Response('{"unexpected":true}', { headers: { 'Content-Type': 'application/json' } });
      return new Response('', { status: 404 });
    };
    const lookup = await lookUpCompany('Acme Robotics', { data, transport });
    expect(lookup.unanswered).toEqual(['Greenhouse: answered in a shape its documentation does not give.', 'Ashby: answered 503.']);
    expect(asked.filter((u) => u.includes('ashbyhq') || u.includes('greenhouse'))).toHaveLength(2);
  });

  it("a board found by a guessed name is a maybe unless its own data names the company's domain or name (launch fixes 12)", async () => {
    // "example.com" typed: Greenhouse holds a board "example", but nothing on it names example.com: maybe another company's.
    const guessed = await lookUpCompany('example.com', { data, transport: boards({ [G('example')]: { body: greenhouse.NO_QA, type: greenhouse.TYPE } }) });
    expect(guessed.boards.map((b) => [b.slug, b.named])).toEqual([['example', undefined]]);
    // A posting on the company's own domain names it.
    const site = await lookUpCompany('www.acme-robotics.com', { data, transport: boards({ [G('acme-robotics')]: { body: greenhouse.BOARD, type: greenhouse.TYPE } }) });
    expect(site.boards[0].named).toBe(true);
    // Typed by name: the board's addresses carry the guessed name itself, so they never confirm it; a field naming the company does.
    const byName = await lookUpCompany('Acme Robotics', { data, transport: boards({ [G('acmerobotics')]: { body: greenhouse.BOARD, type: greenhouse.TYPE } }) });
    expect(byName.boards[0].named).toBeUndefined();
    const naming = JSON.stringify({ jobs: [{ title: 'QA Engineer', absolute_url: 'https://boards.greenhouse.io/acmerobotics/jobs/1', company_name: 'Acme Robotics, Inc.' }], meta: { total: 1 } });
    const named = await lookUpCompany('Acme Robotics', { data, transport: boards({ [G('acmerobotics')]: { body: naming, type: greenhouse.TYPE } }) });
    expect(named.boards[0].named).toBe(true);
    // A domain inside another (example.com.evil.net, notexample.com) is not the company's.
    const other = JSON.stringify({ jobs: [{ title: 'QA at notexample.com', absolute_url: 'https://example.com.evil.net/jobs/1' }], meta: { total: 1 } });
    const not = await lookUpCompany('example.com', { data, transport: boards({ [G('example')]: { body: other, type: greenhouse.TYPE } }) });
    expect(not.boards[0].named).toBeUndefined();
  });

  it('keeps lookups newest first, one per company, written whole', async () => {
    const one = await lookUpCompany('Acme Robotics', { data, transport: boards({}), now: () => new Date('2026-11-14T10:00:00Z') });
    keepLookup(data, one);
    keepLookup(data, { ...one, asked: 'Other Co', at: '2026-11-14T11:00:00.000Z' });
    keepLookup(data, { ...one, asked: 'acme robotics', at: '2026-11-14T12:00:00.000Z' });
    expect(readLookups(data).map((l) => `${l.asked} ${l.at}`)).toEqual(['acme robotics 2026-11-14T12:00:00.000Z', 'Other Co 2026-11-14T11:00:00.000Z']);
    expect(JSON.parse(readFileSync(companiesFile(data), 'utf8')).lookups).toHaveLength(2);
  });
});

describe('the company lane on the local page (TODO 4.6)', () => {
  const form = (company: string, origin?: string): { method: string; headers: Record<string, string>; body: string } => ({
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(origin === undefined ? {} : { origin }) },
    body: new URLSearchParams({ company }).toString(),
  });
  /** A raw post (fetch may not set `Origin`), as the page's own browser sends it unless said otherwise. */
  const post = (company: string, origin?: string, type?: string): Promise<{ status: number; text: () => Promise<string> }> => {
    const init = form(company, origin);
    const { port } = new URL(page!.url);
    return new Promise((done, fail) => {
      const headers = { host: `127.0.0.1:${port}`, ...init.headers, ...(type ? { 'content-type': type } : {}) };
      const req = request({ host: '127.0.0.1', port, path: '/company', method: 'POST', headers }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => (body += c));
        res.on('end', () => done({ status: res.statusCode ?? 0, text: async () => body }));
      });
      req.on('error', fail);
      req.end(init.body);
    });
  };
  const own = (): string => new URL(page!.url).origin;

  it('has a form, no script; a company on Greenhouse shows its QA roles, each title as text and a kept address as a link', async () => {
    page = await servePage(data, async () => null, boards({ 'https://boards-api.greenhouse.io/v1/boards/acmerobotics/jobs': { body: greenhouse.BOARD, type: greenhouse.TYPE } }));
    const blank = await (await fetch(page.url)).text();
    expect(blank).toContain('<form method="post" action="/company">');
    expect(blank).toContain('No company looked up yet.');
    const res = await post('Acme Robotics', own());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toMatch(/<script|<img/i);
    expect(html).toContain('Greenhouse board "acmerobotics": 7 open roles, 4 QA, test or SDET:');
    expect(html).toContain('<li><a href="https://boards.greenhouse.io/acmerobotics/jobs/4001001" rel="noreferrer">Senior QA Engineer</a></li>');
    expect(html).toContain('<li>Test Automation Engineer &lt;img src=x onerror=alert(1)&gt;</li>');
    expect(html).not.toContain('Test Kitchen Chef');
    expect(html).not.toContain('evil.example');
    // Stored, and shown again from the data folder.
    expect((await (await fetch(page.url)).text())).toContain('Senior QA Engineer</a>');
  });

  it('shows a board found by a guessed name as "maybe", with a line that it may be another company\'s (launch fixes 12)', async () => {
    page = await servePage(data, async () => null, boards({ 'https://boards-api.greenhouse.io/v1/boards/example/jobs': { body: greenhouse.NO_QA, type: greenhouse.TYPE } }));
    const html = await (await post('example.com', own())).text();
    expect(html).toContain('<li>maybe: Greenhouse board "example": 1 open role, 0 QA, test or SDET.');
    expect(html).toContain(MAYBE);
    expect(html).not.toMatch(/<li>Greenhouse board "example"/);
    await page.close();
    page = await servePage(data, async () => null, boards({ 'https://boards-api.greenhouse.io/v1/boards/acme-robotics/jobs': { body: greenhouse.BOARD, type: greenhouse.TYPE } }));
    const own2 = await (await post('www.acme-robotics.com', own())).text();
    expect(own2).toContain('<li>Greenhouse board "acme-robotics": 7 open roles, 4 QA, test or SDET:');
  });

  it('a company on no board says "no public board found" and offers the paste lane', async () => {
    page = await servePage(data, async () => null, boards({}));
    const html = await (await post('Nobody Hires Here', own())).text();
    expect(html).toContain(`<p>${NO_BOARD} ${PASTE_LANE}</p>`);
    expect(NO_BOARD).toBe('No public board found.');
    expect(PASTE_LANE).toMatch(/paste lane/);
  });

  it('refuses a post from another origin, from none, or not a form, asking no source; an empty name is said back', async () => {
    page = await servePage(data, async () => null, boards({}));
    for (const origin of [undefined, 'null', 'http://evil.example']) expect((await post('Acme', origin)).status).toBe(403);
    expect((await post('Acme', own(), 'application/json')).status).toBe(415);
    expect(asked).toEqual([]);
    const html = await (await post('   ', own())).text();
    expect(html).toContain('<p class="refused">Type a company name or its site.</p>');
    expect(asked).toEqual([]);
    expect(readLookups(data)).toEqual([]);
  });

  it('writes what was typed as text, never as markup (P-16)', async () => {
    page = await servePage(data, async () => null, boards({}));
    const html = await (await post('<script>alert(1)</script> Robotics', own())).text();
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('<strong>&lt;script&gt;alert(1)&lt;/script&gt; Robotics</strong>');
  });
});
