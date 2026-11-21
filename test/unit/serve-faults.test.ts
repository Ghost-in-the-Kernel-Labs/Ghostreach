/**
 * The local server under hostile or broken data: the four faults tune-up pass 4's security read (J-044) found and left, each held
 * here (J-045). Every value of a data file written into the page escaped; a data file that cannot be read said in one line and
 * never written, the server up; a PDF whose read fails after its headers ends that answer alone; one company lookup and one
 * discovery run at a time.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transport } from '../../src/project/fetch.js';
import { pdfName } from '../../src/project/review.js';
import { LOOPBACK, servePage, type ServedPage } from '../../src/project/serve.js';

/** While set, the server's read of a PDF fails after its headers are sent (a disk error, or the file gone between check and read). */
const reads = vi.hoisted(() => ({ fail: false }));
vi.mock('node:fs', async (real) => {
  const fs = await real<typeof import('node:fs')>();
  return {
    ...fs,
    createReadStream: ((...args: Parameters<typeof fs.createReadStream>) =>
      reads.fail ? new Readable({ read() { this.destroy(Object.assign(new Error('EIO: i/o error, read'), { code: 'EIO' })); } }) : fs.createReadStream(...args)) as typeof fs.createReadStream,
  };
});

let data: string;
let page: ServedPage | undefined;

/** A request as the page's own browser sends it; its status and body. */
function raw(url: string, path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ status: number; body: string }> {
  const { port } = new URL(url);
  return new Promise((done, fail) => {
    const req = request({ host: LOOPBACK, port, path, method: options.method ?? 'GET', headers: { host: `${LOOPBACK}:${port}`, ...options.headers } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (body += c));
      res.on('end', () => done({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', fail);
    req.end(options.body);
  });
}

/** Every source's answer: no board, nothing found. */
const none: Transport = async () => new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  data = mkdtempSync(join(tmpdir(), 'ghostreach-faults-'));
});
afterEach(async () => {
  await page?.close();
  page = undefined;
  reads.fail = false;
  rmSync(data, { recursive: true, force: true });
});

describe('the local server under hostile or broken data (J-044, J-045)', () => {
  const form = (fields: Record<string, string>, origin: string): { method: string; headers: Record<string, string>; body: string } => ({
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin },
    body: new URLSearchParams(fields).toString(),
  });
  const own = (): string => new URL(page!.url).origin;

  it("writes every value of queue.json into the page escaped, a state and an id as much as a site (P-16)", async () => {
    writeFileSync(join(data, 'queue.json'), JSON.stringify({ sites: [
      { id: '1"><img src=x onerror=alert(1)>', site: 'a.example', host: 'a.example', state: 'failed', error: 'stopped' },
      { id: 2, site: 'b.example', host: 'b.example', state: '<img src=x onerror=alert(2)>' },
    ] }));
    page = await servePage(data, async () => null);
    const html = await (await fetch(page.url)).text();
    expect(html).not.toContain('<img');
    expect(html).toContain('value="1&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"');
    expect(html).toContain('<span class="state">&lt;img src=x onerror=alert(2)&gt;</span>');
  });

  /** For each data file the page writes: a post that writes it. */
  const writes: [string, string, Record<string, string>][] = [
    ['queue.json', '/queue', { sites: 'a.example' }],
    ['companies.json', '/company', { company: 'Acme Robotics' }],
    ['discovery.json', '/discover/search', { titles: 'QA Engineer', location: 'remote' }],
    ['leads.json', '/company/site', { company: 'Acme Robotics', site: 'acme.example' }],
    ['keys.json', '/keys/remove', { source: 'Jooble' }],
  ];
  it.each(writes)('%s unreadable: the server stays up, says so in one line naming it, and never writes it', async (name, path, fields) => {
    const broken = '{"kept by the salesperson", not JSON';
    writeFileSync(join(data, name), broken);
    page = await servePage(data, async () => null, none, {});
    const line = `<p class="error">${name} in the data folder cannot be read, so it is left as it is and nothing is written to it.</p>`;
    const first = await fetch(page.url);
    expect(first.status).toBe(200);
    expect(await first.text()).toContain(line);
    const posted = await raw(page.url, path, form(fields, own()));
    expect(posted.status).toBe(200);
    expect(posted.body).toContain(line);
    expect(posted.body.split(line)).toHaveLength(2);
    expect((await fetch(page.url)).status).toBe(200);
    expect(readFileSync(join(data, name), 'utf8')).toBe(broken);
  });

  it('settings.json and buckets.json unreadable: the page says so, capped calls refused, neither written', async () => {
    writeFileSync(join(data, 'settings.json'), '{not JSON');
    writeFileSync(join(data, 'buckets.json'), '{not JSON');
    page = await servePage(data, async () => null, none, {});
    const run = await raw(page.url, '/discover/run', form({}, own()));
    expect(run.status).toBe(200);
    expect(run.body).toContain('settings.json could not be read');
    expect(run.body).toContain('its call count (buckets.json in the data folder) cannot be read; not fetched.');
    expect(readFileSync(join(data, 'settings.json'), 'utf8')).toBe('{not JSON');
    expect(readFileSync(join(data, 'buckets.json'), 'utf8')).toBe('{not JSON');
  });

  it("a PDF whose read fails after its headers ends that answer, and the server stays up", async () => {
    mkdirSync(join(data, 'example.com-2026-11-14'));
    writeFileSync(join(data, 'example.com-2026-11-14', pdfName('example.com')), '%PDF-1.7\n%%EOF\n');
    page = await servePage(data);
    reads.fail = true;
    const { port } = new URL(page.url);
    const complete = await new Promise<boolean>((done) => {
      const req = request({ host: LOOPBACK, port, path: '/reviews/example.com-2026-11-14/example.com%20site%20review.pdf', headers: { host: `${LOOPBACK}:${port}` } }, (res) => {
        res.on('error', () => {});
        res.resume();
        res.on('close', () => done(res.complete));
      });
      req.on('error', () => done(false));
      req.end();
    });
    expect(complete).toBe(false);
    reads.fail = false;
    expect((await fetch(page.url)).status).toBe(200);
  });

  /** A network that holds every call until `release`, counting the calls. */
  const held = (): { transport: Transport; calls: () => number; release: () => void } => {
    let calls = 0;
    let release = (): void => {};
    const gate = new Promise<void>((done) => (release = done));
    return {
      transport: async () => {
        calls += 1;
        await gate;
        return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
      },
      calls: () => calls,
      release: () => release(),
    };
  };

  it.each([
    ['/company', { company: 'Acme Robotics' }, 'A company lookup is already running; this one was not started.'],
    ['/discover/run', {}, 'The search is already running; this run was not started.'],
  ])('runs one %s at a time: a second while one runs is said back and starts nothing', async (path, fields, line) => {
    const net = held();
    page = await servePage(data, async () => null, net.transport, {});
    const first = raw(page.url, path, form(fields, own()));
    await vi.waitFor(() => expect(net.calls()).toBeGreaterThan(0));
    await new Promise((done) => setTimeout(done, 50));
    const asked = net.calls();
    const second = await raw(page.url, path, form(fields, own()));
    expect(second.status).toBe(200);
    expect(second.body).toContain(line);
    expect(net.calls()).toBe(asked);
    net.release();
    expect((await first).status).toBe(200);
    // Once it has finished, another may run.
    const third = await raw(page.url, path, form(fields, own()));
    expect(third.body).not.toContain(line);
  });
});
