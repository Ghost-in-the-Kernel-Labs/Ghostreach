/**
 * Where a request outside the browser may go (G-243). The crawl asks addresses a site names (links to other
 * sites, images, its robots.txt, its sitemap) with Playwright's request client, which has none of a browser's
 * guards: an untrusted site could have it ask this computer, the network it sits on, or a cloud machine's
 * credentials (169.254.169.254), and the answer's status would land in the report. So every such request goes
 * through `guardRequests`: each hop of it, redirects followed here and not by the client, is looked up and
 * asked only when it leads no further in than the site under test does. A site on this computer may link to
 * its neighbours; a public site may not reach in.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { APIResponse, BrowserContext } from 'playwright';

/** How far in an address leads: the open internet, a private network, this computer, or nowhere a page should. */
export type Reach = 'public' | 'private' | 'this-computer' | 'never';

/**
 * The special IPv4 blocks (the IANA special-purpose registry), most specific first: what is not in one is public.
 * Documentation, benchmarking and protocol blocks lead nowhere a page should (G-265).
 */
const V4: [string, number, Reach][] = [
  ['0.0.0.0', 8, 'never'], ['127.0.0.0', 8, 'this-computer'], ['169.254.0.0', 16, 'never'], ['192.0.0.0', 24, 'never'],
  ['192.0.2.0', 24, 'never'], ['192.88.99.0', 24, 'never'], ['198.18.0.0', 15, 'never'], ['198.51.100.0', 24, 'never'],
  ['203.0.113.0', 24, 'never'], ['224.0.0.0', 3, 'never'], ['10.0.0.0', 8, 'private'], ['172.16.0.0', 12, 'private'],
  ['192.168.0.0', 16, 'private'], ['100.64.0.0', 10, 'private'],
];

/** The special IPv6 blocks, most specific first; outside 2000::/3, the global unicast space, nothing is public. */
const V6: [string, number, Reach][] = [
  ['64:ff9b:1::', 48, 'never'], ['100::', 64, 'never'], ['2001:2::', 48, 'never'], ['2001:10::', 28, 'never'], ['2001:20::', 28, 'never'],
  ['2001:db8::', 32, 'never'], ['3fff::', 20, 'never'], ['5f00::', 16, 'never'], ['fe80::', 10, 'never'], ['fec0::', 10, 'private'],
  ['fc00::', 7, 'private'], ['ff00::', 8, 'never'],
];

/** An IPv4 address as one number, or null. */
function v4Number(ip: string): number | null {
  return isIP(ip) === 4 ? ip.split('.').reduce((n, part) => n * 256 + Number(part), 0) : null;
}

/** An IPv6 address's eight groups (a dotted IPv4 tail as the last two, a zone dropped), or null. */
function v6Groups(ip: string): number[] | null {
  let text = ip.toLowerCase().replace(/%.*$/, '');
  if (isIP(text) !== 6) return null;
  const dotted = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted) {
    const n = v4Number(dotted[2]) ?? 0;
    text = `${dotted[1]}${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`;
  }
  const part = (t: string) => (t ? t.split(':').map((h) => parseInt(h, 16)) : []);
  const [head, tail] = text.split('::');
  if (tail === undefined) return part(head);
  const front = part(head);
  const back = part(tail);
  return [...front, ...Array<number>(8 - front.length - back.length).fill(0), ...back];
}

/** Whether a number's first `bits` bits, of `width`, are a block's: groups or one IPv4 number, compared bit by bit. */
function inBlock(value: number[], block: number[], bits: number, width: number): boolean {
  for (let i = 0; i < bits; i++) {
    const at = Math.floor(i / width);
    const bit = width - 1 - (i % width);
    if (Math.floor(value[at] / 2 ** bit) % 2 !== Math.floor(block[at] / 2 ** bit) % 2) return false;
  }
  return true;
}

function reach4(n: number): Reach {
  return V4.find(([base, bits]) => inBlock([n], [v4Number(base) ?? 0], bits, 32))?.[2] ?? 'public';
}

/**
 * An IPv6 address's reach. One that carries an IPv4 address (mapped, ::ffff:a.b.c.d; compatible, ::a.b.c.d;
 * translated, ::ffff:0:a.b.c.d and 64:ff9b::a.b.c.d; 6to4, 2002:aabb:ccdd::; Teredo, 2001:0::, its client inverted)
 * leads where that address does: a URL writes them in hex, [::ffff:7f00:1], the hostile review's H1.
 */
function reach6(g: number[]): Reach {
  const zero = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  const carried = (hi: number, lo: number) => reach4(hi * 65536 + lo);
  if (zero(0, 8)) return 'never';
  if (zero(0, 7) && g[7] === 1) return 'this-computer';
  if ((zero(0, 5) && g[5] === 0xffff) || zero(0, 6) || (zero(0, 4) && g[4] === 0xffff && g[5] === 0)) return carried(g[6], g[7]);
  if (g[0] === 0x64 && g[1] === 0xff9b && zero(2, 6)) return carried(g[6], g[7]);
  if (g[0] === 0x2002) return carried(g[1], g[2]);
  if (g[0] === 0x2001 && g[1] === 0) return carried(g[6] ^ 0xffff, g[7] ^ 0xffff);
  const special = V6.find(([base, bits]) => inBlock(g, v6Groups(base) ?? [], bits, 16));
  if (special) return special[2];
  return inBlock(g, [0x2000], 3, 16) ? 'public' : 'never';
}

/**
 * How far in one IP address leads (written bare, without the brackets a URL puts round IPv6). Anything that is
 * not an address, or not positively public, leads nowhere a page should.
 */
// Decision: G-265
function reachOf(ip: string): Reach {
  const four = v4Number(ip);
  if (four !== null) return reach4(four);
  const groups = v6Groups(ip);
  return groups ? reach6(groups) : 'never';
}

const DEPTH: Record<Reach, number> = { public: 0, private: 1, 'this-computer': 2, never: 3 };

/** The furthest in any of a name's addresses leads: one private address among public ones is enough to reach in. */
const furthest = (reaches: Reach[]) => reaches.reduce<Reach>((a, b) => (DEPTH[b] > DEPTH[a] ? b : a), 'public');

/** Looks a name up: every address it has, or none when this computer cannot (a proxy's network resolves it). */
export type Resolve = (host: string) => Promise<string[]>;
const resolveAll: Resolve = async (host) => {
  try {
    return (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
  } catch {
    return [];
  }
};

/**
 * How far in a URL's host leads, and the address that says so. localhost and *.localhost are this computer
 * without a lookup; a name this computer cannot look up is reached through whatever network it uses (a proxy
 * resolves it there), so it is counted public.
 */
export async function reachOfUrl(url: string, resolve: Resolve = resolveAll): Promise<{ reach: Reach; address: string }> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return { reach: 'this-computer', address: host };
  const addresses = isIP(host) ? [host] : await resolve(host);
  const reach = furthest(addresses.map(reachOf));
  return { reach, address: addresses.find((a) => reachOf(a) === reach) ?? host };
}

const SAID: Record<Exclude<Reach, 'public'>, string> = {
  private: 'an address on a private network',
  'this-computer': 'this computer',
  never: 'an address no page should lead to (link-local, where a cloud machine keeps its credentials, or reserved)',
};

/** Why a request is not sent: its destination leads further in than the site under test; null when it may go. */
// Decision: G-243
function refusal(to: { reach: Reach; address: string }, site: Reach): string | null {
  if (to.reach === 'never' || DEPTH[to.reach] > DEPTH[site]) return `not asked: it leads to ${SAID[to.reach as Exclude<Reach, 'public'>]} (${to.address}), further in than the site under test`;
  return null;
}

/**
 * The browser's own requests kept as the request client's are (the hostile review's H2, G-270): a page's script,
 * style, frame or fetch() of an address further in than the site is refused, each host looked up once. Null when
 * a request may go; why, when not. The real guarantee is the machine's network (a service's egress), not this.
 */
// Decision: G-270
export function browserGuard(site: Reach, resolve: Resolve = resolveAll): (url: string) => Promise<string | null> {
  const byHost = new Map<string, Promise<{ reach: Reach; address: string }>>();
  return async (url) => {
    let host: string;
    try {
      const u = new URL(url);
      if (!/^(https?|wss?):$/.test(u.protocol)) return null;
      host = u.host;
    } catch {
      return null;
    }
    const reach = byHost.get(host) ?? reachOfUrl(url, resolve);
    byHost.set(host, reach);
    return refusal(await reach, site);
  };
}

/** The error a guarded request throws when its destination is refused: its message starts "not asked:". */
export class NotAsked extends Error {}

/** What a guarded answer offers: an answer of Playwright's, at the address its redirects ended on. */
type Answer = Pick<APIResponse, 'status' | 'headers' | 'text' | 'body'> & { url(): string };
type Options = { timeout?: number; maxRedirects?: number; failOnStatusCode?: boolean };
/** A request client with Playwright's get and head, every hop of each request checked first. */
export type Asker = { get(url: string, options?: Options): Promise<Answer>; head(url: string, options?: Options): Promise<Answer> };

/**
 * `request` (Playwright's, or a test's), each request's every hop checked against how far in the site under
 * test is (`site`) before it is sent: redirects are followed here, up to the request's own maxRedirects
 * (Playwright's default, 20, when none is given), so a public address that redirects into a private network
 * is stopped at the redirect. A refused hop throws NotAsked. What remains (G-243): the client looks the name
 * up again when it connects, so a name whose owner changes its address between the two lookups is not seen.
 */
function guardRequests(request: Pick<BrowserContext['request'], 'get' | 'head'>, site: Reach, resolve: Resolve = resolveAll): Asker {
  const send = async (method: 'get' | 'head', first: string, options: Options = {}): Promise<Answer> => {
    const most = options.maxRedirects ?? 20; // not a heuristic: Playwright's own default, kept so a request reads as it would unguarded
    let url = first;
    for (let hop = 0; ; hop++) {
      const why = refusal(await reachOfUrl(url, resolve), site);
      if (why) throw new NotAsked(why);
      const res = await request[method](url, { ...options, maxRedirects: 0 });
      const location = res.headers().location;
      if (res.status() < 300 || res.status() > 399 || !location || hop >= most) {
        const at = url;
        return { status: () => res.status(), headers: () => res.headers(), text: () => res.text(), body: () => res.body(), url: () => at };
      }
      url = new URL(location, url).href;
    }
  };
  return { get: (url, options) => send('get', url, options), head: (url, options) => send('head', url, options) };
}

/** The browser context's request client, each request kept from leading further in than the site at `origin`. */
// Decision: G-243
export async function guardedRequests(context: Pick<BrowserContext, 'request'>, origin: string, resolve?: Resolve): Promise<Asker> {
  return guardRequests(context.request, (await reachOfUrl(origin, resolve)).reach, resolve);
}
