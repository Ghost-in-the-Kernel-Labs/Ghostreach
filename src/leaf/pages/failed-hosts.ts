/**
 * The other sites' hosts whose data requests failed during the crawl (`load.failedElsewhere`, G-377), read from the pages'
 * samples: what the finding SITE-35 names (src/group/load-findings.ts) and what the crawl looks up after it
 * (src/crawl/failed-hosts.ts, G-380). In src/pages/, which every layer may read.
 */

/** A host whose data requests failed (`load.failedElsewhere`): its name without a port, the pages it failed on, why first, and the first page. */
export interface FailedHost {
  host: string;
  pages: number;
  /** The browser's word for the first failure ("ERR_NAME_NOT_RESOLVED") or a status ("404"); absent when it said none that reads as one. */
  why?: string;
  page: string;
}

/**
 * The other sites' hosts whose data requests failed during the crawl (G-380), read from each page's sample ("log.example.com/event
 * (ERR_NAME_NOT_RESOLVED)"), the most pages first. A host is its name, lower-case, port left off.
 */
// Decision: G-380
export function failedHostsOf(report: { pages: { finalUrl: string; load?: { failedElsewhere?: { first: string[] } } }[] }): FailedHost[] {
  const found = new Map<string, FailedHost>();
  for (const p of report.pages) {
    const seen = new Set<string>();
    for (const entry of p.load?.failedElsewhere?.first ?? []) {
      const named = /^([^/\s]+)/.exec(entry)?.[1];
      const host = named?.replace(/:\d+$/, '').toLowerCase();
      if (!host) continue;
      const why = /\(([A-Z][A-Z0-9_]+|\d{3})\)$/.exec(entry)?.[1];
      const was = found.get(host) ?? { host, pages: 0, page: p.finalUrl };
      if (!seen.has(host)) was.pages += 1;
      seen.add(host);
      if (why && !was.why) was.why = why;
      found.set(host, was);
    }
  }
  return [...found.values()].sort((a, b) => b.pages - a.pages || a.host.localeCompare(b.host));
}
