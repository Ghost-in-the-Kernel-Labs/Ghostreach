/**
 * The lead finder's sections of the local page (split out of `serve.ts`): the company lane's lookups (4.6, `company.ts`), each
 * board's QA roles as text and a kept address as a link, no board offering the paste lane (4.9); the discovery lane (4.7,
 * `discover.ts`), the saved search's form, the last run's rows one per company and each skipped source named; on each company row,
 * what the salesperson keeps about it (`leads.ts`): its website (4.8), the closed sites' postings pasted (4.9).
 */
import type { CompanyLookup } from './company.js';
import { LINK_BACK, type DiscoveryRow, type DiscoveryRun, type SavedSearch } from './discover.js';
import { esc, plainError } from './html.js';
import { companyKey, postingsOf, websiteOf, type CompanyNotes, type Lane } from './leads.js';
import type { QueueEntry } from './queue.js';
import type { ListedReview } from './page.js';

/** What the company rows are drawn with: what is kept per company, and a post on one row refused, said under that row. */
export interface Rows {
  notes: Readonly<Record<string, CompanyNotes>>;
  refused?: { company: string; why: string };
  /** The reviews done and the queue (4.10): a row whose site is reviewed or queued says so in place of its button. */
  reviews: readonly ListedReview[];
  sites: readonly QueueEntry[];
}

/** A host as two rows compare it: lowercase, a leading `www.` dropped. */
const bare = (host: string): string => host.toLowerCase().replace(/^www\./, '');

/**
 * "Queue this site" (4.10): a row with a website puts it into the queue in one click, the lead as its reason; a site already
 * reviewed shows its newest review and PDF instead (no score: the ranking waits on GR-007), one waiting or running says so.
 */
function queueThis(name: string, website: string, lane: Lane, rows: Rows): string {
  const host = bare(new URL(website).hostname);
  const review = rows.reviews.find((r) => bare(r.host) === host);
  if (review) return ` <span class="state">reviewed ${esc(review.date)}, <a href="${esc(review.href)}">PDF</a></span>`;
  if (rows.sites.some((e) => bare(e.host) === host && (e.state === 'waiting' || e.state === 'running'))) return ' <span class="state">in the queue</span>';
  return ` <form method="post" action="/queue/lead"><input type="hidden" name="company" value="${esc(name)}"><input type="hidden" name="lane" value="${esc(lane)}"><button>Queue this site</button></form>`;
}

/**
 * What a company row offers the salesperson (4.8): the company's website, typed in a text box since no source gives one, kept
 * when it reads as a site, never looked up. A row whose website is known shows it in the box, to correct; blank forgets it; a row with one
 * goes into the queue (`queueThis`, 4.10). The paste lane (4.9): the closed sites' postings pasted for it, each a link the salesperson may open (never fetched, no referrer, no
 * opener), and a box to paste another.
 */
function companyTools(name: string, rows: Rows, lane: Lane): string {
  const website = websiteOf(rows.notes, name, lane === 'company');
  const said = website ? queueThis(name, website, lane, rows) : ' <span class="state">no website given</span>';
  const refused = rows.refused && companyKey(rows.refused.company) === companyKey(name) ? `\n<p class="refused">${esc(rows.refused.why)}</p>` : '';
  return `${said}${refused}
<form method="post" action="/company/site"><input type="hidden" name="company" value="${esc(name)}"><label>Website: <input name="site" type="text" maxlength="300" placeholder="acme.com" value="${esc(website ?? '')}"></label> <button>Keep the site</button></form>${pasteLane(name, rows)}`;
}

/** The paste lane on a row (4.9): each posting pasted, as a link, and the form to paste another. */
function pasteLane(name: string, rows: Rows): string {
  const pasted = postingsOf(rows.notes, name).map((p) => `<li><a href="${esc(p.url)}" rel="noopener noreferrer">${esc(p.url)}</a> <span class="day">pasted ${esc(p.at.slice(0, 10))}</span></li>`);
  return `${pasted.length ? `\n<ul class="roles">\n${pasted.join('\n')}\n</ul>` : ''}
<form method="post" action="/company/posting"><input type="hidden" name="company" value="${esc(name)}"><label>A posting seen on LinkedIn, Indeed, Glassdoor or ZipRecruiter: <input name="posting" type="text" maxlength="2000" placeholder="the posting's address"></label> <button>Keep the posting</button></form>`;
}

/** What the page says when no board is found: the paste lane is the way left (4.9). */
export const NO_BOARD = 'No public board found.';
export const PASTE_LANE = 'Seen its posting on LinkedIn, Indeed, Glassdoor or ZipRecruiter? Keep it with the paste lane below: its address is kept as a note, never opened by this program.';

/** One board found: the source, the name it answered under, its open roles, and each QA role, a link when its address was kept. */
function boardItem(board: CompanyLookup['boards'][number]): string {
  const head = `${esc(board.source)} board "${esc(board.slug)}": ${esc(String(board.open))} open role${board.open === 1 ? '' : 's'}, ${esc(board.roles.length)} QA, test or SDET`;
  if (!board.roles.length) return `<li>${head}.</li>`;
  const roles = board.roles.map((r) => `<li>${r.url ? `<a href="${esc(r.url)}" rel="noreferrer">${esc(r.title)}</a>` : esc(r.title)}</li>`).join('\n');
  return `<li>${head}:\n<ul class="roles">\n${roles}\n</ul></li>`;
}

/** The lookups kept, newest first: each company's boards, or no board and the paste lane; each source that could not be asked. */
export function lookupsList(lookups: readonly CompanyLookup[], rows: Rows): string {
  if (!lookups.length) return '<p>No company looked up yet.</p>';
  const items = lookups.map((l) => {
    const found = l.boards.length ? `<ul>\n${l.boards.map(boardItem).join('\n')}\n</ul>` : `<p>${NO_BOARD} ${PASTE_LANE}</p>`;
    const unanswered = l.unanswered.map((why) => `<p class="error">Not asked: ${esc(plainError(why))}</p>`).join('\n');
    return `<li><strong>${esc(l.asked)}</strong> <span class="day">${esc(l.at.slice(0, 10))}</span>${companyTools(l.asked, rows, 'company')}\n${found}${unanswered ? `\n${unanswered}` : ''}</li>`;
  });
  return `<ul>\n${items.join('\n')}\n</ul>`;
}

/** One company found: its newest QA posting (a link when its address was kept), the source (attributed, 4.11) and day, and how many more. */
function discoveryItem(row: DiscoveryRow, rows: Rows): string {
  const title = row.url ? `<a href="${esc(row.url)}" rel="noreferrer">${esc(row.title)}</a>` : esc(row.title);
  const more = row.others ? `, and ${esc(row.others)} more posting${row.others === 1 ? '' : 's'}` : '';
  // Attribution (4.11): a source asking for a link back is named as a link to its own posting page.
  const source = row.url && LINK_BACK.includes(row.source) ? `from <a href="${esc(row.url)}" rel="noopener noreferrer">${esc(row.source)}</a>` : esc(row.source);
  return `<li><strong>${esc(row.company)}</strong>: ${title} <span class="day">${source}, ${esc(row.at.slice(0, 10) || 'no date')}${more}</span>${companyTools(row.company, rows, 'discovery')}</li>`;
}

/** The discovery lane: the saved search's form, one button that saves it and runs it (launch fixes 5), and the last run's rows and skipped sources. */
export function discoverySection(search: SavedSearch, run: DiscoveryRun | undefined, refused: string | undefined, rows: Rows): string {
  const form = `<form method="post" action="/discover/run">
<p><label for="titles">Titles, one per line:</label></p><textarea id="titles" name="titles" rows="5">${esc(search.titles.join('\n'))}</textarea>
<p><label for="location">A location, or remote:</label> <input id="location" name="location" type="text" maxlength="100" value="${esc(search.location)}"> <button>Search</button></p>
</form>
${refused ? `<p class="refused">${esc(refused)}</p>\n` : ''}`;
  if (!run) return `${form}<p>The search has not run yet.</p>`;
  const head = `<p>Last run ${esc(run.at.slice(0, 10))} (${esc(run.search.titles.join(', '))}; ${esc(run.search.location)}): ${esc(run.rows.length)} compan${run.rows.length === 1 ? 'y' : 'ies'}.</p>`;
  const items = run.rows.length ? `\n<ul>\n${run.rows.map((row) => discoveryItem(row, rows)).join('\n')}\n</ul>` : '';
  return `${form}${head}${items}${run.skipped.map((why) => `\n<p class="error">Skipped: ${esc(plainError(why))}</p>`).join('')}`;
}
