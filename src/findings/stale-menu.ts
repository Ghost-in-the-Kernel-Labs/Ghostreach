/**
 * A broken link in a navigation menu, named by its menu, and by what most pages do (G-658, TODO 129 box 4). The Vouched review
 * found the finding worth leading with further down the audit: on 3 pages the Product menu's "Know Your Agent" led to a "Page not
 * found" page while 9 other pages linked the working one, and the audit named it only as a link on a page. A menu link is one in
 * the header, or one the crawl found hidden in a drop-down (its `trigger`): named by the drop-down's control, any inner one, then
 * the item ("Product → Know Your Agent"). When the same item, by that name, leads elsewhere from more pages than lead here, the
 * pages that lead here have a stale menu, and are named.
 */
import type { CrawlReport, LinkEdge } from '../leaf/report.js';

const path = (url: string) => new URL(url).pathname;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listed = (paths: string[]) => `${paths.slice(0, 5).join(', ')}${paths.length > 5 ? ` and ${paths.length - 5} more` : ''}`;

/** A menu link's name, "Product → Know Your Agent"; a header link by its own text; null for a link that is not in a menu, or has no text. */
// Decision: G-658
function menuItemOf(e: LinkEdge): string | null {
  // A report is data: a link without its text (an older or hand-made report) is no menu item.
  if (!e.text?.trim()) return null;
  if (e.region !== 'header' && !(e.hidden && e.trigger)) return null;
  return [e.trigger?.text, ...(e.innerTriggers ?? []).map((t) => t?.text), e.text].filter((t) => t?.trim()).join(' → ');
}

/**
 * What a broken page's menu links say: "in the menu Product → Know Your Agent: 9 pages link /know-your-agent from it, 3 link this
 * one: a stale menu on /p10, /p11, /p12", or "in the menu ..." alone when no other address has more pages; "" when no link to it is
 * in a menu. `toBroken` are the links to the broken page (its addresses), from other pages.
 */
// Decision: G-658
export function menuSaid(report: CrawlReport, toBroken: LinkEdge[]): string {
  const named = toBroken.flatMap((e) => {
    const item = menuItemOf(e);
    return item ? [{ e, item }] : [];
  });
  if (!named.length) return '';
  // The item most of its menu links go by (one name, almost always).
  const counts = new Map<string, number>();
  for (const { item } of named) counts.set(item, (counts.get(item) ?? 0) + 1);
  const item = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const here = new Set(toBroken.map((e) => e.to));
  const stale = [...new Set(named.filter((n) => n.item === item).map((n) => path(n.e.from)))];
  // Where the same item leads from every page, by address: the pages each.
  const elsewhere = new Map<string, Set<string>>();
  for (const e of report.edges) {
    if (e.external || here.has(e.to) || menuItemOf(e) !== item) continue;
    elsewhere.set(e.to, (elsewhere.get(e.to) ?? new Set()).add(path(e.from)));
  }
  const best = [...elsewhere].sort((a, b) => b[1].size - a[1].size)[0];
  const head = `in the menu ${item}`;
  if (!best || best[1].size <= stale.length) return head;
  return `${head}: ${plural(best[1].size, 'page links', 'pages link')} ${path(best[0])} from it, ${stale.length} link${stale.length === 1 ? 's' : ''} this one: a stale menu on ${listed(stale)}`;
}
