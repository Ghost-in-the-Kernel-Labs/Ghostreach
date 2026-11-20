/**
 * robots.txt read when the site's certificate chain is incomplete (G-609, src/crawl/relaxed-chain.ts, fetchRobots in
 * src/crawl/robots-fetch.ts): only the two "no issuer" errors of Node earn one retry, with certificate-chain checking relaxed, on the
 * same origin, under the same destination guard; every other failure ends as it always did. Fake request clients stand in for
 * Playwright's; test/unit/robots-chain-tls.test.ts does it over real TLS.
 */
import { describe, expect, it } from 'vitest';
import { NotAsked, type Asker } from '../../src/crawl/destination.js';
import { fetchRobots } from '../../src/crawl/robots-fetch.js';
import { incompleteChain, NotRelaxed, openRelaxed, relaxedAsker, relaxedRefusal, type Relaxed } from '../../src/crawl/relaxed-chain.js';

const ORIGIN = 'https://shop.test';
const answer = (status: number, body = '', headers: Record<string, string> = {}) => ({ status: () => status, headers: () => headers, text: async () => body, url: () => `${ORIGIN}/robots.txt` });
const throwing = (message: string, code?: string): Asker => {
  const fail = async () => {
    throw Object.assign(new Error(message), code ? { code } : {});
  };
  return { get: fail, head: fail } as unknown as Asker;
};
const serving = (body: string): Asker => ({ get: async () => answer(200, body), head: async () => answer(200) }) as unknown as Asker;
function relaxedWith(asker: Asker) {
  const seen = { opened: 0, disposed: 0 };
  const relaxed: Relaxed = async () => {
    seen.opened++;
    return { asker, dispose: async () => void seen.disposed++ };
  };
  return { relaxed, seen };
}

const CHAIN_ERRORS: [string, string | undefined][] = [
  ['apiRequestContext.get: unable to verify the first certificate', undefined],
  ['apiRequestContext.get: unable to get local issuer certificate', undefined],
  // Node 24 adds a hint after the phrase (1.4: the parent's pattern, anchored at the phrase, missed it under Node 24).
  ['apiRequestContext.get: unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca', undefined],
  ['apiRequestContext.get: something', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'],
  ['apiRequestContext.get: something', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'],
  ['apiRequestContext.get: UNABLE_TO_VERIFY_LEAF_SIGNATURE\nCall log:\n  - GET https://shop.test/robots.txt', undefined],
];
const OTHER_ERRORS = [
  'apiRequestContext.get: certificate has expired',
  'apiRequestContext.get: self signed certificate',
  'apiRequestContext.get: self-signed certificate in certificate chain',
  'apiRequestContext.get: DEPTH_ZERO_SELF_SIGNED_CERT',
  "apiRequestContext.get: Hostname/IP does not match certificate's altnames: Host: shop.test. is not in the cert's altnames",
  'apiRequestContext.get: unable to get issuer certificate',
  'apiRequestContext.get: unable to verify the first certificate; and more',
  'apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:443',
  'apiRequestContext.get: getaddrinfo ENOTFOUND shop.test',
  'apiRequestContext.get: Request timed out',
];

describe('incompleteChain: which errors are an incomplete certificate chain', () => {
  it.each(CHAIN_ERRORS)('%s (code %s) is', (message, code) => {
    expect(incompleteChain(Object.assign(new Error(message), code ? { code } : {}))).toBe(true);
  });
  it.each(OTHER_ERRORS)('%s is not', (message) => {
    expect(incompleteChain(new Error(message))).toBe(false);
  });
  it('a code of another kind, and a thing that is no error, are not', () => {
    expect(incompleteChain(Object.assign(new Error('x'), { code: 'CERT_HAS_EXPIRED' }))).toBe(false);
    expect(incompleteChain('unable to verify the first certificate')).toBe(false);
    expect(incompleteChain(undefined)).toBe(false);
  });
});

describe('fetchRobots with an incomplete certificate chain (G-609)', () => {
  it.each(CHAIN_ERRORS)('%s (%s): asked once more, relaxed; the rules read, the chain noted, the relaxed client disposed', async (message, code) => {
    const { relaxed, seen } = relaxedWith(serving('User-agent: *\nDisallow: /private\n'));
    const said: string[] = [];
    const got = await fetchRobots(throwing(message, code), ORIGIN, 1000, (m) => said.push(m), 0, relaxed);
    expect(seen).toEqual({ opened: 1, disposed: 1 });
    expect(got.status).toBe(200);
    expect(got.error).toBeUndefined();
    expect(got.policy.source).toBe('parsed');
    expect(got.certificateChain).toBe('incomplete');
    const log = said.join('\n');
    expect(log).toContain('certificate chain is incomplete');
    expect(log).toContain('does not send its intermediate certificate');
    expect(log).toContain('relaxed checking');
    expect(log).toContain('Browsers repair this but some tools do not');
    expect(log).toContain('As seen from this computer');
    expect(log).toContain('TLS-intercepting proxy or antivirus');
    expect(log).toContain('NODE_EXTRA_CA_CERTS');
  });

  it.each(OTHER_ERRORS)('%s: no retry, the site is unreachable as before', async (message) => {
    const { relaxed, seen } = relaxedWith(serving(''));
    const got = await fetchRobots(throwing(message), ORIGIN, 1000, () => undefined, 0, relaxed);
    expect(seen.opened).toBe(0);
    expect(got.status).toBeNull();
    expect(got.error).toBe(message.replace(/^apiRequestContext\.get:\s*/, ''));
    expect(got.policy.source).toBe('unreachable');
    expect(got.certificateChain).toBeUndefined();
  });

  it('with no relaxed client given, a chain error ends as it always did', async () => {
    const got = await fetchRobots(throwing('apiRequestContext.get: unable to verify the first certificate'), ORIGIN, 1000, () => undefined, 0);
    expect(got).toMatchObject({ status: null, error: 'unable to verify the first certificate' });
    expect(got.certificateChain).toBeUndefined();
  });

  it('a relaxed attempt that fails too ends with the FIRST error, and is disposed; it is not tried a third time', async () => {
    let asked = 0;
    const second = {
      get: async () => {
        asked++;
        throw new Error('apiRequestContext.get: connect ECONNRESET');
      },
      head: async () => answer(200),
    } as unknown as Asker;
    const { relaxed, seen } = relaxedWith(second);
    const got = await fetchRobots(throwing('apiRequestContext.get: unable to verify the first certificate'), ORIGIN, 1000, () => undefined, 0, relaxed);
    expect(got).toMatchObject({ status: null, error: 'unable to verify the first certificate' });
    expect(got.certificateChain).toBeUndefined();
    expect(asked).toBe(1);
    expect(seen).toEqual({ opened: 1, disposed: 1 });
  });

  it('M3: nothing is said of the chain before the relaxed read succeeds, and nothing when it fails', async () => {
    const said: string[] = [];
    const second = {
      get: async () => {
        throw new Error('apiRequestContext.get: connect ECONNRESET');
      },
      head: async () => answer(200),
    } as unknown as Asker;
    await fetchRobots(throwing('apiRequestContext.get: unable to verify the first certificate'), ORIGIN, 1000, (m) => said.push(m), 0, relaxedWith(second).relaxed);
    expect(said.join('\n')).not.toMatch(/incomplete|intermediate|relaxed|chain/i);
    // and during the read itself: the claim is not yet made when the relaxed request is sent
    const during: string[] = [];
    const watching = {
      get: async () => {
        during.push(...said);
        return answer(200, '');
      },
      head: async () => answer(200),
    } as unknown as Asker;
    said.length = 0;
    await fetchRobots(throwing('apiRequestContext.get: unable to verify the first certificate'), ORIGIN, 1000, (m) => said.push(m), 0, relaxedWith(watching).relaxed);
    expect(during.join('\n')).not.toMatch(/incomplete|intermediate/i);
    expect(said.join('\n')).toContain('intermediate');
  });

  it('M2: the relaxed read is ONE request: a 503 with retry-after 20 is asked once, waits not at all, and ends as the first error', async () => {
    let gets = 0;
    const busy = {
      get: async () => {
        gets++;
        return answer(503, '', { 'retry-after': '20' });
      },
      head: async () => answer(200),
    } as unknown as Asker;
    const { relaxed, seen } = relaxedWith(busy);
    const started = Date.now();
    const got = await fetchRobots(throwing('apiRequestContext.get: unable to verify the first certificate'), ORIGIN, 1000, () => undefined, 5, relaxed);
    expect(gets).toBe(1);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(got).toMatchObject({ status: null, error: 'unable to verify the first certificate' });
    expect(got.certificateChain).toBeUndefined();
    expect(got.policy.source).toBe('unreachable');
    expect(seen.disposed).toBe(1);
  });

  it.each([302, 301, 304, 100, 600])('M-1: a relaxed read that ends on status %s is no success: the first error, no chain claim, the whole site disallowed', async (status) => {
    const said: string[] = [];
    const odd = { get: async () => answer(status, '', { location: `${ORIGIN}/robots.txt` }), head: async () => answer(200) } as unknown as Asker;
    const got = await fetchRobots(throwing('apiRequestContext.get: unable to verify the first certificate'), ORIGIN, 1000, (m) => said.push(m), 0, relaxedWith(odd).relaxed);
    expect(got).toMatchObject({ status: null, error: 'unable to verify the first certificate' });
    expect(got.certificateChain).toBeUndefined();
    expect(got.policy.source).toBe('unreachable');
    expect(said.join('\n')).not.toMatch(/intermediate|relaxed/);
  });

  it('M-2: the log of a retry that does run says an operating-system or PAC proxy is not detected', async () => {
    const said: string[] = [];
    await fetchRobots(throwing('apiRequestContext.get: unable to verify the first certificate'), ORIGIN, 1000, (m) => said.push(m), 0, relaxedWith(serving('')).relaxed);
    expect(said.join('\n')).toContain('operating-system or PAC proxy is not detected');
  });

  it('M2: a 429 on the relaxed read is the same: once, then the first error', async () => {
    let gets = 0;
    const limited = { get: async () => (gets++, answer(429)), head: async () => answer(200) } as unknown as Asker;
    const got = await fetchRobots(throwing('apiRequestContext.get: unable to verify the first certificate'), ORIGIN, 1000, () => undefined, 5, relaxedWith(limited).relaxed);
    expect(gets).toBe(1);
    expect(got.error).toBe('unable to verify the first certificate');
  });

  it('M4: a relaxed client refused (a proxy, a browser the caller gave) is not retried, and the log says why', async () => {
    const relaxed: Relaxed = async () => {
      throw new NotRelaxed('a proxy is set for this computer');
    };
    const said: string[] = [];
    const got = await fetchRobots(throwing('apiRequestContext.get: unable to verify the first certificate'), ORIGIN, 1000, (m) => said.push(m), 0, relaxed);
    expect(got).toMatchObject({ status: null, error: 'unable to verify the first certificate' });
    expect(said.join('\n')).toContain('robots.txt was not read again with relaxed checking: a proxy is set for this computer');
    expect(said.join('\n')).not.toMatch(/intermediate/);
  });

  it('a relaxed client that cannot even be made ends with the first error', async () => {
    const relaxed: Relaxed = async () => {
      throw new Error('no driver');
    };
    const got = await fetchRobots(throwing('apiRequestContext.get: unable to verify the first certificate'), ORIGIN, 1000, () => undefined, 0, relaxed);
    expect(got).toMatchObject({ status: null, error: 'unable to verify the first certificate' });
  });

  it('a relaxed answer of 404 is no rules, and the chain is still noted', async () => {
    const { relaxed } = relaxedWith({ get: async () => answer(404), head: async () => answer(404) } as unknown as Asker);
    const got = await fetchRobots(throwing('apiRequestContext.get: unable to verify the first certificate'), ORIGIN, 1000, () => undefined, 0, relaxed);
    expect(got).toMatchObject({ status: 404, certificateChain: 'incomplete' });
    expect(got.error).toBeUndefined();
  });

  it('the first attempt that works never opens a relaxed client', async () => {
    const { relaxed, seen } = relaxedWith(serving(''));
    const got = await fetchRobots(serving('User-agent: *\nAllow: /\n'), ORIGIN, 1000, () => undefined, 0, relaxed);
    expect(seen.opened).toBe(0);
    expect(got.certificateChain).toBeUndefined();
  });
});

describe('relaxedAsker: the relaxed client keeps to the origin and to the destination guard (G-243, G-609)', () => {
  const raw = (redirectTo?: string) => {
    const sent: string[] = [];
    const get = async (url: string) => {
      sent.push(url);
      return redirectTo && sent.length === 1 ? answer(301, '', { location: redirectTo }) : answer(200, 'User-agent: *\n');
    };
    return { sent, request: { get, head: get } as never };
  };
  const publicSite = async () => ['93.184.216.34'];

  it('a redirect within the origin is followed', async () => {
    const r = raw('/robots-new.txt');
    const asker = await relaxedAsker(r.request, ORIGIN, publicSite);
    expect((await asker.get(`${ORIGIN}/robots.txt`, { maxRedirects: 5 })).status()).toBe(200);
    expect(r.sent).toEqual([`${ORIGIN}/robots.txt`, `${ORIGIN}/robots-new.txt`]);
  });

  it.each(['https://other.test/robots.txt', 'http://shop.test/robots.txt', 'https://shop.test:8443/robots.txt', 'https://www.shop.test/robots.txt'])('a redirect to %s is refused, and never sent', async (to) => {
    const r = raw(to);
    const asker = await relaxedAsker(r.request, ORIGIN, publicSite);
    await expect(asker.get(`${ORIGIN}/robots.txt`, { maxRedirects: 5 })).rejects.toBeInstanceOf(NotAsked);
    expect(r.sent).toEqual([`${ORIGIN}/robots.txt`]);
  });

  it('a redirect into a private network is refused', async () => {
    const r = raw('http://169.254.169.254/latest/meta-data/');
    const asker = await relaxedAsker(r.request, ORIGIN, publicSite);
    await expect(asker.get(`${ORIGIN}/robots.txt`, { maxRedirects: 5 })).rejects.toThrow(/not asked/);
    expect(r.sent).toHaveLength(1);
  });

  it('every hop is looked up first, as the strict client does', async () => {
    const r = raw('/second');
    const looked: string[] = [];
    const asker = await relaxedAsker(r.request, ORIGIN, async (host) => {
      looked.push(host);
      return ['93.184.216.34'];
    });
    await asker.get(`${ORIGIN}/robots.txt`, { maxRedirects: 5 });
    expect(looked.filter((h) => h === 'shop.test').length).toBeGreaterThanOrEqual(3); // the site, then each of two hops
  });

  it('a name that leads into a private network is refused when the site under test is public (the guard is the same one)', async () => {
    const r = raw();
    let calls = 0;
    // The first lookup (the site's own reach) is public; the hop's own lookup answers private: refused before it is sent.
    const asker = await relaxedAsker(r.request, ORIGIN, async () => (++calls === 1 ? ['93.184.216.34'] : ['10.0.0.5']));
    await expect(asker.get(`${ORIGIN}/robots.txt`, { maxRedirects: 5 })).rejects.toBeInstanceOf(NotAsked);
    expect(r.sent).toEqual([]);
  });
});

describe('incompleteChain decides by the code, then by the first line only, anchored (L1)', () => {
  it('a hostname or url that holds the token is not the error', () => {
    expect(incompleteChain(new Error('apiRequestContext.get: getaddrinfo ENOTFOUND unable_to_verify_leaf_signature.evil'))).toBe(false);
    expect(incompleteChain(new Error('apiRequestContext.get: connect ECONNREFUSED\nCall log:\n  - GET https://x/ unable to verify the first certificate'))).toBe(false);
    expect(incompleteChain(new Error('apiRequestContext.get: certificate has expired: unable to verify the first certificate'))).toBe(false);
    expect(incompleteChain(new Error('apiRequestContext.get: x\nunable to get local issuer certificate'))).toBe(false);
  });
  it('a code decides alone', () => {
    expect(incompleteChain(Object.assign(new Error('unable to verify the first certificate'), { code: 'CERT_HAS_EXPIRED' }))).toBe(false);
  });
  it('Node\'s two phrases on the first line, with or without Playwright\'s prefix, are the error', () => {
    expect(incompleteChain(new Error('unable to verify the first certificate'))).toBe(true);
    expect(incompleteChain(new Error('apiRequestContext.get: unable to get local issuer certificate\nCall log:\n  - x'))).toBe(true);
  });
});

describe('relaxedRefusal and openRelaxed: what the relaxed client cannot carry (M4)', () => {
  it('a proxy in the environment, or a browser the caller gave, refuses it; neither, and it is allowed', () => {
    expect(relaxedRefusal({}, false)).toBeNull();
    for (const name of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) expect(relaxedRefusal({ [name]: 'http://proxy.test:3128' }, false)).toMatch(/proxy/);
    expect(relaxedRefusal({ HTTPS_PROXY: '' }, false)).toBeNull();
    expect(relaxedRefusal({}, true)).toMatch(/browser/);
  });
  it('openRelaxed throws NotRelaxed before it makes any client', async () => {
    await expect(openRelaxed('agent', ORIGIN, undefined, false, { HTTPS_PROXY: 'http://proxy.test:3128' })()).rejects.toBeInstanceOf(NotRelaxed);
    await expect(openRelaxed('agent', ORIGIN, undefined, true, {})()).rejects.toBeInstanceOf(NotRelaxed);
  });
});

describe('relaxedAsker asks for /robots.txt only (L2)', () => {
  it('any other first path is refused and never sent; same-origin redirects stay allowed', async () => {
    const sent: string[] = [];
    const get = async (url: string) => (sent.push(url), answer(200));
    const asker = await relaxedAsker({ get, head: get } as never, ORIGIN, async () => ['93.184.216.34']);
    for (const path of ['/', '/admin', '/robots.txt.bak', '/sitemap.xml']) await expect(asker.get(`${ORIGIN}${path}`)).rejects.toBeInstanceOf(NotAsked);
    await expect(asker.head(`${ORIGIN}/robots.txt`)).rejects.toBeInstanceOf(NotAsked);
    expect(sent).toEqual([]);
    await asker.get(`${ORIGIN}/robots.txt`);
    expect(sent).toEqual([`${ORIGIN}/robots.txt`]);
  });
});
