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
import { esc } from './html.js';

/** A review on the page: the site, the day, and the path its PDF is served at. */
export interface ListedReview {
  host: string;
  date: string;
  /** The review's folder under the data folder, as written by `reviewFolder` (`<host>-<date>`, `-2`, ...). */
  folder: string;
  /** The page's link to the PDF: `/reviews/<folder>/<host> site review.pdf`, each part percent-encoded. */
  href: string;
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
}

/** What a post did, said back on the page: the paste's queued and refused lines, a company lookup refused, or a search refused. */
export interface Said {
  added?: Added;
  refused?: string;
  searchRefused?: string;
  /** A post on one company row refused (4.8): said under that row. */
  row?: Rows['refused'];
}

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

/** The page: the form and the queue, then the reviews in the data folder, each a link to its PDF, then the company and discovery lanes, then the lead sources' keys. The salesperson's own screen, not the prospect's (REV-04). */
export function reviewsPage(view: View, said?: Said): string {
  const { reviews, sites, settings, lookups, discovery } = view;
  const companies: Rows = { notes: view.notes, refused: said?.row };
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
${said?.refused ? `<p class="refused">${esc(said.refused)}</p>\n` : ''}${lookupsList(lookups, companies)}
<h2>Who is hiring QA?</h2>
<p>A saved search, run on request across every job board below whose key is set, within each board's own limits. One row per company.</p>
${discoverySection(discovery.search, discovery.run, said?.searchRefused, companies)}
<h2>Lead sources</h2>
<p>Each source that needs a key, and whether its key is set.</p>
${keysList()}
</body>
</html>
`;
}
