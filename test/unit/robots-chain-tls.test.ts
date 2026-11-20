/**
 * robots.txt over real TLS (G-609): a local https server whose certificate is signed by a CA the client does not hold and that
 * sends no intermediate, so Playwright's request client (Node's TLS) fails as it does on a site with an incomplete chain; the
 * relaxed retry then reads robots.txt, and a self-signed certificate does not earn one. The keys are made here, by the openssl
 * binary, into a temporary folder removed afterwards: no key file is in the repository (the same set-up as
 * test/crawl/site-probe.spec.ts). Node reports a leaf whose issuer it does not hold as UNABLE_TO_VERIFY_LEAF_SIGNATURE, the same
 * error as a missing intermediate; a server a root the client trusts signs is not reproduced here (it needs the client's trust
 * store changed), the error matching is held by test/unit/robots-chain.test.ts.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type Server } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { guardedRequests } from '../../src/crawl/destination.js';
import { fetchRobots } from '../../src/crawl/robots-fetch.js';
import { openRelaxed } from '../../src/crawl/relaxed-chain.js';

const openssl = (...args: string[]) => execFileSync('openssl', args, { stdio: 'ignore' });
let dir = '';
const servers: Server[] = [];

const hasOpenssl = (() => {
  try {
    openssl('version');
    return true;
  } catch {
    return false;
  }
})();

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
const plain: Handler = (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' }).end(req.url === '/robots.txt' ? 'User-agent: *\nDisallow: /secret\n' : 'ok');
};

async function serve(key: string, cert: string, handler: Handler = plain): Promise<string> {
  const server = createServer({ key: readFileSync(join(dir, key)), cert: readFileSync(join(dir, cert)) }, handler);
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return `https://127.0.0.1:${(server.address() as { port: number }).port}`;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'chain-'));
  const ext = join(dir, 'leaf.ext');
  writeFileSync(ext, 'subjectAltName=IP:127.0.0.1\n');
  openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=Test Only CA', '-keyout', join(dir, 'ca.key'), '-out', join(dir, 'ca.pem'));
  openssl('req', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=127.0.0.1', '-keyout', join(dir, 'leaf.key'), '-out', join(dir, 'leaf.csr'));
  openssl('x509', '-req', '-in', join(dir, 'leaf.csr'), '-CA', join(dir, 'ca.pem'), '-CAkey', join(dir, 'ca.key'), '-CAcreateserial', '-days', '2', '-extfile', ext, '-out', join(dir, 'leaf.pem'));
  openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', join(dir, 'self.key'), '-out', join(dir, 'self.pem'));
}, 60_000);

afterAll(async () => {
  for (const s of servers) await new Promise((done) => s.close(done));
  if (dir) rmSync(dir, { recursive: true, force: true });
});

// Without the openssl binary there is no certificate to make: the file skips, it does not fail.
describe.skipIf(!hasOpenssl)('robots.txt over real TLS (G-609)', () => {
  it('a leaf whose issuer the client does not hold: refused strictly, then read once with relaxed checking, the chain noted', async () => {
    const origin = await serve('leaf.key', 'leaf.pem');
    const strict = await request.newContext();
    try {
      const said: string[] = [];
      const got = await fetchRobots(await guardedRequests({ request: strict }, origin), origin, 10_000, (m) => said.push(m), 0, openRelaxed('test-agent', origin, undefined, false, {}));
      expect(said.join('\n')).toContain('certificate chain is incomplete');
      expect(got).toMatchObject({ status: 200, certificateChain: 'incomplete' });
      expect(got.error).toBeUndefined();
      expect(got.policy.source).toBe('parsed');
    } finally {
      await strict.dispose();
    }
  }, 60_000);

  it('without the relaxed client the same server is unreachable, as before', async () => {
    const origin = await serve('leaf.key', 'leaf.pem');
    const strict = await request.newContext();
    try {
      const got = await fetchRobots(await guardedRequests({ request: strict }, origin), origin, 10_000, () => undefined, 0);
      expect(got.status).toBeNull();
      expect(got.error).toMatch(/unable to verify the first certificate|unable to get local issuer certificate/);
      expect(got.certificateChain).toBeUndefined();
    } finally {
      await strict.dispose();
    }
  }, 60_000);

  it('a self-signed certificate earns no retry', async () => {
    const origin = await serve('self.key', 'self.pem');
    const strict = await request.newContext();
    try {
      const got = await fetchRobots(await guardedRequests({ request: strict }, origin), origin, 10_000, () => undefined, 0, openRelaxed('test-agent', origin, undefined, false, {}));
      expect(got.status).toBeNull();
      expect(got.error).toMatch(/self[- ]signed/i);
      expect(got.certificateChain).toBeUndefined();
    } finally {
      await strict.dispose();
    }
  }, 60_000);

  it('M1: a 302 to another origin is refused on the relaxed read: the other server is never reached, whatever the client follows', async () => {
    let reachedB = 0;
    const b = await serve('leaf.key', 'leaf.pem', (_req, res) => {
      reachedB++;
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('User-agent: *\nAllow: /\n');
    });
    const a = await serve('leaf.key', 'leaf.pem', (_req, res) => {
      res.writeHead(302, { Location: `${b}/robots.txt` }).end();
    });
    const strict = await request.newContext();
    try {
      const said: string[] = [];
      const got = await fetchRobots(await guardedRequests({ request: strict }, a), a, 10_000, (m) => said.push(m), 0, openRelaxed('test-agent', a, undefined, false, {}));
      expect(reachedB).toBe(0);
      expect(got.status).toBeNull();
      expect(got.certificateChain).toBeUndefined();
      expect(got.policy.source).toBe('unreachable');
      expect(said.join('\n')).not.toMatch(/intermediate/);
    } finally {
      await strict.dispose();
    }
  }, 60_000);

  it('M1: a redirect within the origin is followed on the relaxed read', async () => {
    const a = await serve('leaf.key', 'leaf.pem', (req, res) => {
      if (req.url === '/robots.txt') res.writeHead(302, { Location: '/rules.txt' }).end();
      else res.writeHead(200, { 'Content-Type': 'text/plain' }).end('User-agent: *\nDisallow: /x\n');
    });
    const strict = await request.newContext();
    try {
      const got = await fetchRobots(await guardedRequests({ request: strict }, a), a, 10_000, () => undefined, 0, openRelaxed('test-agent', a, undefined, false, {}));
      expect(got).toMatchObject({ status: 200, certificateChain: 'incomplete' });
    } finally {
      await strict.dispose();
    }
  }, 60_000);
});
