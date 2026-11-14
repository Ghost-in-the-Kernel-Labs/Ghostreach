/**
 * `ghostreach serve` (TODO 3.2): the salesperson's local page, the reviews already in the data folder, each linking its PDF, served
 * by Node's `http` (P-04, no framework) on 127.0.0.1 alone and opened in the browser. The PDF is the one artefact (TODO 2.5): the
 * page names and links a review's PDF only, never AUDIT.html, a JSON file or the crawl, and the server answers for nothing else
 * of the folder. Every name it shows comes from the data folder or the salesperson's paste and is written as text, never as
 * markup (P-16). Every form posts (`POSTS`) from this page's own origin alone. The queue (3.3, `queue.ts`): the sites to `/queue`, a
 * failed one's retry to `/queue/retry`; while a site waits or runs, the page reloads itself (a meta refresh; no script runs in it).
 * The keys (4.4, `keys.ts`): "key present" or "key absent", never a key. The company lane (4.6, `company.ts`): a company to `/company`,
 * each board's QA roles as text, a kept address as a link, no board offering the paste lane (4.9). The discovery lane (4.7,
 * `discover.ts`): the saved search edited at `/discover/search`, run at `/discover/run`, the last run's rows one per company and
 * each skipped source named. The ranking (3.6) comes later.
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, relative, isAbsolute, sep } from 'node:path';
import { addSites, queueRunner, readQueue, recover, retry, reviewLine, type Added, type QueueEntry, type QueueRunner, type ReviewRun } from './queue.js';
import { pdfName } from './review.js';
import { sharedBrowser } from './crawl.js';
import { readSettings, type Settings } from './settings.js';
import { keyStates } from './keys.js';
import { keepLookup, lookUpCompany, readLookups, type CompanyLookup } from './company.js';
import type { Transport } from './fetch.js';
import { discover, keepRun, parseSearch, readDiscovery, saveSearch, type DiscoveryRow, type DiscoveryRun, type SavedSearch } from './discover.js';

/** The one address the page is served on: the loopback, so no other machine on the network can read a review. */
export const LOOPBACK = '127.0.0.1';

/** A review on the page: the site, the day, and the path its PDF is served at. */
export interface ListedReview {
  host: string;
  date: string;
  /** The review's folder under the data folder, as written by `reviewFolder` (`<host>-<date>`, `-2`, ...). */
  folder: string;
  /** The page's link to the PDF: `/reviews/<folder>/<host> site review.pdf`, each part percent-encoded. */
  href: string;
}

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

/** Text written into the page as text: every character markup could read escaped (P-16). */
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** What a paste did, said back above the queue: how many were queued, and each refused line with why. */
function addedNotice(added: Added | undefined): string {
  if (!added) return '';
  const queued = `<p class="said">${added.queued.length} site${added.queued.length === 1 ? '' : 's'} queued.</p>`;
  const refused = added.refused.map((r) => `<li class="refused">Refused: ${esc(r.line)} (${esc(r.why)})</li>`).join('\n');
  return `${queued}${refused ? `\n<ul>\n${refused}\n</ul>` : ''}`;
}

/** The queue in pasted order, each site with its state; a failed one with its error line and a retry button. */
function queueList(sites: readonly QueueEntry[]): string {
  if (!sites.length) return '<p>No site queued.</p>';
  const rows = sites.map((e) => {
    const failed = e.state === 'failed'
      ? ` <span class="error">${esc(e.error ?? '')}</span> <form method="post" action="/queue/retry"><input type="hidden" name="id" value="${e.id}"><button>Retry</button></form>`
      : '';
    return `<li>${esc(e.site)} <span class="state">${e.state}</span>${failed}</li>`;
  });
  return `<ol>\n${rows.join('\n')}\n</ol>`;
}

/**
 * The lead finder's keyed sources (TODO 4.4), each "key present" or "key absent": whether its variables are set, asked at each
 * request, never a key's value, which the page never reads.
 */
function keysList(): string {
  const rows = keyStates().map((k) => k.present
    ? `<li>${esc(k.source)} <span class="state">key present</span></li>`
    : `<li>${esc(k.source)} <span class="state">key absent</span> <span class="error">skipped until ${esc(k.variables.join(' and '))} ${k.variables.length === 1 ? 'is' : 'are'} set</span></li>`);
  return `<ul>\n${rows.join('\n')}\n</ul>`;
}

/** What the page says when no board is found: the paste lane is the way left (4.9 builds it). */
export const NO_BOARD = 'No public board found.';
export const PASTE_LANE = 'Seen its posting on LinkedIn, Indeed, Glassdoor or ZipRecruiter? Keep that posting with the paste lane, which comes in a later version.';

/** One board found: the source, the name it answered under, its open roles, and each QA role, a link when its address was kept. */
function boardItem(board: CompanyLookup['boards'][number]): string {
  const head = `${esc(board.source)} board "${esc(board.slug)}": ${esc(String(board.open))} open role${board.open === 1 ? '' : 's'}, ${board.roles.length} QA, test or SDET`;
  if (!board.roles.length) return `<li>${head}.</li>`;
  const roles = board.roles.map((r) => `<li>${r.url ? `<a href="${esc(r.url)}" rel="noreferrer">${esc(r.title)}</a>` : esc(r.title)}</li>`).join('\n');
  return `<li>${head}:\n<ul class="roles">\n${roles}\n</ul></li>`;
}

/** The lookups kept, newest first: each company's boards, or no board and the paste lane; each source that could not be asked. */
function lookupsList(lookups: readonly CompanyLookup[]): string {
  if (!lookups.length) return '<p>No company looked up yet.</p>';
  const rows = lookups.map((l) => {
    const found = l.boards.length ? `<ul>\n${l.boards.map(boardItem).join('\n')}\n</ul>` : `<p>${NO_BOARD} ${PASTE_LANE}</p>`;
    const unanswered = l.unanswered.map((why) => `<p class="error">Not asked: ${esc(why)}</p>`).join('\n');
    return `<li><strong>${esc(l.asked)}</strong> <span class="day">${esc(l.at.slice(0, 10))}</span>\n${found}${unanswered ? `\n${unanswered}` : ''}</li>`;
  });
  return `<ul>\n${rows.join('\n')}\n</ul>`;
}

/** One company found: its newest QA posting (a link when its address was kept), the source and day, and how many more. */
function discoveryItem(row: DiscoveryRow): string {
  const title = row.url ? `<a href="${esc(row.url)}" rel="noreferrer">${esc(row.title)}</a>` : esc(row.title);
  const more = row.others ? `, and ${row.others} more posting${row.others === 1 ? '' : 's'}` : '';
  return `<li><strong>${esc(row.company)}</strong>: ${title} <span class="day">${esc(row.source)}, ${esc(row.at.slice(0, 10) || 'no date')}${more}</span> <span class="state">no website given</span></li>`;
}

/** The discovery lane: the saved search's form, the run button, and the last run's rows and skipped sources. */
function discoverySection(search: SavedSearch, run: DiscoveryRun | undefined, refused: string | undefined): string {
  const form = `<form method="post" action="/discover/search">
<p><label for="titles">Titles, one per line:</label></p><textarea id="titles" name="titles" rows="5">${esc(search.titles.join('\n'))}</textarea>
<p><label for="location">A location, or remote:</label> <input id="location" name="location" type="text" maxlength="100" value="${esc(search.location)}"> <button>Save the search</button></p>
</form>
<form method="post" action="/discover/run"><p><button>Run the search</button></p></form>
${refused ? `<p class="refused">${esc(refused)}</p>\n` : ''}`;
  if (!run) return `${form}<p>The search has not run yet.</p>`;
  const head = `<p>Last run ${esc(run.at.slice(0, 10))} (${esc(run.search.titles.join(', '))}; ${esc(run.search.location)}): ${run.rows.length} compan${run.rows.length === 1 ? 'y' : 'ies'}.</p>`;
  const rows = run.rows.length ? `\n<ul>\n${run.rows.map(discoveryItem).join('\n')}\n</ul>` : '';
  return `${form}${head}${rows}${run.skipped.map((why) => `\n<p class="error">Skipped: ${esc(why)}</p>`).join('')}`;
}

/** The page: the form and the queue, then the reviews in the data folder, each a link to its PDF, then the company and discovery lanes, then the lead sources' keys. The salesperson's own screen, not the prospect's (REV-04). */
function reviewsPage(reviews: readonly ListedReview[], sites: readonly QueueEntry[], settings: Settings, lookups: readonly CompanyLookup[], discovery: ReturnType<typeof readDiscovery>, said?: Said): string {
  const added = said?.added;
  const rows = reviews.map((r) => `<li><a href="${esc(r.href)}">${esc(r.host)}</a> <span class="day">${esc(r.date)}</span></li>`).join('\n');
  const body = reviews.length ? `<ul>\n${rows}\n</ul>` : '<p>No review yet. Queue a site above and its PDF appears here.</p>';
  // No script (the policy allows none): the page asks for itself again while anything is still to come.
  const busy = sites.some((e) => e.state === 'waiting' || e.state === 'running');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${busy ? '<meta http-equiv="refresh" content="5; url=/">\n' : ''}<title>Ghostreach: the reviews</title>
<style>
body { font: 16px/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 40rem; padding: 0 1rem; color: #1b1b1b; background: #fafaf7; }
ul { list-style: none; padding: 0; }
li { padding: 0.5rem 0; border-bottom: 1px solid #ddd; }
.day, .state { color: #666; margin-left: 0.5rem; }
.error, .refused { color: #a12; }
textarea { width: 100%; font: inherit; }
li form { display: inline; }
ul.roles { padding-left: 1.5rem; list-style: disc; }
ul.roles li { border: none; padding: 0.1rem 0; }
</style>
</head>
<body>
<h1>The reviews</h1>
<h2>Sites to review</h2>
<form method="post" action="/queue">
<p><label for="sites">One site per line:</label></p>
<textarea id="sites" name="sites" rows="6" placeholder="www.example.com"></textarea>
<p><button>Queue</button></p>
</form>
<p>Up to ${settings.reviewsAtOnce} site${settings.reviewsAtOnce === 1 ? ' is' : 's are'} reviewed at once.</p>
${settings.note ? `<p class="error">${esc(settings.note)}</p>\n` : ''}${addedNotice(added)}
${queueList(sites)}
<p><a href="/">Reload</a></p>
<h2>Done</h2>
<p>Each site reviewed, newest first. Open a review to read or send its PDF.</p>
${body}
<h2>Is this company hiring QA?</h2>
<form method="post" action="/company">
<p><label for="company">A company's name or its site:</label></p>
<p><input id="company" name="company" type="text" maxlength="200" placeholder="Acme Robotics, or acme.com"> <button>Look up</button></p>
</form>
${said?.refused ? `<p class="refused">${esc(said.refused)}</p>\n` : ''}${lookupsList(lookups)}
<h2>Who is hiring QA?</h2>
<p>A saved search, run on request across every job board below whose key is set, within each board's own limits. One row per company.</p>
${discoverySection(discovery.search, discovery.run, said?.searchRefused)}
<h2>Lead sources</h2>
<p>Each source that needs a key, and whether its key is set.</p>
${keysList()}
</body>
</html>
`;
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

/** What a post did, said back on the page: the paste's queued and refused lines, a company lookup refused, or a search refused. */
interface Said {
  added?: Added;
  refused?: string;
  searchRefused?: string;
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
