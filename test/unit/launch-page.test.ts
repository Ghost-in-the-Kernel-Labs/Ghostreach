/**
 * The launch walk's fixes to the local page (launch fixes, item A; J-066): the primary action named for what it does, a done row's
 * PDF to open or download with its counts, a running row's progress, plain errors only, the lead finder folded away, the favicon.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { plainProgress, readQueue, type ReviewRun } from '../../src/project/queue.js';
import { pdfName } from '../../src/project/review.js';
import { plainError } from '../../src/project/html.js';
import { servePage, type ServedPage } from '../../src/project/serve.js';

let root: string;
let data: string;
let page: ServedPage | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ghostreach-launch-'));
  data = join(root, 'Ghostreach');
  mkdirSync(data);
});
afterEach(async () => {
  await page?.close();
  page = undefined;
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

const own = (): string => new URL(page!.url).origin;
/** A form posted as the page's own browser posts it. */
const post = (path: string, fields: Record<string, string>): Promise<Response> => fetch(new URL(path, page!.url), {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', origin: own() },
  body: new URLSearchParams(fields).toString(),
});
const get = async (): Promise<string> => (await fetch(page!.url)).text();
const states = (): string[] => readQueue(data).map((e) => `${e.site} ${e.state}`);

/** A review's folder with its PDF and summary.json, as `review` writes them. */
function reviewed(folder: string, host: string, major: number, minor: number, info = 0): void {
  const dir = join(data, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, pdfName(host)), '%PDF-1.7\n%%EOF\n');
  writeFileSync(join(dir, 'summary.json'), JSON.stringify({ host, date: folder.slice(-10), pagesRead: 4, bySeverity: { major, minor, info }, byCode: {} }));
}

/** The page's HTML outside its one <details>: what the first screen shows. */
const firstScreen = (html: string): string => html.replace(/<details>[\s\S]*<\/details>/, '');

describe('the primary action (launch fixes 1)', () => {
  it('is "Review a website" with a "Review these sites" button; no button says Queue', async () => {
    page = await servePage(data, async () => null);
    const html = await get();
    expect(html).toContain('<h1>Review a website</h1>');
    expect(html).toContain('<button>Review these sites</button>');
    expect(html).not.toContain('<button>Queue</button>');
  });
});

describe('a done row (launch fixes 2)', () => {
  it('opens its PDF with its counts read from summary.json, and offers a download link', async () => {
    page = await servePage(data, async (site) => {
      reviewed('a.example-2026-11-20', site, 3, 6);
      return null;
    });
    await post('/queue', { sites: 'a.example' });
    await vi.waitFor(() => expect(states()).toEqual(['a.example done']));
    const html = await get();
    const row = /<li>a\.example <span class="state">done<\/span>.*<\/li>/.exec(html)?.[0] ?? '';
    const href = `/reviews/a.example-2026-11-20/${encodeURIComponent(pdfName('a.example'))}`;
    expect(row).toContain(`<a href="${href}">Open PDF</a> · 9 findings (3 major, 6 minor)`);
    expect(row).toContain(`<a href="${href}" download>Download PDF</a>`);
    // The reviews done list says the same.
    expect(html.split('Open PDF').length - 1).toBe(2);
  });
});

describe("a running row's progress (launch fixes 3)", () => {
  it("shows the review's latest plain line mid-crawl", async () => {
    let finish = (): void => {};
    const run: ReviewRun = (_site, _alongside, progress) => new Promise((done) => {
      progress?.('[8/300] http://a.example/pricing');
      finish = () => done(null);
    });
    page = await servePage(data, run);
    await post('/queue', { sites: 'a.example' });
    await vi.waitFor(async () => expect(await get()).toContain('reading page 8 of up to 300'));
    finish();
    await vi.waitFor(() => expect(states()).toEqual(['a.example done']));
    expect(await get()).not.toContain('page 8');
  });
  it('reads each kind of line plainly, and none it does not know', () => {
    expect(plainProgress('[8/300] https://a.example/x')).toBe('reading page 8 of up to 300');
    expect(plainProgress('[2/6] second look: https://a.example/')).toBe('second look, page 2 of 6');
    expect(plainProgress('Downloading the browser the crawler uses (once; a minute or so)...')).toBe('downloading the browser (first run)');
    expect(plainProgress('Writing the PDF...')).toBe('writing the PDF');
    expect(plainProgress('Second look at 6 pages, in a fresh browser, for what changes between visits:')).toBeNull();
  });
});

describe('plain errors only (launch fixes 4)', () => {
  const RAW = /E[A-Z]{5,}|getaddrinfo/;
  it('keeps the sentence and drops the raw codes', () => {
    expect(plainError('No review was written: the site could not be reached (connect ECONNREFUSED 127.0.0.1:9).')).toBe('No review was written: the site could not be reached (nothing answered at that address).');
    expect(plainError('No review was written: the site could not be reached (getaddrinfo ENOTFOUND no-such.invalid).')).toBe('No review was written: the site could not be reached (no site has that name).');
    expect(plainError('No review was written: the start page failed: net::ERR_NAME_NOT_RESOLVED at https://x.invalid/')).not.toMatch(RAW);
    expect(plainError('No review was written: the start page answered 503.')).toBe('No review was written: the start page answered 503.');
  });
  it('the page shows no raw code for a failed row', async () => {
    page = await servePage(data, async (site) => (site.includes('9') ? 'No review was written: the site could not be reached (connect ECONNREFUSED 127.0.0.1:9).' : 'No review was written: the site could not be reached (getaddrinfo ENOTFOUND no-such.invalid).'));
    await post('/queue', { sites: 'http://localhost:9/\nno-such.invalid' });
    await vi.waitFor(() => expect(states()).toEqual(['http://localhost:9/ failed', 'no-such.invalid failed']));
    const text = (await get()).replace(/<[^>]*>/g, ' ');
    expect(text).toContain('could not be reached');
    expect(text).not.toMatch(RAW);
  });
});

describe('the lead finder folded away (launch fixes 5)', () => {
  it('sits in one closed <details> below the reviews; the first screen names no key, no SDET, no QA', async () => {
    vi.stubEnv('JOOBLE_API_KEY', '');
    vi.stubEnv('USAJOBS_API_KEY', '');
    vi.stubEnv('USAJOBS_EMAIL', '');
    page = await servePage(data, async () => null);
    const html = await get();
    expect(html.match(/<details>/g)).toHaveLength(1);
    expect(html).toContain('<details>\n<summary>Find companies to review</summary>');
    expect(html.indexOf('<details>')).toBeGreaterThan(html.indexOf('<h2>Done</h2>'));
    const first = firstScreen(html);
    for (const word of ['_API_KEY', 'SDET', 'QA']) expect(first).not.toContain(word);
    expect(html).toContain('Jooble <span class="state">needs a key from Ghost</span>');
  });
  it('has one "Search" button, which saves the search and runs it', async () => {
    page = await servePage(data, async () => null, async () => new Response('', { status: 404 }), {});
    const html = await get();
    expect(html).toContain('<button>Search</button>');
    expect(html).not.toContain('Save the search');
    expect(html).not.toContain('Run the search');
    const res = await post('/discover/run', { titles: 'Test Engineer', location: 'remote' });
    expect(res.status).toBe(200);
    const after = await res.text();
    expect(after).toContain('<details open>');
    expect(after).toMatch(/Last run \d{4}-\d{2}-\d{2} \(Test Engineer; remote\)/);
    expect(JSON.parse(readFileSync(join(data, 'discovery.json'), 'utf8')).search.titles).toEqual(['Test Engineer']);
  });
});

describe('the favicon (launch fixes 6)', () => {
  it('the page links the icon, served as SVG and as a 32 px PNG', async () => {
    page = await servePage(data, async () => null);
    const html = await get();
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
    expect(html).toContain('<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">');
    const svg = await fetch(new URL('/favicon.svg', page.url));
    expect(svg.status).toBe(200);
    expect(svg.headers.get('content-type')).toBe('image/svg+xml');
    expect(await svg.text()).toContain('<svg');
    const png = await fetch(new URL('/favicon-32.png', page.url));
    expect(png.headers.get('content-type')).toBe('image/png');
    const bytes = Buffer.from(await png.arrayBuffer());
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([32, 32]);
  });
});
