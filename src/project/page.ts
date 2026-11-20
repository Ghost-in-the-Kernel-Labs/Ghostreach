/**
 * The local page's HTML (TODO 3.2, split out of `serve.ts`): the queue's form and list (3.3), the reviews done, each linking its
 * PDF, the lead finder's sections (`page-leads.ts`), and the lead sources' keys (4.4). Every name it shows comes from the data
 * folder, the salesperson's paste or a source's answer and is written as text, never as markup (P-16); no script runs in it.
 */
import type { Added, QueueEntry } from './queue.js';
import type { Settings } from './settings.js';
import { keyStates } from './keys.js';
import type { CompanyLookup } from './company.js';
import type { readDiscovery } from './discover.js';
import { discoverySection, lookupsList, type Rows } from './page-leads.js';
import type { CompanyNotes } from './leads.js';
import { esc, plainError } from './html.js';
import { unreadableLine } from './kept.js';

/** The page's title, as served: `runningPage` (serve.ts) knows a running page by it. */
export const PAGE_TITLE = '<title>Ghostreach: the reviews</title>';

/** A review on the page: the site, the day, and the path its PDF is served at. */
export interface ListedReview {
  host: string;
  date: string;
  /** The review's folder under the data folder, as written by `reviewFolder` (`<host>-<date>`, `-2`, ...). */
  folder: string;
  /** The page's link to the PDF: `/reviews/<folder>/<host> site review.pdf`, each part percent-encoded. */
  href: string;
  /** Its findings counted, read from its `summary.json`; absent when that file cannot be read. */
  counts?: { findings: number; major: number; minor: number };
}

/** What the page shows, read from the data folder at each request. */
export interface View {
  reviews: readonly ListedReview[];
  sites: readonly QueueEntry[];
  settings: Settings;
  lookups: readonly CompanyLookup[];
  discovery: ReturnType<typeof readDiscovery>;
  /** What the salesperson kept per company (`leads.ts`). */
  notes: Readonly<Record<string, CompanyNotes>>;
  /** The data files that could not be read (`kept.ts`), each said in one line; absent, none. */
  unreadable?: readonly string[];
  /** Each running entry's latest plain progress line, by its id (`QueueRunner.progress`). */
  progress?: ReadonlyMap<number, string>;
}

/** What a post did, said back on the page: the paste's queued and refused lines, a company lookup refused, or a search refused. */
export interface Said {
  added?: Added;
  refused?: string;
  searchRefused?: string;
  /** A post on one company row refused (4.8): said under that row. */
  row?: Rows['refused'];
  /** The answer to a lead finder's form: its folded part shown open, where the salesperson was. */
  leads?: boolean;
}

/** A review's PDF to open (its counts beside it, from summary.json) and to download: no script, the `download` attribute. */
function pdfLinks(review: ListedReview): string {
  const c = review.counts;
  const counts = c ? ` · ${esc(c.findings)} finding${c.findings === 1 ? '' : 's'} (${esc(c.major)} major, ${esc(c.minor)} minor)` : '';
  return `<a href="${esc(review.href)}">Open PDF</a>${counts} · <a href="${esc(review.href)}" download>Download PDF</a>`;
}

/** What a paste did, said back above the queue: how many were queued, and each refused line with why. */
function addedNotice(added: Added | undefined): string {
  if (!added) return '';
  const queued = `<p class="said">${esc(added.queued.length)} site${added.queued.length === 1 ? '' : 's'} queued.</p>`;
  const refused = added.refused.map((r) => `<li class="refused">Refused: ${esc(r.line)} (${esc(r.why)})</li>`).join('\n');
  return `${queued}${refused ? `\n<ul>\n${refused}\n</ul>` : ''}`;
}

/**
 * The queue in pasted order, each site with its state and, from the lead finder, its reason (4.10); a running one with its latest
 * plain progress line, a done one with its newest review's PDF, a failed one with its error line, plainly, and a retry button.
 */
function queueList(sites: readonly QueueEntry[], reviews: readonly ListedReview[], progress?: ReadonlyMap<number, string>): string {
  if (!sites.length) return '<p>No site queued.</p>';
  const rows = sites.map((e) => {
    const failed = e.state === 'failed'
      ? ` <span class="error">${esc(plainError(e.error ?? ''))}</span> <form method="post" action="/queue/retry"><input type="hidden" name="id" value="${esc(e.id)}"><button>Retry</button></form>`
      : '';
    const step = e.state === 'running' && progress?.get(e.id);
    const doing = step ? ` <span class="day">${esc(step)}</span>` : '';
    const review = e.state === 'done' ? reviews.find((r) => r.host === e.host) : undefined;
    const done = review ? ` ${pdfLinks(review)}` : '';
    const reason = e.reason ? ` <span class="day">from ${esc(e.reason.source)}${e.reason.url ? `: <a href="${esc(e.reason.url)}" rel="noopener noreferrer">posting</a>` : ''}</span>` : '';
    return `<li>${esc(e.site)} <span class="state">${esc(e.state)}</span>${doing}${done}${reason}${failed}</li>`;
  });
  return `<ol>\n${rows.join('\n')}\n</ol>`;
}

/**
 * The lead finder's keyed sources (TODO 4.4), each "key present" or "needs a key from Ghost" (no variable named, launch fixes 5): whether its variables are set, asked at each
 * request, never a key's value, which the page never reads.
 */
function keysList(): string {
  const rows = keyStates().map((k) => k.present
    ? `<li>${esc(k.source)} <span class="state">key present</span></li>`
    : `<li>${esc(k.source)} <span class="state">needs a key from Ghost</span></li>`);
  return `<ul>\n${rows.join('\n')}\n</ul>`;
}

/**
 * The page: the form and the queue, then the reviews in the data folder, each its PDF to open or download, then, folded under one
 * closed <details> (launch fixes 5), the company and discovery lanes and the lead sources' keys, shown open only in the answer to
 * one of their own forms. The salesperson's own screen, not the prospect's (REV-04).
 */
export function reviewsPage(view: View, said?: Said): string {
  const { reviews, sites, settings, lookups, discovery } = view;
  const companies: Rows = { notes: view.notes, refused: said?.row, reviews, sites };
  const added = said?.added;
  const rows = reviews.map((r) => `<li>${esc(r.host)} <span class="day">${esc(r.date)}</span> ${pdfLinks(r)}</li>`).join('\n');
  const body = reviews.length ? `<ul>\n${rows}\n</ul>` : '<p>No review yet. Name a site above and its PDF appears here.</p>';
  // No script (the policy allows none): the page asks for itself again while anything is still to come.
  const busy = sites.some((e) => e.state === 'waiting' || e.state === 'running');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${busy ? '<meta http-equiv="refresh" content="5; url=/">\n' : ''}${PAGE_TITLE}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<style>
body { font: 16px/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 40rem; padding: 0 1rem; color: #1b1b1b; background: #fafaf7; }
ul { list-style: none; padding: 0; }
li { padding: 0.5rem 0; border-bottom: 1px solid #ddd; }
.day, .state { color: #666; margin-left: 0.5rem; }
.error, .refused { color: #a12; }
textarea { width: 100%; font: inherit; }
li form { display: inline; }
li a { white-space: nowrap; }
ul.roles { padding-left: 1.5rem; list-style: disc; }
ul.roles li { border: none; padding: 0.1rem 0; }
details { margin-top: 2rem; }
summary { cursor: pointer; font-weight: 600; }
</style>
</head>
<body>
<h1>Review a website</h1>
${(view.unreadable ?? []).map((file) => `<p class="error">${esc(unreadableLine(file))}</p>\n`).join('')}<form method="post" action="/queue">
<p><label for="sites">One site per line:</label></p>
<textarea id="sites" name="sites" rows="6" placeholder="www.example.com"></textarea>
<p><button>Review these sites</button></p>
</form>
<p>Up to ${esc(settings.reviewsAtOnce)} site${settings.reviewsAtOnce === 1 ? ' is' : 's are'} reviewed at once.</p>
${settings.note ? `<p class="error">${esc(settings.note)}</p>\n` : ''}${addedNotice(added)}
${queueList(sites, reviews, view.progress)}
<p><a href="/">Reload</a></p>
<h2>Done</h2>
<p>Each site reviewed, newest first. Open a review to read or send its PDF.</p>
${body}
<details${said?.leads ? ' open' : ''}>
<summary>Find companies to review</summary>
<h2>Is this company hiring QA?</h2>
<form method="post" action="/company">
<p><label for="company">A company's name or its site:</label></p>
<p><input id="company" name="company" type="text" maxlength="200" placeholder="Acme Robotics, or acme.com"> <button>Look up</button></p>
</form>
${said?.refused ? `<p class="refused">${esc(said.refused)}</p>\n` : ''}${lookupsList(lookups, companies)}
<h2>Who is hiring QA?</h2>
<p>A saved search, run on request across every job board below whose key is set, within each board's own limits. One row per company.</p>
${discoverySection(discovery.search, discovery.run, said?.searchRefused, companies)}
<h2>Lead sources</h2>
<p>Each source that needs a key, and whether its key is set.</p>
${keysList()}
</details>
</body>
</html>
`;
}
