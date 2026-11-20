/**
 * Every address a site's name points to, tried for a connection (G-139, SITE-06): one that refuses
 * is found; one of a kind (IPv6) that no address of that kind answered is this computer's network,
 * not the site's; a site given by IP address is not looked up.
 */
import { createServer, type Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { joinedLookup, probeAddresses } from '../../src/crawl/addresses.js';
import { deadAddresses } from '../../src/findings/findings.js';
import { H } from '../../src/leaf/heuristics/java-suite.js';

let server: Server;
let port = 0;

beforeAll(async () => {
  server = createServer((socket) => socket.end());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('the addresses a site name points to (G-139)', () => {
  it('tries each once: the one listening answers, the others are said with why', async () => {
    const lookup = async () => [{ address: '127.0.0.1', family: 4 }, { address: '127.0.0.2', family: 4 }, { address: '::1', family: 6 }, { address: '127.0.0.1', family: 4 }];
    const found = await probeAddresses(`http://site.test:${port}`, lookup);
    expect(found?.map((a) => [a.address, a.family, a.answered])).toEqual([['127.0.0.1', 4, true], ['127.0.0.2', 4, false], ['::1', 6, false]]);
    expect(found?.[1].error).toMatch(/ECONNREFUSED|EADDRNOTAVAIL/);
    // 127.0.0.2 failed where another IPv4 address answered: the site's. ::1 failed with no IPv6 answering: perhaps this computer's.
    expect(deadAddresses(found).map((a) => a.address)).toEqual(['127.0.0.2']);
  });

  it('joins what the computer\'s cache and the DNS server each say: the cache can hold one address of several (Site G, 2026-10-03)', async () => {
    const cache = async () => [{ address: '127.0.0.1', family: 4 }];
    const server = async () => [{ address: '127.0.0.1', family: 4 }, { address: '127.0.0.2', family: 4 }];
    const noIpv6 = async () => { throw new Error('ENODATA'); };
    const found = await probeAddresses(`http://site.test:${port}`, joinedLookup(cache, server, noIpv6));
    expect(deadAddresses(found).map((a) => a.address)).toEqual(['127.0.0.2']);
    await expect(joinedLookup(noIpv6, noIpv6)('site.test')).rejects.toThrow('does not resolve');
  });

  it('a site given by IP address, or a name that does not resolve, is not tried', async () => {
    expect(await probeAddresses(`http://127.0.0.1:${port}`)).toBeUndefined();
    expect(await probeAddresses('http://site.test', async () => { throw new Error('ENOTFOUND'); })).toBeUndefined();
    expect(deadAddresses(undefined)).toEqual([]);
    expect(H.ADDRESS_TIMEOUT_MS).toBe(5000);
  });
});
