/**
 * The lead finder's sections of the local page (split out of `serve.ts`): the company lane's lookups (4.6, `company.ts`), each
 * board's QA roles as text and a kept address as a link, no board offering the paste lane (4.9); the discovery lane (4.7,
 * `discover.ts`), the saved search's form, the last run's rows one per company and each skipped source named.
 */
import type { CompanyLookup } from './company.js';
import type { DiscoveryRow, DiscoveryRun, SavedSearch } from './discover.js';
import { esc } from './html.js';

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
export function lookupsList(lookups: readonly CompanyLookup[]): string {
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
export function discoverySection(search: SavedSearch, run: DiscoveryRun | undefined, refused: string | undefined): string {
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
