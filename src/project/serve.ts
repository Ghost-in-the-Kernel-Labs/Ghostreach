/**
 * `ghostreach serve` (TODO 3.2): the salesperson's local page, the reviews already in the data folder, each linking its PDF, served
 * by Node's `http` (P-04, no framework) on 127.0.0.1 alone and opened in the browser. The PDF is the one artefact (TODO 2.5): the
 * page names and links a review's PDF only, never AUDIT.html, a JSON file or the crawl, and the server answers for nothing else
 * of the folder. Every name it shows comes from the data folder or the salesperson's paste and is written as text, never as
 * markup (P-16). Every form posts (`POSTS`) from this page's own origin alone. The queue (3.3, `queue.ts`): the sites to `/queue`, a
 * failed one's retry to `/queue/retry`; while a site waits or runs, the page reloads itself (a meta refresh; no script runs in it).
 * The company lane (4.6, `company.ts`): a company to `/company`. The discovery lane (4.7, `discover.ts`): the saved search edited
 * at `/discover/search`, run at `/discover/run`; one lookup and one run at a time. The page's HTML is `page.ts` and `page-leads.ts`.
 * A data file that cannot be read is said on the page in one line and left as it is (`kept.ts`); no request stops the server
 * (J-045). The ranking (3.6) comes later.
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pipeline } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { join, relative, isAbsolute, sep } from 'node:path';
import { addSites, queueRunner, readQueue, recover, retry, reviewLine, type QueueRunner, type ReviewRun } from './queue.js';
import { pdfName } from './review.js';
import { sharedBrowser } from './crawl.js';
import { readSettings, type Settings } from './settings.js';
import { keepLookup, lookUpCompany, readLookups } from './company.js';
import type { Transport } from './fetch.js';
import { discover, keepRun, parseSearch, readDiscovery, saveSearch } from './discover.js';
import { reviewsPage, type ListedReview, type Said } from './page.js';
import { keepPosting, keepWebsite, leadOf, readNotes } from './leads.js';
import { Unreadable } from './kept.js';

/** The one address the page is served on: the loopback, so no other machine on the network can read a review. */
export const LOOPBACK = '127.0.0.1';

/** A review folder's name read back: `<host>-<YYYY-MM-DD>`, then `-2`, `-3` for a second review that day (`reviewFolder`). */
const FOLDER = /^(.+)-(\d{4}-\d{2}-\d{2})(?:-([2-9]|[1-9]\d+))?$/;

/** A folder name that is one name and nothing else: no separator, no `.` or `..`, no NUL. */
const oneName = (name: string): boolean => name !== '.' && name !== '..' && !/[/\\\0]/.test(name);

/** The reviews in the data folder that have a PDF, newest day first, then by site and by the day's count; a refused review (no PDF) is not listed. */
export function listReviews(data: string): ListedReview[] {
  if (!existsSync(data)) return [];
  const listed: (ListedReview & { n: number })[] = [];
  for (const entry of readdirSync(data, { withFileTypes: true })) {
    const match = FOLDER.exec(entry.name);
    if (!entry.isDirectory() || !match || !oneName(entry.name)) continue;
    const [, host, date, n] = match;
    if (!pdfIn(data, entry.name, pdfName(host))) continue;
    listed.push({ host, date, folder: entry.name, href: `/reviews/${encodeURIComponent(entry.name)}/${encodeURIComponent(pdfName(host))}`, n: Number(n ?? 1) });
  }
  listed.sort((a, b) => b.date.localeCompare(a.date) || a.host.localeCompare(b.host) || b.n - a.n);
  return listed.map(({ n: _, ...review }) => review);
}

/**
 * The PDF's path on disk when `folder` is a review folder directly under the data folder and `file` is that review's PDF, a
 * regular file whose real path is still inside the data folder (a link out of it is refused); null for anything else.
 */
function pdfIn(data: string, folder: string, file: string): string | null {
  const match = FOLDER.exec(folder);
  if (!match || !oneName(folder) || !oneName(file) || file !== pdfName(match[1])) return null;
  const path = join(data, folder, file);
  try {
    if (!lstatSync(path).isFile()) return null;
    const inside = relative(realpathSync(data), realpathSync(path));
    return inside && !inside.startsWith(`..${sep}`) && inside !== '..' && !isAbsolute(inside) ? path : null;
  } catch {
    return null;
  }
}

/**
 * The headers every answer carries: nothing runs in the page, nothing is sniffed, no other origin may read it (no CORS header, ever).
 * No referrer leaves for another origin; `same-origin`, not `no-referrer`, since under `no-referrer` the browser posts the page's
 * own forms with `Origin: null` and `post` refuses them.
 */
const HEADERS = {
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Cache-Control': 'no-store',
};

function answer(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`${text}\n`);
}

/** The page as HTML. A data file that cannot be read shows as empty, and the page says so in one line naming it. */
function sendPage(data: string, settings: Settings, req: IncomingMessage, res: ServerResponse, said?: Said): void {
  const unreadable: string[] = [];
  const read = <T>(get: (data: string) => T, none: T): T => {
    try {
      return get(data);
    } catch (e) {
      if (!(e instanceof Unreadable)) throw e;
      unreadable.push(e.file);
      return none;
    }
  };
  const view = {
    reviews: listReviews(data), sites: read(readQueue, []), settings, lookups: read(readLookups, []),
    discovery: read(readDiscovery, { search: { titles: [], location: '' } }), notes: read(readNotes, {}), unreadable,
  };
  res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.method === 'HEAD' ? undefined : reviewsPage(view, said));
}

/**
 * Runs one request's work so that nothing it throws stops the server: a data file that cannot be read answers the page, which
 * says so (nothing was written); anything else answers `line` (500), or ends an answer already begun.
 */
function guarded(data: string, settings: Settings, req: IncomingMessage, res: ServerResponse, line: string, work: () => void): void {
  try {
    work();
  } catch (e) {
    failed(data, settings, req, res, line, e);
  }
}

function failed(data: string, settings: Settings, req: IncomingMessage, res: ServerResponse, line: string, e: unknown): void {
  if (res.headersSent) return void res.destroy();
  if (e instanceof Unreadable) return guarded(data, settings, req, res, line, () => sendPage(data, settings, req, res));
  answer(res, 500, line);
}

/** The most a form's body may hold: thousands of sites, and no more read into memory. */
const MAX_BODY = 64 * 1024;

/** The POST routes. */
const POSTS = new Set(['/queue', '/queue/retry', '/queue/lead', '/company', '/company/site', '/company/posting', '/discover/search', '/discover/run']);

/** What the page's routes are given beyond the data folder: the settings, the queue's runner, and the lead finder's network and keys (a test's). */
interface Served {
  settings: Settings;
  runner: QueueRunner;
  /** The lead finder's routes running now (`/company`, `/discover/run`): one of each at a time, for the sources' caps and the keys. */
  running: Set<string>;
  transport?: Transport;
  env?: Readonly<Record<string, string | undefined>>;
}

/**
 * A form posted to the queue: from this page alone. A browser sends `Origin` with every POST, so one that does not equal this
 * server's own origin, or is missing, is another site's page (or no browser) posting into the salesperson's queue: refused.
 */
function post(data: string, served: Served, origin: string, path: string, req: IncomingMessage, res: ServerResponse): void {
  const { settings, runner } = served;
  if (req.headers.origin !== origin) return answer(res, 403, 'Only from this page.');
  if ((req.headers['content-type'] ?? '').split(';')[0].trim() !== 'application/x-www-form-urlencoded') return answer(res, 415, 'Only a form.');
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    // Past the limit the rest is read and dropped, so the answer reaches the browser; nothing more is kept.
    if (size <= MAX_BODY) chunks.push(chunk);
  });
  req.on('end', () => guarded(data, settings, req, res, 'Not done: the program met an error.', () => {
    if (size > MAX_BODY) return answer(res, 413, 'Too long.');
    const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    if (path === '/queue') {
      const added = addSites(data, form.get('sites') ?? '');
      runner.kick();
      return sendPage(data, settings, req, res, { added });
    }
    if (path === '/company') {
      // One lookup at a time: a second while one runs is said back, never a second batch of calls to the sources.
      if (served.running.has(path)) return sendPage(data, settings, req, res, { refused: 'A company lookup is already running; this one was not started.' });
      served.running.add(path);
      // Every source is asked before the page answers: the salesperson waits on it, at most a probe's timeout per name and instance.
      void lookUpCompany(form.get('company') ?? '', { data, transport: served.transport }).finally(() => served.running.delete(path)).then(
        (lookup) => {
          if (lookup.refused) return sendPage(data, settings, req, res, { refused: lookup.refused });
          keepLookup(data, lookup);
          sendPage(data, settings, req, res);
        },
      ).catch((e: unknown) => failed(data, settings, req, res, 'The lookup could not be kept.', e));
      return;
    }
    if (path === '/queue/lead') {
      // "Queue this site" (4.10): the row's website and reason read from the data folder, the form naming only the company and its lane.
      const company = form.get('company') ?? '';
      const lead = leadOf(data, company, form.get('lane') === 'company' ? 'company' : 'discovery');
      if (!lead) return sendPage(data, settings, req, res, { row: { company, why: 'No website kept for this company.' } });
      const added = addSites(data, lead.website, lead.reason);
      runner.kick();
      return sendPage(data, settings, req, res, { added });
    }
    if (path === '/company/site' || path === '/company/posting') {
      // The salesperson's typed website (4.8), held to a site's test, or a closed site's posting (4.9): kept, never fetched.
      const company = form.get('company') ?? '';
      const why = path === '/company/site' ? keepWebsite(data, company, form.get('site') ?? '') : keepPosting(data, company, form.get('posting') ?? '');
      return sendPage(data, settings, req, res, why ? { row: { company, why } } : undefined);
    }
    if (path === '/discover/search') {
      const parsed = parseSearch(form.get('titles') ?? '', form.get('location') ?? '');
      if ('refused' in parsed) return sendPage(data, settings, req, res, { searchRefused: parsed.refused });
      saveSearch(data, parsed.search);
      return sendPage(data, settings, req, res);
    }
    if (path === '/discover/run') {
      // One run at a time, as one lookup; every source is asked before the page answers; a source over its cap, without its key
      // or failing is named, never waited on.
      if (served.running.has(path)) return sendPage(data, settings, req, res, { searchRefused: 'The search is already running; this run was not started.' });
      const search = readDiscovery(data).search;
      served.running.add(path);
      void discover(search, { data, transport: served.transport, env: served.env }).finally(() => served.running.delete(path)).then((run) => {
        keepRun(data, run);
        sendPage(data, settings, req, res);
      }).catch((e: unknown) => failed(data, settings, req, res, 'The search could not be run.', e));
      return;
    }
    if (retry(data, Number(form.get('id')))) runner.kick();
    res.writeHead(303, { ...HEADERS, Location: '/' });
    res.end();
  }));
}

/** One request: the page at `/`, a review's PDF at `/reviews/<folder>/<pdf>`, the forms' posts, and nothing else. */
function handle(data: string, served: Served, port: () => number, req: IncomingMessage, res: ServerResponse): void {
  const { settings } = served;
  // A page another site's script reaches through a name it points at 127.0.0.1 (DNS rebinding) carries that name: refused.
  const host = req.headers.host ?? '';
  if (host !== `${LOOPBACK}:${port()}` && host !== `localhost:${port()}`) return answer(res, 421, 'Not this address.');
  const path = (req.url ?? '/').split('?')[0];
  if (req.method === 'POST' && POSTS.has(path)) return post(data, served, `http://${host}`, path, req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', POSTS.has(path) ? 'POST' : 'GET, HEAD');
    return answer(res, 405, POSTS.has(path) ? 'Only POST.' : 'Only GET.');
  }
  if (path === '/') return sendPage(data, settings, req, res);
  const parts = path.split('/');
  let names: string[] = [];
  try {
    names = parts.length === 4 && parts[0] === '' && parts[1] === 'reviews' ? [decodeURIComponent(parts[2]), decodeURIComponent(parts[3])] : [];
  } catch {
    names = [];
  }
  const pdf = names.length === 2 ? pdfIn(data, names[0], names[1]) : null;
  if (!pdf) return answer(res, 404, 'Not found.');
  res.writeHead(200, {
    ...HEADERS,
    'Content-Type': 'application/pdf',
    'Content-Length': String(lstatSync(pdf).size),
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(names[1])}`,
  });
  if (req.method === 'HEAD') return void res.end();
  // A read that fails after the headers (a disk error, the file gone since the check) ends this answer, never the server.
  pipeline(createReadStream(pdf), res, (error) => {
    if (error) res.destroy();
  });
}

/** The page being served: its address, and how to stop it. */
export interface ServedPage {
  url: string;
  /** The settings file as read at start: the reviews run at once, and its line when it asked for something else. */
  settings: Settings;
  close: () => Promise<void>;
  /** Settles when the server stops. */
  closed: Promise<void>;
}

/**
 * Serves the data folder's reviews and queue on 127.0.0.1 alone, on a free port the system picks. `run` reviews a queued site
 * (a test hands its own; else the command's own review, each in a context of the queue's one Chromium, closed when the page
 * stops); up to the settings file's number at once (GR-008). At start, an entry left `running` by a stop mid-review goes back to
 * `waiting` (`recover`) and the runner takes up what waits. `transport` is the lead finder's network and `env` where its keys are
 * read: a test's, else the platform's and the process's.
 */
export async function servePage(data: string, run?: ReviewRun, transport?: Transport, env?: Readonly<Record<string, string | undefined>>): Promise<ServedPage> {
  recover(data);
  // The settings file, read once at start (GR-008): how many reviews run at once, all of them in one Chromium (RF-09).
  const settings = readSettings(data);
  const shared = run ? null : sharedBrowser();
  const runner = queueRunner(data, run ?? reviewLine(data, shared?.get), settings.reviewsAtOnce);
  let bound = 0;
  const served: Served = { settings, runner, running: new Set(), transport, env };
  const server = createServer((req, res) => guarded(data, settings, req, res, 'The page could not be shown.', () => handle(data, served, () => bound, req, res)));
  const closed = new Promise<void>((done) => server.once('close', () => done()));
  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(0, LOOPBACK, () => done());
  });
  bound = (server.address() as AddressInfo).port;
  runner.kick();
  return {
    url: `http://${LOOPBACK}:${bound}/`,
    settings,
    close: () => new Promise<void>((done) => {
      server.close(() => {
        if (shared) void shared.close().finally(done);
        else done();
      });
      server.closeAllConnections();
    }),
    closed,
  };
}

/** The platform's own opener for a web address, as a program and a fixed argument list: no shell reads the address. */
export function opener(platform: NodeJS.Platform, url: string): { command: string; args: string[] } {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'win32') return { command: 'explorer.exe', args: [url] };
  return { command: 'xdg-open', args: [url] };
}

/** Opens the page in the salesperson's browser; when no opener answers, the address printed beside it is the way in. */
export function openInBrowser(url: string): void {
  const { command, args } = opener(process.platform, url);
  const child = spawn(command, args, { shell: false, stdio: 'ignore', detached: true });
  child.on('error', () => {});
  child.unref();
}
