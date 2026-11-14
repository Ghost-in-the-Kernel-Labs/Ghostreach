/**
 * `ghostreach serve` (TODO 3.2): the salesperson's local page, the reviews already in the data folder, each linking its PDF, served
 * by Node's `http` (P-04, no framework) on 127.0.0.1 alone and opened in the browser. The PDF is the one artefact (TODO 2.5): the
 * page names and links a review's PDF only, never AUDIT.html, a JSON file or the crawl, and the server answers for nothing else
 * of the folder. Every name it shows comes from the data folder or the salesperson's paste and is written as text, never as
 * markup (P-16). Every form posts (`POSTS`) from this page's own origin alone. The queue (3.3, `queue.ts`): the sites to `/queue`, a
 * failed one's retry to `/queue/retry`; while a site waits or runs, the page reloads itself (a meta refresh; no script runs in it).
 * The company lane (4.6, `company.ts`): a company to `/company`. The discovery lane (4.7, `discover.ts`): the saved search edited
 * at `/discover/search`, run at `/discover/run`. The page's HTML is `page.ts` and `page-leads.ts`. The ranking (3.6) comes later.
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
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

/** The headers every answer carries: nothing runs in the page, nothing is sniffed, no other origin may read it (no CORS header, ever). */
const HEADERS = {
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

function answer(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`${text}\n`);
}

/** The page as HTML. */
function sendPage(data: string, settings: Settings, req: IncomingMessage, res: ServerResponse, said?: Said): void {
  res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.method === 'HEAD' ? undefined : reviewsPage(listReviews(data), readQueue(data), settings, readLookups(data), readDiscovery(data), said));
}

/** The most a form's body may hold: thousands of sites, and no more read into memory. */
const MAX_BODY = 64 * 1024;

/** The five POST routes. */
const POSTS = new Set(['/queue', '/queue/retry', '/company', '/discover/search', '/discover/run']);

/** What the page's routes are given beyond the data folder: the settings, the queue's runner, and the lead finder's network and keys (a test's). */
interface Served {
  settings: Settings;
  runner: QueueRunner;
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
  req.on('end', () => {
    if (size > MAX_BODY) return answer(res, 413, 'Too long.');
    const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    if (path === '/queue') {
      const added = addSites(data, form.get('sites') ?? '');
      runner.kick();
      return sendPage(data, settings, req, res, { added });
    }
    if (path === '/company') {
      // Every source is asked before the page answers: the salesperson waits on it, at most a probe's timeout per name and instance.
      void lookUpCompany(form.get('company') ?? '', { data, transport: served.transport }).then(
        (lookup) => {
          if (lookup.refused) return sendPage(data, settings, req, res, { refused: lookup.refused });
          keepLookup(data, lookup);
          sendPage(data, settings, req, res);
        },
      ).catch(() => answer(res, 500, 'The lookup could not be kept.'));
      return;
    }
    if (path === '/discover/search') {
      const parsed = parseSearch(form.get('titles') ?? '', form.get('location') ?? '');
      if ('refused' in parsed) return sendPage(data, settings, req, res, { searchRefused: parsed.refused });
      saveSearch(data, parsed.search);
      return sendPage(data, settings, req, res);
    }
    if (path === '/discover/run') {
      // Every source is asked before the page answers; a source over its cap, without its key or failing is named, never waited on.
      void discover(readDiscovery(data).search, { data, transport: served.transport, env: served.env }).then((run) => {
        keepRun(data, run);
        sendPage(data, settings, req, res);
      }).catch(() => answer(res, 500, 'The search could not be run.'));
      return;
    }
    if (retry(data, Number(form.get('id')))) runner.kick();
    res.writeHead(303, { ...HEADERS, Location: '/' });
    res.end();
  });
}

/** One request: the page at `/`, a review's PDF at `/reviews/<folder>/<pdf>`, the five forms' posts, and nothing else. */
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
  createReadStream(pdf).pipe(res);
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
  const server = createServer((req, res) => handle(data, { settings, runner, transport, env }, () => bound, req, res));
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
