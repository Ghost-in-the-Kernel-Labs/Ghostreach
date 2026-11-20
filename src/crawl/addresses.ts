/**
 * Every address the site's name points to, each tried once: does it take a connection? A name with
 * five addresses where one never answers fails one visitor in five, and no browser shows it (Chrome
 * tries the next address; scripts, phones and test tools do not). Site G's run, 2026-10-03: four
 * CloudFront addresses and a registrar's leftover one, which timed out the crawl and a Cypress run.
 *
 * A connection only (TCP): no request is sent, so robots.txt has nothing to say about it. The
 * addresses are tried at once, each for H.ADDRESS_TIMEOUT_MS at most.
 */
import { lookup as dnsLookup, resolve4, resolve6 } from 'node:dns/promises';
import { isIP, connect } from 'node:net';
import { H } from '../leaf/heuristics/java-suite.js';
import type { CrawlReport } from '../leaf/report.js';

export type HostAddress = NonNullable<CrawlReport['addresses']>[number];

/** How the name is looked up: Node's own lookup, as Cypress, Node scripts and the crawl's own requests do. */
export type Lookup = (host: string) => Promise<{ address: string; family: number }[]>;

/**
 * Every address any of the lookups found. Node's own lookup reads the computer's cache, which can
 * hold one address of several: Site G's crawl saw only 54.192.100.73 while Cypress, minutes later on
 * the same computer, was handed the dead 192.64.119.6. Asking the DNS server for every record as well
 * sees the whole set, whichever address the cache holds at the time.
 */
export function joinedLookup(...lookups: Lookup[]): Lookup {
  return async (host) => {
    const found = (await Promise.all(lookups.map((l) => l(host).catch(() => [])))).flat();
    if (!found.length) throw new Error(`${host} does not resolve`);
    return found;
  };
}

const systemLookup = joinedLookup(
  (host) => dnsLookup(host, { all: true, verbatim: true }),
  async (host) => (await resolve4(host)).map((address) => ({ address, family: 4 })),
  async (host) => (await resolve6(host)).map((address) => ({ address, family: 6 })),
);

/** Each of the origin's addresses and whether it took a connection; undefined for an address given as an IP, or a name that does not resolve. */
// Decision: G-139
export async function probeAddresses(origin: string, lookup: Lookup = systemLookup, timeoutMs = H.ADDRESS_TIMEOUT_MS): Promise<HostAddress[] | undefined> {
  const url = new URL(origin);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return undefined;
  let found: { address: string; family: number }[];
  try {
    found = await lookup(host);
  } catch {
    return undefined;
  }
  const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
  const unique = found.filter((a, i) => found.findIndex((b) => b.address === a.address) === i);
  return Promise.all(unique.map((a) => tryConnect(a.address, a.family === 6 ? 6 : 4, port, timeoutMs)));
}

function tryConnect(address: string, family: 4 | 6, port: number, timeoutMs: number): Promise<HostAddress> {
  return new Promise((resolve) => {
    const socket = connect({ host: address, port, family });
    const done = (answered: boolean, error?: string) => {
      socket.destroy();
      resolve({ address, family, answered, ...(error ? { error } : {}) });
    };
    socket.setTimeout(timeoutMs, () => done(false, `no answer in ${Math.round(timeoutMs / 1000)} s`));
    socket.once('connect', () => done(true));
    socket.once('error', (e: NodeJS.ErrnoException) => done(false, e.code ?? e.message));
  });
}

