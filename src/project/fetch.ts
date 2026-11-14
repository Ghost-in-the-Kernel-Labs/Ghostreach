/**
 * The lead finder's one fetch function (TODO 4.5, P-16, GR-005, REV-09): every fetch of Phase 4 leaves through `fetchSource`, and
 * only to a host of its source's `in` row of docs/SOURCES.md (`FETCHED_SOURCES`, held to the document by test/unit/hosts.test.ts).
 * It follows no redirect (a 3xx is an answer refused, never a second request), takes https alone on the default port, times out,
 * reads at most `MAX_BYTES` of a body, and gives back JSON parsed, or text: HTML with its markup stripped (`htmlToText`), any other
 * text as it came. A source with a stated cap draws one token from its bucket per call, before the call; the buckets are kept in
 * `<data>/buckets.json`, written whole, so a restart does not refill a day's count; a source over its cap is refused at once and
 * named, never waited on. Nothing here prints or logs, and no line it returns holds the address: a key may ride in it (Jooble's,
 * in the path).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** A stated cap: so many calls in each UTC day, or each minute. */
interface Cap {
  calls: number;
  every: 'day' | 'minute';
}

/** A source the code may fetch: its `in` row's name and hosts (`{company}` one leftmost DNS label), and its stated caps. */
export interface FetchedSource {
  source: string;
  hosts: readonly string[];
  caps: readonly Cap[];
}

/** The `in` rows of docs/SOURCES.md, in its order: the allow-list in code. A source whose row states no cap has no bucket. */
export const FETCHED_SOURCES: readonly FetchedSource[] = [
  { source: 'Greenhouse', hosts: ['boards-api.greenhouse.io'], caps: [] },
  { source: 'Lever', hosts: ['api.lever.co', 'api.eu.lever.co'], caps: [] },
  { source: 'Ashby', hosts: ['api.ashbyhq.com'], caps: [] },
  { source: 'SmartRecruiters', hosts: ['api.smartrecruiters.com'], caps: [] },
  { source: 'Recruitee', hosts: ['{company}.recruitee.com'], caps: [] },
  { source: 'Personio', hosts: ['{company}.jobs.personio.de'], caps: [] },
  { source: 'Jooble', hosts: ['jooble.org'], caps: [{ calls: 100, every: 'day' }] },
  { source: 'Arbeitnow', hosts: ['www.arbeitnow.com'], caps: [] },
  { source: 'Remotive', hosts: ['remotive.com'], caps: [{ calls: 4, every: 'day' }, { calls: 2, every: 'minute' }] },
  { source: 'USAJOBS', hosts: ['data.usajobs.gov'], caps: [] },
];

/** The most of a body read: a large board's postings with their text, and no more held in memory. */
export const MAX_BYTES = 8 * 1024 * 1024;
/** How long a call may take, its body included. */
export const TIMEOUT_MS = 30_000;

/**
 * What a fetch gave back: JSON parsed, or text; or why not, in one line that never holds the address, with the answer's status
 * when the source answered with one outside 2xx (a redirect, a 404: the company lane reads a 404 as "no board here").
 */
export type Fetched = { ok: true; kind: 'json'; json: unknown } | { ok: true; kind: 'text'; text: string } | { ok: false; why: string; status?: number };

/** The network: the platform's `fetch`, or a test's. */
export type Transport = (url: string, init: RequestInit) => Promise<Response>;

/** A call's request: the method (GET unless said), its headers and body (Jooble's POST, USAJOBS's headers). */
export interface SourceRequest {
  method?: 'GET' | 'POST';
  headers?: Readonly<Record<string, string>>;
  body?: string;
}

export interface FetchOptions {
  /** The data folder, where the buckets are kept. */
  data: string;
  transport?: Transport;
  now?: () => Date;
  timeoutMs?: number;
  maxBytes?: number;
}

/** Whether `host` is one of the source's: an exact entry, or `{company}.<rest>` with one DNS label in its place. */
function hostOf(source: FetchedSource, host: string): boolean {
  const name = host.toLowerCase();
  return source.hosts.some((entry) => {
    if (!entry.startsWith('{company}.')) return entry === name;
    const rest = entry.slice('{company}'.length);
    return name.endsWith(rest) && /^[a-z0-9-]+$/.test(name.slice(0, -rest.length));
  });
}

/** The buckets file: per source, per cap, the window's start (ms since the epoch, UTC) and the calls drawn in it. */
type Buckets = Record<string, Record<string, { start: number; used: number }>>;

export const bucketsFile = (data: string): string => join(data, 'buckets.json');
const WINDOW_MS = { day: 86_400_000, minute: 60_000 } as const;

/**
 * Draws one call from each of the source's buckets, written before the call goes out: null when drawn, else why refused. A file
 * that cannot be read refuses every capped call rather than be overwritten, since a fresh one would refill a spent day.
 */
function draw(data: string, source: FetchedSource, now: number): string | null {
  if (!source.caps.length) return null;
  const file = bucketsFile(data);
  let buckets: Buckets = {};
  try {
    if (existsSync(file)) buckets = JSON.parse(readFileSync(file, 'utf8')) as Buckets;
    if (typeof buckets !== 'object' || buckets === null || Array.isArray(buckets)) throw new Error('not an object');
  } catch {
    return `${source.source}: its call count (buckets.json in the data folder) cannot be read; not fetched.`;
  }
  const mine = { ...(buckets[source.source] ?? {}) };
  for (const cap of source.caps) {
    const start = Math.floor(now / WINDOW_MS[cap.every]) * WINDOW_MS[cap.every];
    const held = mine[cap.every];
    const used = held && held.start === start && Number.isInteger(held.used) ? held.used : 0;
    if (used >= cap.calls) return `${source.source}: over its cap of ${cap.calls} a ${cap.every}${cap.every === 'day' ? ' (UTC)' : ''}; skipped.`;
    mine[cap.every] = { start, used: used + 1 };
  }
  mkdirSync(data, { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ ...buckets, [source.source]: mine }, null, 2)}\n`);
  renameSync(temp, file);
  return null;
}

/** The body, at most `max` bytes; null past it (the rest is not read). */
async function readCapped(res: Response, max: number): Promise<Buffer | null> {
  if (Number(res.headers.get('content-length') ?? 0) > max) {
    await res.body?.cancel();
    return null;
  }
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Fetches `url` for `source`: refused, without a call, when the source is not an `in` row, the address is not https on the
 * default port to one of its hosts, or a bucket is spent; then one call that follows no redirect. JSON comes back parsed, HTML
 * as text, other text as it came; anything else, an error status, a redirect, a timeout or a body past the size is refused.
 */
export async function fetchSource(sourceName: string, url: string, request: SourceRequest, options: FetchOptions): Promise<Fetched> {
  const source = FETCHED_SOURCES.find((s) => s.source === sourceName);
  if (!source) return { ok: false, why: `${sourceName}: not a source the lead finder may read.` };
  let address: URL;
  try {
    address = new URL(url);
  } catch {
    return { ok: false, why: `${source.source}: not a web address.` };
  }
  if (address.protocol !== 'https:' || address.port !== '' || address.username !== '' || address.password !== '' || !hostOf(source, address.hostname)) {
    return { ok: false, why: `${source.source}: the address is not one of its hosts; not fetched.` };
  }
  const refused = draw(options.data, source, (options.now?.() ?? new Date()).getTime());
  if (refused) return { ok: false, why: refused };
  const transport: Transport = options.transport ?? ((target, init) => fetch(target, init));
  let res: Response;
  let body: Buffer | null;
  try {
    res = await transport(address.href, {
      method: request.method ?? 'GET',
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel();
      return { ok: false, why: `${source.source}: answered with a redirect (${res.status}); not followed.`, status: res.status };
    }
    if (res.status < 200 || res.status >= 300) {
      await res.body?.cancel();
      return { ok: false, why: `${source.source}: answered ${res.status}.`, status: res.status };
    }
    body = await readCapped(res, options.maxBytes ?? MAX_BYTES);
  } catch (error) {
    // The error's own message may name the address (and a key in it): only its kind is said.
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return { ok: false, why: `${source.source}: ${timedOut ? 'timed out' : 'could not be reached'}.` };
  }
  if (!body) return { ok: false, why: `${source.source}: the answer is larger than ${options.maxBytes ?? MAX_BYTES} bytes; not read.` };
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const text = new TextDecoder('utf-8').decode(body);
  if (type === 'application/json' || type.endsWith('+json')) {
    try {
      return { ok: true, kind: 'json', json: JSON.parse(text) as unknown };
    } catch {
      return { ok: false, why: `${source.source}: the answer is not JSON.` };
    }
  }
  if (type === 'text/html' || type === 'application/xhtml+xml') return { ok: true, kind: 'text', text: htmlToText(text) };
  if (type.startsWith('text/') || type === 'application/xml' || type.endsWith('+xml')) return { ok: true, kind: 'text', text };
  return { ok: false, why: `${source.source}: the answer is not text (${type || 'no type'}).` };
}

/** Elements whose content is never text: dropped whole. */
const RAW = new Set(['script', 'style', 'noscript', 'template', 'svg', 'math', 'iframe', 'object', 'head']);
/** Elements that break a line. */
const BLOCK = new Set(['br', 'p', 'div', 'li', 'ul', 'ol', 'dl', 'dt', 'dd', 'tr', 'td', 'th', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside', 'blockquote', 'pre', 'hr', 'title']);
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** One character reference read as its character; one not known, or out of range, kept as written. */
function entity(whole: string, ref: string): string {
  if (ref[0] !== '#') return NAMED[ref.toLowerCase()] ?? whole;
  const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
  return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
}

/**
 * HTML as text (P-16): every tag, comment and declaration gone, the content of script, style and their kind dropped whole, a
 * block element a line break, character references read, runs of space one space, no blank line. Read in one pass, each
 * `<` to its `>` (and a dropped element to its closing tag), so no input costs more than linear time.
 */
export function htmlToText(html: string): string {
  const lower = html.toLowerCase();
  let out = '';
  let at = 0;
  while (at < html.length) {
    const open = html.indexOf('<', at);
    if (open < 0) {
      out += html.slice(at);
      break;
    }
    out += html.slice(at, open);
    const next = html[open + 1] ?? '';
    if (html.startsWith('<!--', open)) {
      const end = html.indexOf('-->', open + 4);
      at = end < 0 ? html.length : end + 3;
      out += ' ';
      continue;
    }
    if (!/[A-Za-z/!?]/.test(next)) {
      out += '<';
      at = open + 1;
      continue;
    }
    const close = html.indexOf('>', open);
    if (close < 0) break;
    const name = /^<\/?([a-z][a-z0-9-]*)/.exec(lower.slice(open, Math.min(close + 1, open + 40)))?.[1] ?? '';
    at = close + 1;
    if (RAW.has(name) && next !== '/' && html[close - 1] !== '/') {
      const end = lower.indexOf(`</${name}`, at);
      const endClose = end < 0 ? -1 : html.indexOf('>', end);
      at = endClose < 0 ? html.length : endClose + 1;
    }
    out += BLOCK.has(name) ? '\n' : ' ';
  }
  return out
    .replace(/&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z]{2,6});/g, entity)
    .split('\n')
    .map((line) => line.replace(/[\s\u00a0]+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
}
