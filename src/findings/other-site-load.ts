/**
 * What failed on another site's host while the crawler read the pages (G-657, TODO 129 box 3; Ghost, 2026-11-08: "info"): a
 * script or style sheet that did not load from another site's host, and an error thrown by another site's script. Many such
 * services (a video player, a widget, an analytics tag) turn an automated visitor away while they serve a person, so it is said
 * as SITE-40, info and unconfirmed: never in the short audit's top, after every confirmed finding. The site's own host (its
 * sub-domains too, `siteOf`) stays SITE-20 and SITE-21, major. Item 74's vendor-script watch (a new host or a changed hash, not yet built) is apart from this and not weakened by it.
 * An error whose source the crawl could not tell (its stack names no script, G-734) is said here too, in its own words: never as the site's.
 */
import type { CrawledPage, PageLoad, Sample } from '../leaf/report.js';
import { siteOf } from '../leaf/pages/site-of.js';
import type { SiteFinding } from './types.js';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Two samples of one kind as one. */
function joined(a: Sample | undefined, b: Sample | undefined): Sample | undefined {
  if (!a || !b) return a ?? b;
  return { count: a.count + b.count, first: [...new Set([...a.first, ...b.first])] };
}

/**
 * A sample split by a test of its entries: [the entries the test takes, the rest], or null when it takes none. The count goes whole
 * when the sample names none of the rest, else one each to those taken, the rest kept (erring toward where it was, as G-657 did).
 */
function split(s: Sample, takes: (entry: string) => boolean): [Sample, Sample | undefined] | null {
  const taken = s.first.filter(takes);
  if (!taken.length) return null;
  const kept = s.first.filter((f) => !taken.includes(f));
  return kept.length ? [{ count: taken.length, first: taken }, { count: Math.max(kept.length, s.count - taken.length), first: kept }] : [s, undefined];
}

/**
 * The browser's own words for a request that failed under a script (Chromium's NetworkError): a failed request, not a fault in the
 * script that made it, which the crawl itself causes as it blocks fonts, media and ad hosts (router.ts), and a challenge provider
 * meets (G-734). A request the visitor would miss is SITE-20's already.
 */
// Decision: G-734
const BROWSER_NETWORK_ERROR = 'A network error occurred.';

/**
 * A page's load with another site's failures moved out of `failed` into `failedOtherSite`: a crawl since G-657 keeps them apart
 * already; an older one is split by each sample's host. Its count is split by the sample: all of it another site's when the
 * sample names no request of the site's own, else one each for another site's named, the rest the site's own (erring toward
 * the site's own, as before G-657). And the browser's network error moved out of `scriptErrors` into `scriptErrorsUnknownSource`
 * (G-734): a crawl from before 2026-11-11 kept none apart, and whatever script it came from, it says a request failed.
 */
// Decision: G-657, G-734
export function splitLoad(load: PageLoad, origin: string): PageLoad {
  const own = siteOf(origin);
  const failed = load.failed && split(load.failed, (f) => !f.startsWith('/') && siteOf(f) !== own);
  const errors = load.scriptErrors && split(load.scriptErrors, (e) => e === BROWSER_NETWORK_ERROR);
  if (!failed && !errors) return load;
  const { failed: _f, scriptErrors: _e, ...rest } = load;
  return {
    ...rest,
    ...(failed ? { ...(failed[1] ? { failed: failed[1] } : {}), failedOtherSite: joined(load.failedOtherSite, failed[0]) } : load.failed ? { failed: load.failed } : {}),
    ...(errors ? { ...(errors[1] ? { scriptErrors: errors[1] } : {}), scriptErrorsUnknownSource: joined(load.scriptErrorsUnknownSource, errors[0]) } : load.scriptErrors ? { scriptErrors: load.scriptErrors } : {}),
  };
}

/** An error as said: one thrown with no message (the browser reports "undefined") is said so, as SITE-21 says it. */
const said = (first: string) => (first === '' || first === 'undefined' ? 'an error with no message' : first);

/**
 * SITE-40: another site's scripts and style sheets that did not load, and its scripts' errors, as an automated visitor saw them;
 * and the errors whose source the crawl could not tell (G-734), said as such: never the site's, never another site's.
 */
// Decision: G-657, G-734
export function otherSiteLoadFinding(pages: CrawledPage[]): SiteFinding[] {
  const found = pages.filter((p) => p.load?.failedOtherSite || p.load?.scriptErrorsOtherSite || p.load?.scriptErrorsUnknownSource);
  if (!found.length) return [];
  const sum = (k: 'failedOtherSite' | 'scriptErrorsOtherSite' | 'scriptErrorsUnknownSource') => found.reduce((n, p) => n + (p.load?.[k]?.count ?? 0), 0);
  const [requests, errors, unknown] = [sum('failedOtherSite'), sum('scriptErrorsOtherSite'), sum('scriptErrorsUnknownSource')];
  const listed = (s: Sample) => `${s.first.join(', ')}${s.count > s.first.length ? ` and ${s.count - s.first.length} more` : ''}`;
  const clauses = [
    requests ? `${plural(requests, 'script or style sheet', 'scripts and style sheets')} from other sites' hosts did not load` : '',
    errors ? `${requests ? 'their' : "other sites'"} scripts threw ${plural(errors, 'error')}` : '',
    unknown ? `${plural(unknown, 'error')} came from a source the crawl could not tell` : '',
  ].filter(Boolean);
  const all = clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]},`;
  const what = `${all[0].toUpperCase()}${all.slice(1)}`;
  const because = requests || errors ? '(other sites may block automated visitors)' : '(no script was named as their source)';
  return [{
    code: 'SITE-40', severity: 'info', unconfirmed: true,
    title: `${what} on ${plural(found.length, 'page')}, as seen by an automated visitor: unconfirmed ${because}; check in a browser`,
    where: found.map((p) => {
      const f = p.load?.failedOtherSite;
      const e = p.load?.scriptErrorsOtherSite;
      const u = p.load?.scriptErrorsUnknownSource;
      return { url: p.finalUrl, says: [f ? `${plural(f.count, 'request')}: ${listed(f)}` : '', e ? `${plural(e.count, 'error')}: ${listed(e)}` : '', u ? `${plural(u.count, 'error')} of no known source: ${u.first.map(said).join(', ')}` : ''].filter(Boolean).join('; ') };
    }),
    why: [
      requests || errors ? "Another site's script or style sheet (a video player, a widget, an analytics tag) failed while the crawler read the page. Many such services refuse or slow an automated visitor while they serve a person, so this is not said as a fact about the site; when it also fails in a browser, the part of the page that uses it does not work." : '',
      unknown ? `An error whose stack names no script cannot be traced to the site or to another site: "${BROWSER_NETWORK_ERROR}" is the browser's own word for a request that failed, and the crawler blocks fonts, video and ad hosts, and meets bot challenges, that a person's browser does not, so it is not said as the site's.` : '',
    ].filter(Boolean).join(' '),
    fix: `Open the page in an ordinary browser with the developer tools' network tab and console. If the request fails there too, check the embed's address and the account with that service, or remove the embed.${unknown ? ' An error that shows in the console there too names its script there: fix it at that line.' : ''}`,
  }];
}
