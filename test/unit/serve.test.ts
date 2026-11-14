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
function raw(url: string, path: string, options: { method?: string; host?: string; address?: string } = {}): Promise<{ status: number; headers: Record<string, unknown>; body: string }> {
  const { port } = new URL(url);
  return new Promise((done, fail) => {
    const req = request({ host: options.address ?? LOOPBACK, port, path, method: options.method ?? 'GET', headers: { host: options.host ?? `${LOOPBACK}:${port}` } }, (res) => {
      let body = '';
      res.setEncoding('latin1');
      res.on('data', (c: string) => (body += c));
      res.on('end', () => done({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', fail);
    req.end();
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
    const links = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
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
