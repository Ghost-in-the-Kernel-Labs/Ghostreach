/**
 * Where a request outside the browser may go (src/crawl/destination.ts, G-243): an untrusted site never has the
 * crawl, or the build's link checks, ask this computer, a private network or a cloud machine's credentials
 * (169.254.169.254), by a link, a name that resolves there, or a redirect that leads there.
 */
import { describe, expect, it } from 'vitest';
import { browserGuard, guardRequests, NotAsked, reachOf, reachOfUrl, refusal, resolveAll, type Resolve } from '../../src/crawl/destination.js';
import { askExternal } from '../../src/crawl/site-probe.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('how far in an address leads', () => {
  it('every URL of the list the suites are held to (test/data/address-reach.json), as a URL writes it (G-265)', async () => {
    const { vectors } = JSON.parse(readFileSync(join(__dirname, '../data/address-reach.json'), 'utf8')) as { vectors: { url: string; reach: string; why: string }[] };
    const said = await Promise.all(vectors.map(async (v) => `${v.url} ${(await reachOfUrl(new URL(v.url).href, async () => [])).reach}`));
    expect(said).toEqual(vectors.map((v) => `${v.url} ${v.reach}`));
  });

  it('IPv4: the internet, a private network (CGNAT too), this computer, and nowhere a page should (link-local, unspecified, multicast, reserved)', () => {
    const said = (ips: string[]) => ips.map(reachOf);
    // The second number of a private range under another first number is public: 8.16, 8.168, 8.64, 8.254.
    expect(said(['8.8.8.8', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1', '169.253.1.1', '192.167.1.1', '223.255.255.255', '11.0.0.1', '126.255.255.255', '128.0.0.1', '8.16.0.1', '8.168.0.1', '8.64.0.1', '8.254.1.1'])).toEqual(Array(15).fill('public'));
    expect(said(['10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '100.127.255.255', '100.100.100.200'])).toEqual(Array(8).fill('private'));
    expect(said(['127.0.0.1', '127.255.255.254'])).toEqual(['this-computer', 'this-computer']);
    expect(said(['169.254.169.254', '169.254.0.1', '0.0.0.0', '0.1.2.3', '224.0.0.1', '239.255.255.250', '240.0.0.1', '255.255.255.255'])).toEqual(Array(8).fill('never'));
  });

  it('IPv6: loopback, unspecified, link-local, multicast, unique local (AWS metadata, fd00:ec2::254), and IPv4 inside IPv6', () => {
    expect(['::1', '::1'.toUpperCase()].map(reachOf)).toEqual(['this-computer', 'this-computer']);
    expect(['::', 'fe80::1', 'fe80::', 'febf::1', 'ff02::1'].map(reachOf)).toEqual(['never', 'never', 'never', 'never', 'never']);
    // An IPv4 address written inside another IPv6 prefix is that prefix's: 2001:db8:: is documentation's, wherever it points.
    expect(reachOf('2001:db8::ffff:127.0.0.1')).toBe('never');
    expect(reachOf('2606:4700::ffff:127.0.0.1')).toBe('public');
    expect(['fc00::1', 'fd00:ec2::254', 'FDFF::1', 'fec0::1'].map(reachOf)).toEqual(['private', 'private', 'private', 'private']);
    // Public only inside 2000::/3, and not in a block for documentation or benchmarks (G-265).
    expect(['2606:4700::1111', '2a00:1450::1'].map(reachOf)).toEqual(['public', 'public']);
    expect(['fbff::1', '2001:db8::1', '4000::1', '1fff::1'].map(reachOf)).toEqual(['never', 'never', 'never', 'never']);
    // Written dotted or as a URL writes it, in hex: the same address (the hostile review's H1).
    expect(['::ffff:127.0.0.1', '::ffff:7f00:1', '::FFFF:169.254.169.254', '::ffff:a9fe:a9fe', '64:ff9b::10.0.0.1', '64:ff9b::a00:1', '::ffff:8.8.8.8'].map(reachOf)).toEqual(['this-computer', 'this-computer', 'never', 'never', 'private', 'private', 'public']);
    // A zone is dropped; anything not an address leads nowhere.
    expect(['fe80::1%eth0', '2606:4700::1%eth0', 'not-an-address', ''].map(reachOf)).toEqual(['never', 'public', 'never', 'never']);
    // As a lookup may give one: dotted, each part more than a digit.
    expect(['::ffff:10.20.30.40', '::ffff:93.184.216.34', '64:ff9b::192.168.100.200'].map(reachOf)).toEqual(['private', 'public', 'private']);
  });
});

/** A lookup of this test's own: each name its addresses; any other name, none (this computer cannot look it up). */
const names: Record<string, string[]> = {
  'shop.test': ['93.184.216.34'],
  'intranet.test': ['10.1.2.3'],
  'split.test': ['93.184.216.35', '192.168.0.9'],
  'metadata.test': ['169.254.169.254'],
  'six.test': ['2606:4700::1', '::1'],
  'first.test': ['192.168.0.9', '93.184.216.35'],
};
const resolve: Resolve = async (host) => names[host] ?? [];

describe('how far in a URL leads, and whether it is asked', () => {
  it('by its address, its name\'s furthest address, or localhost without a lookup; a name not found counts public', async () => {
    const at = (url: string) => reachOfUrl(url, resolve);
    expect(await at('http://127.0.0.1:8080/x')).toEqual({ reach: 'this-computer', address: '127.0.0.1' });
    expect(await at('http://[::1]/')).toEqual({ reach: 'this-computer', address: '::1' });
    expect(await at('http://LocalHost/')).toEqual({ reach: 'this-computer', address: 'localhost' });
    expect(await at('http://app.localhost:3000/')).toEqual({ reach: 'this-computer', address: 'app.localhost' });
    expect(await at('https://intranet.test/wiki')).toEqual({ reach: 'private', address: '10.1.2.3' });
    expect(await at('https://split.test/')).toEqual({ reach: 'private', address: '192.168.0.9' });
    expect(await at('https://first.test/')).toEqual({ reach: 'private', address: '192.168.0.9' });
    expect(await at('https://six.test/')).toEqual({ reach: 'this-computer', address: '::1' });
    expect(await at('http://metadata.test/latest/meta-data/')).toEqual({ reach: 'never', address: '169.254.169.254' });
    expect(await at('https://shop.test/')).toEqual({ reach: 'public', address: '93.184.216.34' });
    expect(await at('https://unknown.test/')).toEqual({ reach: 'public', address: 'unknown.test' });
  });

  it('never further in than the site: a public site reaches nothing in; a site on a private network its network; one on this computer, this computer too; link-local never', () => {
    const to = (reach: 'public' | 'private' | 'this-computer' | 'never') => ({ reach, address: 'a' });
    const asked = (site: 'public' | 'private' | 'this-computer') => (['public', 'private', 'this-computer', 'never'] as const).map((r) => refusal(to(r), site) === null);
    expect(asked('public')).toEqual([true, false, false, false]);
    expect(asked('private')).toEqual([true, true, false, false]);
    expect(asked('this-computer')).toEqual([true, true, true, false]);
    expect(refusal({ reach: 'never', address: '169.254.169.254' }, 'public')).toBe('not asked: it leads to an address no page should lead to (link-local, where a cloud machine keeps its credentials, or reserved) (169.254.169.254), further in than the site under test');
    expect(refusal({ reach: 'private', address: '10.1.2.3' }, 'public')).toBe('not asked: it leads to an address on a private network (10.1.2.3), further in than the site under test');
    // A site that is itself link-local (a device's own page) still reaches no link-local address.
    expect(refusal(to('never'), 'never')).not.toBeNull();
    expect(refusal({ reach: 'this-computer', address: '127.0.0.1' }, 'private')).toBe('not asked: it leads to this computer (127.0.0.1), further in than the site under test');
  });
});

/** A stand-in for Playwright's request client: each address its answer, every request recorded; it follows no redirect itself. */
function client(answers: Record<string, { status: number; location?: string }>) {
  const sent: string[] = [];
  const answer = (method: string) => async (url: string, options?: { maxRedirects?: number }) => {
    sent.push(`${method} ${url} ${options?.maxRedirects}`);
    const a = answers[url] ?? { status: 404 };
    return { status: () => a.status, headers: () => (a.location ? { location: a.location } : {}), text: async () => '', url: () => url } as never;
  };
  return { sent, request: { get: answer('GET'), head: answer('HEAD') } };
}

describe('every request outside the browser, each hop checked', () => {
  it('a public site\'s link to this computer, a private network or the metadata address is never sent', async () => {
    const { sent, request } = client({});
    const asker = guardRequests(request, 'public', resolve);
    for (const url of ['http://127.0.0.1:6379/', 'http://localhost/admin', 'http://10.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'https://intranet.test/', 'https://split.test/']) {
      await expect(asker.get(url), url).rejects.toBeInstanceOf(NotAsked);
    }
    expect(sent).toEqual([]);
  });

  it('a redirect from a public address into the metadata address is stopped at the redirect, the inner address never sent', async () => {
    const { sent, request } = client({ 'https://shop.test/out': { status: 302, location: 'http://169.254.169.254/latest/meta-data/iam/' } });
    await expect(guardRequests(request, 'public', resolve).head('https://shop.test/out', { maxRedirects: 5 })).rejects.toThrow(/^not asked: it leads to an address no page should lead to .*\(169\.254\.169\.254\)/);
    expect(sent).toEqual(['HEAD https://shop.test/out 0']);
  });

  it('redirects followed here, one hop at a time, relative ones too, up to the request\'s own limit; the answer at the address they ended on', async () => {
    const { sent, request } = client({ 'https://shop.test/a': { status: 301, location: '/b' }, 'https://shop.test/b': { status: 307, location: 'https://shop.test/c' }, 'https://shop.test/c': { status: 200 } });
    const asker = guardRequests(request, 'public', resolve);
    const end = await asker.get('https://shop.test/a', { maxRedirects: 5 });
    expect([end.status(), end.url()]).toEqual([200, 'https://shop.test/c']);
    expect(sent).toEqual(['GET https://shop.test/a 0', 'GET https://shop.test/b 0', 'GET https://shop.test/c 0']);
    // A limit of one: the second redirect is the answer; of none, the first.
    expect((await asker.get('https://shop.test/a', { maxRedirects: 1 })).status()).toBe(307);
    const first = await asker.get('https://shop.test/a', { maxRedirects: 0 });
    expect([first.status(), first.headers().location, first.url()]).toEqual([301, '/b', 'https://shop.test/a']);
    // No limit given: Playwright's own, 20.
    const loop = client({ 'https://shop.test/loop': { status: 302, location: '/loop' } });
    expect((await guardRequests(loop.request, 'public', resolve).get('https://shop.test/loop')).status()).toBe(302);
    expect(loop.sent.length).toBe(21);
  });

  it('only a 3xx with a Location is followed: a 2xx or 4xx that carries one is the answer, its text read through', async () => {
    const { request } = client({
      'https://shop.test/m': { status: 301 },
      'https://shop.test/ok': { status: 200, location: 'http://10.0.0.1/' },
      'https://shop.test/made': { status: 201, location: 'http://10.0.0.1/' },
      'https://shop.test/no': { status: 400, location: 'http://10.0.0.1/' },
      'https://shop.test/many': { status: 300, location: '/m' },
      'https://shop.test/last': { status: 399, location: '/m' },
    });
    const asker = guardRequests(request, 'public', resolve);
    expect(await Promise.all(['m', 'ok', 'made', 'no', 'many', 'last'].map(async (p) => (await asker.get(`https://shop.test/${p}`)).status()))).toEqual([301, 200, 201, 400, 301, 301]);
    expect(await (await asker.get('https://shop.test/ok')).text()).toBe('');
  });

  it("this computer's own lookup: every address of a name, none for one that does not exist", async () => {
    expect((await resolveAll('localhost')).some((a) => a === '127.0.0.1' || a === '::1')).toBe(true);
    expect(await resolveAll('nothing-here.invalid')).toEqual([]);
  });

  it('a site on this computer (a developer\'s) may link to its neighbours, never to link-local', async () => {
    const { sent, request } = client({ 'http://127.0.0.1:4000/': { status: 200 }, 'http://10.0.0.7/': { status: 200 } });
    const asker = guardRequests(request, 'this-computer', resolve);
    expect((await asker.get('http://127.0.0.1:4000/')).status()).toBe(200);
    expect((await asker.get('http://10.0.0.7/')).status()).toBe(200);
    await expect(asker.get('http://169.254.169.254/')).rejects.toBeInstanceOf(NotAsked);
    expect(sent).toEqual(['GET http://127.0.0.1:4000/ 0', 'GET http://10.0.0.7/ 0']);
  });

  it('the build\'s link check records a refused link as not asked, never as gone, and asks the rest', async () => {
    const { sent, request } = client({ 'https://shop.test/': { status: 200 } });
    const asked = await askExternal(guardRequests(request, 'public', resolve), [{ url: 'https://shop.test/', count: 2 }, { url: 'http://192.168.1.1/admin', count: 1 }], 1000, 0, async () => {});
    expect(asked?.answers).toEqual([
      { url: 'https://shop.test/', status: 200 },
      { url: 'http://192.168.1.1/admin', status: null, notAsked: 'not asked: it leads to an address on a private network (192.168.1.1), further in than the site under test' },
    ]);
    expect(asked?.unreachable).toBeUndefined();
    expect(sent).toEqual(['HEAD https://shop.test/ 0']);
  });
});

describe('the browser\'s own requests (G-270)', () => {
  it('refused when further in than the site, each host looked up once; other schemes and what is no address let go', async () => {
    const looked: string[] = [];
    const lookup: Resolve = async (host) => {
      looked.push(host);
      return names[host] ?? [];
    };
    const guard = browserGuard('public', lookup);
    expect(await guard('https://shop.test/app.js')).toBeNull();
    expect(await guard('https://intranet.test/x.css')).toBe('not asked: it leads to an address on a private network (10.1.2.3), further in than the site under test');
    expect(await guard('wss://metadata.test/socket')).toMatch(/^not asked: it leads to an address no page should lead to/);
    expect(await guard('ws://intranet.test/socket')).toMatch(/^not asked: it leads to an address on a private network/);
    expect(await guard('http://[::ffff:7f00:1]:8080/')).toMatch(/^not asked: it leads to this computer/);
    for (const other of ['data:text/html,x', 'blob:https://shop.test/1', 'about:blank', 'not a url']) expect(await guard(other)).toBeNull();
    await guard('https://intranet.test/another');
    expect(looked).toEqual(['shop.test', 'intranet.test', 'metadata.test']);
    // A site on this computer may use this computer, never a credentials address.
    const local = browserGuard('this-computer', lookup);
    expect(await local('http://127.0.0.1:9/x.js')).toBeNull();
    expect(await local('http://169.254.169.254/')).not.toBeNull();
  });
});
