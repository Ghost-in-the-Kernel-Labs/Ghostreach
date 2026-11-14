/**
 * `ghostreach serve` (TODO 3.2): the salesperson's local page, the reviews already in the data folder, each linking its PDF, served
 * by Node's `http` (P-04, no framework) on 127.0.0.1 alone and opened in the browser. The PDF is the one artefact (TODO 2.5): the
 * page names and links a review's PDF only, never AUDIT.html, a JSON file or the crawl, and the server answers for nothing else
 * of the folder. Every name it shows comes from the data folder and is written as text, never as markup (P-16). The queue (3.3),
 * the ranking (3.6) and the rest of the page come later.
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, relative, isAbsolute, sep } from 'node:path';
import { pdfName } from './review.js';

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

/** The page: the reviews in the data folder, each a link to its PDF. The salesperson's own screen, not the prospect's (REV-04). */
function reviewsPage(reviews: readonly ListedReview[]): string {
  const rows = reviews.map((r) => `<li><a href="${esc(r.href)}">${esc(r.host)}</a> <span class="day">${esc(r.date)}</span></li>`).join('\n');
  const body = reviews.length ? `<ul>\n${rows}\n</ul>` : '<p>No review yet. Run <code>ghostreach &lt;site&gt;</code> and its PDF appears here.</p>';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ghostreach: the reviews</title>
<style>
body { font: 16px/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 40rem; padding: 0 1rem; color: #1b1b1b; background: #fafaf7; }
ul { list-style: none; padding: 0; }
li { padding: 0.5rem 0; border-bottom: 1px solid #ddd; }
.day { color: #666; margin-left: 0.5rem; }
</style>
</head>
<body>
<h1>The reviews</h1>
<p>Each site reviewed, newest first. Open a review to read or send its PDF.</p>
${body}
</body>
</html>
`;
}

/** The headers every answer carries: nothing runs in the page, nothing is sniffed, no other origin may read it (no CORS header, ever). */
const HEADERS = {
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

function answer(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`${text}\n`);
}

/** One request: the page at `/`, a review's PDF at `/reviews/<folder>/<pdf>`, and nothing else; GET and HEAD only. */
function handle(data: string, port: () => number, req: IncomingMessage, res: ServerResponse): void {
  // A page another site's script reaches through a name it points at 127.0.0.1 (DNS rebinding) carries that name: refused.
  const host = req.headers.host ?? '';
  if (host !== `${LOOPBACK}:${port()}` && host !== `localhost:${port()}`) return answer(res, 421, 'Not this address.');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return answer(res, 405, 'Only GET.');
  }
  const path = (req.url ?? '/').split('?')[0];
  if (path === '/') {
    res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : reviewsPage(listReviews(data)));
    return;
  }
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
  close: () => Promise<void>;
  /** Settles when the server stops. */
  closed: Promise<void>;
}

/** Serves the data folder's reviews on 127.0.0.1 alone, on a free port the system picks (`port` 0) unless one is named. */
export async function servePage(data: string, port = 0): Promise<ServedPage> {
  let bound = 0;
  const server = createServer((req, res) => handle(data, () => bound, req, res));
  const closed = new Promise<void>((done) => server.once('close', () => done()));
  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(port, LOOPBACK, () => done());
  });
  bound = (server.address() as AddressInfo).port;
  return {
    url: `http://${LOOPBACK}:${bound}/`,
    close: () => new Promise<void>((done) => {
      server.close(() => done());
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
