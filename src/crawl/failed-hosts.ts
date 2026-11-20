/**
 * Do the names of the other sites' hosts that failed during the crawl resolve from here (SITE-35, G-380)? A request
 * to log.example.com that "failed" says little; a name that does not resolve says the host is probably gone. Looked
 * up once after the crawl, at most H.FAILED_HOSTS_CHECKED hosts (the rest are not looked up, and the finding says so) at once, each for H.FAILED_HOSTS_LOOKUP_MS and all
 * for H.FAILED_HOSTS_TOTAL_MS. Only a lookup that said "no such name" is a claim; a timeout, no network or any other
 * error is `null`: could not check, never "does not resolve". A name only, no request is sent to the host.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { H } from '../leaf/heuristics/java-suite.js';
import { failedHostsOf } from '../leaf/pages/failed-hosts.js';
import type { CrawlReport, SiteProbe } from '../leaf/report.js';

/** How a name is looked up; it resolves, or throws (a `code` ENOTFOUND or ENODATA says there is no such name). Tests give a fake one. */
export type NameLookup = (host: string) => Promise<unknown>;

const systemLookup: NameLookup = (host) => dnsLookup(host, { all: true });

/** What one lookup says: true it resolves, false there is no such name, null the lookup could not say. */
async function resolves(lookup: NameLookup, host: string, timeoutMs: number): Promise<boolean | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([lookup(host), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); })]);
    return true;
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    return code === 'ENOTFOUND' || code === 'ENODATA' ? false : null;
  } finally {
    clearTimeout(timer);
  }
}

/** The hosts that failed and whether each name resolves; undefined when none failed, or the names are not looked up. */
// Decision: G-380
export async function checkFailedHosts(
  report: Pick<CrawlReport, 'pages'>,
  lookup: NameLookup = systemLookup,
  limits: { max: number; lookupMs: number; totalMs: number } = { max: H.FAILED_HOSTS_CHECKED, lookupMs: H.FAILED_HOSTS_LOOKUP_MS, totalMs: H.FAILED_HOSTS_TOTAL_MS },
): Promise<SiteProbe['failedHosts']> {
  // An address given as numbers has no name to look up.
  const named = failedHostsOf(report).filter((h) => !isIP(h.host.replace(/^\[|\]$/g, '')));
  if (!named.length) return undefined;
  const asked = named.slice(0, limits.max);
  const hosts: { host: string; resolves: boolean | null }[] = asked.map((h) => ({ host: h.host, resolves: null }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const all = Promise.all(hosts.map(async (h) => { h.resolves = await resolves(lookup, h.host, limits.lookupMs); }));
  // A name not answered by the total cap stays null: could not check.
  await Promise.race([all, new Promise<void>((done) => { timer = setTimeout(done, limits.totalMs); })]);
  clearTimeout(timer);
  return hosts.map((h) => ({ ...h }));
}
