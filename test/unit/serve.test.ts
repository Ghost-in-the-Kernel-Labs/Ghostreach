/**
 * `ghostreach serve` (TODO 3.2): the local page fetched from 127.0.0.1, listing the reviews in a data folder of the test's own and
 * linking each PDF; bound to the loopback only; no link or text naming AUDIT.html or a review's JSON file (TODO 2.5); every
 * path out of the data folder, and every file of a review but its PDF, refused; names from the folder written as text (P-16).
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main, parse } from '../../src/cli/main.js';
import { readQueue, type ReviewRun } from '../../src/project/queue.js';
import { pdfName } from '../../src/project/review.js';
import { LOOPBACK, listReviews, opener, servePage, type ServedPage } from '../../src/project/serve.js';

/** The files of a review's folder the program keeps for its own use (REV-06), never named to the salesperson (TODO 2.5). */
const UNNAMED = /AUDIT\.html|findings\.json|summary\.json|\.crawl\.json|\.json\b/;
const PDF_BYTES = '%PDF-1.7\n% a stand-in for a review\n%%EOF\n';

let root: string;
let data: string;
let page: ServedPage | undefined;

/** A review's folder as `review` writes it: the crawl, the page, the two JSON files and, unless refused, the PDF. */
function review(folder: string, host: string, withPdf = true): void {
  const dir = join(data, folder);
  mkdirSync(dir, { recursive: true });
  for (const f of [`${host}.crawl.json`, 'AUDIT.html', 'findings.json', 'summary.json']) writeFileSync(join(dir, f), `{"secret":"${f}"}`);
  if (withPdf) writeFileSync(join(dir, pdfName(host)), PDF_BYTES);
}

/** A raw request, the path sent as written (fetch would resolve `..` before sending it). */
function raw(
  url: string,
  path: string,
  options: { method?: string; host?: string; address?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; headers: Record<string, unknown>; body: string }> {
  const { port } = new URL(url);
  return new Promise((done, fail) => {
    const headers = { host: options.host ?? `${LOOPBACK}:${port}`, ...options.headers };
    const req = request({ host: options.address ?? LOOPBACK, port, path, method: options.method ?? 'GET', headers }, (res) => {
      let body = '';
      res.setEncoding('latin1');
      res.on('data', (c: string) => (body += c));
      res.on('end', () => done({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', fail);
    req.end(options.body);
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ghostreach-serve-'));
  data = join(root, 'Ghostreach');
  mkdirSync(data);
  writeFileSync(join(root, 'outside.pdf'), 'outside the data folder');
});
afterEach(async () => {
  await page?.close();
  page = undefined;
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('ghostreach serve: the local page (TODO 3.2)', () => {
  it('is fetched from 127.0.0.1 and lists each review with a PDF, newest first, each linking its PDF', async () => {
    review('example.com-2026-11-13', 'example.com');
    review('example.com-2026-11-14', 'example.com');
    review('example.com-2026-11-14-2', 'example.com');
    review('shop.example.org-2026-11-14', 'shop.example.org');
    review('refused.example-2026-11-14', 'refused.example', false);
    page = await servePage(data);
    expect(page.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    const res = await fetch(page.url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    const html = await res.text();
    // Every link but the page's own reload link (3.3).
    const links = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]).filter((l) => l !== '/');
    expect(links).toEqual([
      '/reviews/example.com-2026-11-14-2/example.com%20site%20review.pdf',
      '/reviews/example.com-2026-11-14/example.com%20site%20review.pdf',
      '/reviews/shop.example.org-2026-11-14/shop.example.org%20site%20review.pdf',
      '/reviews/example.com-2026-11-13/example.com%20site%20review.pdf',
    ]);
    expect(html).not.toContain('refused.example');
    const pdf = await fetch(new URL(links[0], page.url));
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(await pdf.text()).toBe(PDF_BYTES);
  });

  it('names no AUDIT.html and no JSON file in a link or its text, and serves none of them', async () => {
    review('example.com-2026-11-14', 'example.com');
    page = await servePage(data);
    const html = await (await fetch(page.url)).text();
    expect(html).not.toMatch(UNNAMED);
    expect(html.replace(/<[^>]*>/g, '')).not.toMatch(UNNAMED);
    for (const f of ['AUDIT.html', 'findings.json', 'summary.json', 'example.com.crawl.json']) {
      expect((await raw(page.url, `/reviews/example.com-2026-11-14/${f}`)).status).toBe(404);
    }
  });

  it('binds to the loopback only: no other address of this machine answers', async () => {
    page = await servePage(data);
    expect(new URL(page.url).hostname).toBe(LOOPBACK);
    const others = Object.values(networkInterfaces()).flat().filter((a) => a && !a.internal && a.family === 'IPv4').map((a) => a!.address);
    for (const address of others) await expect(raw(page.url, '/', { address })).rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });

  it('refuses every path out of the data folder, a link out of it, and a file that is not the review\'s PDF', async () => {
    review('example.com-2026-11-14', 'example.com');
    symlinkSync(join(root, 'outside.pdf'), join(data, 'example.com-2026-11-14', 'linked.pdf'));
    mkdirSync(join(data, 'away.test-2026-11-14'));
    symlinkSync(join(root, 'outside.pdf'), join(data, 'away.test-2026-11-14', pdfName('away.test')));
    // A folder that is a link out of the data folder, to a review-shaped folder elsewhere.
    mkdirSync(join(root, 'elsewhere'));
    writeFileSync(join(root, 'elsewhere', pdfName('linked.test')), 'outside the data folder');
    symlinkSync(join(root, 'elsewhere'), join(data, 'linked.test-2026-11-14'));
    page = await servePage(data);
    const paths = [
      '/../outside.pdf',
      '/reviews/../outside.pdf',
      '/reviews/..%2Foutside.pdf/x',
      '/reviews/%2e%2e/outside.pdf',
      '/reviews/example.com-2026-11-14/..%2F..%2Foutside.pdf',
      '/reviews/example.com-2026-11-14/..%5C..%5Coutside.pdf',
      '/reviews/example.com-2026-11-14/linked.pdf',
      '/reviews/away.test-2026-11-14/away.test%20site%20review.pdf',
      '/reviews/linked.test-2026-11-14/linked.test%20site%20review.pdf',
      '/reviews/example.com-2026-11-14/example.com%20site%20review.pdf/x',
      '/reviews/example.com-2026-11-14/%E0%A4%A',
      '/reviews/example.com-2026-11-14/other.example%20site%20review.pdf',
      '/etc/passwd',
    ];
    const answered = [];
    for (const path of paths) answered.push([path, (await raw(page.url, path)).status]);
    expect(answered.filter(([, status]) => status !== 404)).toEqual([]);
    expect(listReviews(data).map((r) => r.folder)).toEqual(['example.com-2026-11-14']);
  });

  it('answers no other origin: no CORS header, another host name refused, GET and HEAD only', async () => {
    review('example.com-2026-11-14', 'example.com');
    page = await servePage(data);
    const ok = await raw(page.url, '/', { host: `localhost:${new URL(page.url).port}` });
    expect(ok.status).toBe(200);
    expect(Object.keys(ok.headers).filter((h) => h.startsWith('access-control-'))).toEqual([]);
    expect(ok.headers['content-security-policy']).toContain("default-src 'none'");
    expect((await raw(page.url, '/', { host: `rebound.example:${new URL(page.url).port}` })).status).toBe(421);
    expect((await raw(page.url, '/', { method: 'POST' })).status).toBe(405);
    expect((await raw(page.url, '/', { method: 'HEAD' })).status).toBe(200);
  });

  it('writes a name from the data folder as text, never as markup (P-16)', async () => {
    review('<img src=x onerror=alert(1)>-2026-11-14', '<img src=x onerror=alert(1)>');
    page = await servePage(data);
    const html = await (await fetch(page.url)).text();
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('with no review yet, says so', async () => {
    page = await servePage(join(root, 'not-made-yet'));
    expect(await (await fetch(page.url)).text()).toContain('No review yet.');
  });
});

describe('the command word and the opener', () => {
  it('serve is a word, alone; no option beginning -- comes with it (GR-003)', () => {
    expect(parse(['serve'])).toBe('serve');
    expect([['serve', 'example.com'], ['example.com', 'serve'], ['--serve'], ['serve', '--port=8080']].filter((argv) => parse(argv) !== null)).toEqual([]);
  });

  it('ghostreach serve prints the address, hands the page to the opener and returns 0 when it stops', async () => {
    review('example.com-2026-11-14', 'example.com');
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => void lines.push(line));
    let served: ServedPage | undefined;
    const running = main(['serve'], data, (p) => void (served = p));
    await vi.waitFor(() => expect(served).toBeDefined());
    expect(lines).toEqual([`The reviews are at ${served!.url} (this computer only). Ctrl-C stops the page.`]);
    expect(await (await fetch(served!.url)).text()).toContain('example.com%20site%20review.pdf');
    await served!.close();
    expect(await running).toBe(0);
  });

  it("opens the address with the platform's own opener, the address one argument and no shell", () => {
    const url = 'http://127.0.0.1:1234/';
    expect(opener('darwin', url)).toEqual({ command: 'open', args: [url] });
    expect(opener('win32', url)).toEqual({ command: 'explorer.exe', args: [url] });
    expect(opener('linux', url)).toEqual({ command: 'xdg-open', args: [url] });
  });
});

describe('the queue on the page (TODO 3.3)', () => {
  /** A form posted as the page's own browser posts it: its origin, a form body. */
  const form = (fields: Record<string, string>, origin?: string): { method: string; headers: Record<string, string>; body: string } => ({
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(origin === undefined ? {} : { origin }) },
    body: new URLSearchParams(fields).toString(),
  });
  const own = (): string => new URL(page!.url).origin;
  /** A fake review: records each site, fails the ones named. */
  const ran: string[] = [];
  const fakeRun = (fail: string[] = []): ReviewRun => async (site) => {
    ran.push(site);
    return fail.includes(site) ? 'No review was written: the start page answered 503.' : null;
  };
  const states = (): string[] => readQueue(data).map((e) => `${e.site} ${e.state}`);
  beforeEach(() => void (ran.length = 0));

  it('queues the pasted sites from its own form, shows each refused line back, and reviews them in order', async () => {
    page = await servePage(data, fakeRun(['b.example']));
    const html = await (await fetch(page.url)).text();
    expect(html).toContain('<form method="post" action="/queue">');
    expect(html).toContain('<textarea id="sites" name="sites"');
    const res = await raw(page.url, '/queue', form({ sites: 'a.example\nnot a site\nb.example\na.example' }, own()));
    expect(res.status).toBe(200);
    expect(res.body).toContain('2 sites queued.');
    expect(res.body).toContain('Refused: not a site (not a web address)');
    expect(res.body).toContain('Refused: a.example (already in the queue)');
    await vi.waitFor(() => expect(states()).toEqual(['a.example done', 'b.example failed']));
    expect(ran).toEqual(['a.example', 'b.example']);
    const after = await (await fetch(page.url)).text();
    expect(after).toContain('No review was written: the start page answered 503.');
    expect(after).not.toContain('http-equiv="refresh"');
    const id = readQueue(data)[1].id;
    expect(after).toContain(`<input type="hidden" name="id" value="${id}">`);
    // The salesperson's retry: back to waiting, reviewed again.
    const retried = await raw(page.url, '/queue/retry', form({ id: String(id) }, own()));
    expect(retried.status).toBe(303);
    expect(retried.headers.location).toBe('/');
    await vi.waitFor(() => expect(ran).toEqual(['a.example', 'b.example', 'b.example']));
  });

  it('reloads itself while a site waits or runs: a meta refresh, no script', async () => {
    let finish = (): void => {};
    page = await servePage(data, () => new Promise((done) => (finish = () => done(null))));
    await raw(page.url, '/queue', form({ sites: 'a.example' }, own()));
    const html = await (await fetch(page.url)).text();
    expect(html).toContain('<meta http-equiv="refresh" content="5; url=/">');
    expect(html).toMatch(/a\.example <span class="state">running<\/span>/);
    expect(html).not.toMatch(/<script/i);
    finish();
    await vi.waitFor(() => expect(states()).toEqual(['a.example done']));
  });

  it("refuses a post from another origin, from none, or not a form; the queue unchanged", async () => {
    page = await servePage(data, fakeRun());
    const port = new URL(page.url).port;
    for (const origin of [undefined, 'null', 'http://evil.example', `http://127.0.0.1:${Number(port) + 1}`, `https://127.0.0.1:${port}`]) {
      expect((await raw(page.url, '/queue', form({ sites: 'a.example' }, origin))).status).toBe(403);
    }
    // Origin must be the host the request came by, not merely one of the two names.
    expect((await raw(page.url, '/queue', form({ sites: 'a.example' }, `http://localhost:${port}`))).status).toBe(403);
    const json = { method: 'POST', headers: { origin: own(), 'content-type': 'application/json' }, body: '{"sites":"a.example"}' };
    expect((await raw(page.url, '/queue', json)).status).toBe(415);
    expect((await raw(page.url, '/queue', form({ sites: 'a.example' }, own()))).status).toBe(200);
    expect((await raw(page.url, '/queue', { ...form({ sites: 'b.example' }, own()), host: `rebound.example:${port}` })).status).toBe(421);
    expect((await raw(page.url, '/queue', form({ sites: 'x'.repeat(70_000) }, own()))).status).toBe(413);
    expect((await raw(page.url, '/queue')).status).toBe(404);
    expect((await raw(page.url, '/reviews', form({ sites: 'b.example' }, own()))).status).toBe(405);
    await vi.waitFor(() => expect(states()).toEqual(['a.example done']));
  });

  it('writes a pasted line as text, never as markup (P-16)', async () => {
    page = await servePage(data, fakeRun(['example.com/<img src=x onerror=alert(1)>']));
    const res = await raw(page.url, '/queue', form({ sites: '<script>alert(1)</script>\nexample.com/<img src=x onerror=alert(1)>' }, own()));
    expect(res.body).not.toContain('<script>alert');
    expect(res.body).toContain('Refused: &lt;script&gt;alert(1)&lt;/script&gt;');
    await vi.waitFor(() => expect(states()).toEqual(['example.com/<img src=x onerror=alert(1)> failed']));
    const html = await (await fetch(page.url)).text();
    expect(html).not.toContain('<img');
    expect(html).toContain('example.com/&lt;img src=x onerror=alert(1)&gt;');
  });

  it('a restart finds the entry a stop left running and reviews it again', async () => {
    writeFileSync(join(data, 'queue.json'), JSON.stringify({ sites: [{ id: 1, site: 'a.example', host: 'a.example', state: 'running' }] }));
    page = await servePage(data, fakeRun());
    await vi.waitFor(() => expect(states()).toEqual(['a.example done']));
    expect(ran).toEqual(['a.example']);
  });
});
