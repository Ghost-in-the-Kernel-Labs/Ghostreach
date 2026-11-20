/**
 * A tiny made-up Pokédex site for crawler tests, served from memory on a free local port.
 *
 *   /                      home: nav, a relative link, a redirect, a 404, a PDF, a robots-blocked
 *                          link, an external link, a mailto: link, a #fragment link, an image link
 *   /pokedex/all           list page (table of six Pokémon)
 *   /pokedex/<name>        one template, six pages; Charmander has one extra block
 *   /type/<type>           a second template, four pages
 *   /about                 plain page
 *   /old-list              301 -> /pokedex/all
 *   /missing (and others)  404 page
 *   /private/*             disallowed by robots.txt: the crawler must never request it
 *   /files/type-chart.pdf  must never be requested either
 *
 * Every request is logged (path, User-Agent, time) so tests can check what the crawler touched.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';

let pagesDir = join(dirname(fileURLToPath(import.meta.url)), 'pages');
const page = (name: string) => readFileSync(join(pagesDir, name), 'utf8');

const DEFAULT_ROBOTS = `# Fixture Dex robots.txt
User-agent: *
Disallow: /private/

User-agent: SomeOtherBot
Disallow: /
`;

interface Pokemon {
  name: string;
  number: string;
  type: string;
  hp: number;
  prev: string;
  next: string;
  extra?: string;
}

const POKEMON: Record<string, Pokemon> = {
  bulbasaur: { name: 'Bulbasaur', number: '0001', type: 'Grass', hp: 45, prev: 'pikachu', next: 'ivysaur' },
  ivysaur: { name: 'Ivysaur', number: '0002', type: 'Grass', hp: 60, prev: 'bulbasaur', next: 'charmander' },
  charmander: {
    name: 'Charmander', number: '0004', type: 'Fire', hp: 39, prev: 'ivysaur', next: 'squirtle',
    extra: '<div class="grid-col"><p class="evolution-note">Evolves at level 16.</p></div>',
  },
  squirtle: { name: 'Squirtle', number: '0007', type: 'Water', hp: 44, prev: 'charmander', next: 'wartortle' },
  wartortle: { name: 'Wartortle', number: '0008', type: 'Water', hp: 59, prev: 'squirtle', next: 'pikachu' },
  pikachu: { name: 'Pikachu', number: '0025', type: 'Electric', hp: 35, prev: 'wartortle', next: 'bulbasaur' },
};

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(values[k] ?? ''));
}

function pokemonPage(slug: string): string | null {
  const p = POKEMON[slug];
  if (!p) return null;
  return fill(page('pokemon.html'), { ...p, typeSlug: p.type.toLowerCase(), extra: p.extra ?? '' });
}

function typePage(slug: string): string | null {
  const members = Object.entries(POKEMON).filter(([, p]) => p.type.toLowerCase() === slug);
  if (members.length === 0) return null;
  const type = members[0][1].type;
  const items = members.map(([s, p]) => `<li><a href="/pokedex/${s}">${p.name}</a></li>`).join('');
  return fill(page('type.html'), { type, members: items });
}

interface LoggedRequest {
  path: string;
  host: string;
  userAgent: string;
  time: number;
}

export interface FixtureSiteOptions {
  /** robots.txt body, or a status code to answer /robots.txt with instead; a list: one answer per request, the last kept. */
  robots?: string | number | (string | number)[];
  /**
   * Handle a request before the normal site does. Return true when it has answered.
   * Tests use this to add failures, rate limiting or redirects.
   */
  override?: (req: IncomingMessage, res: ServerResponse, path: string) => boolean;
  /**
   * A firewall in front of the site (G-776): while it gives a status, every request answers it, robots.txt and a page that
   * does not exist alike, as a site answers a network it keeps out; null lets the request through to the site. A crawl
   * run with it open and a suite run with it shut is Ghost's CI run of 2026-11-13.
   */
  refuses?: () => number | null;
  /** Fixed port (default: any free port). */
  port?: number;
  /** Where the HTML pages are (default: ./pages next to this file). */
  pagesDir?: string;
}

export interface FixtureSite {
  /** http://127.0.0.1:<port> */
  origin: string;
  port: number;
  requests: LoggedRequest[];
  /** Paths of page requests (everything except /robots.txt). */
  pagePaths(): string[];
  close(): Promise<void>;
}

function send(res: ServerResponse, status: number, body: string, type = 'text/html; charset=utf-8'): void {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

export async function startFixtureSite(options: FixtureSiteOptions = {}): Promise<FixtureSite> {
  const requests: LoggedRequest[] = [];
  const robots = options.robots ?? DEFAULT_ROBOTS;
  if (options.pagesDir) pagesDir = options.pagesDir;

  const handler = (req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    requests.push({ path, host: req.headers.host ?? '', userAgent: req.headers['user-agent'] ?? '', time: Date.now() });

    const refused = options.refuses?.();
    if (refused) return send(res, refused, '<!doctype html><title>Access denied</title><h1>Access denied</h1><p>You do not have permission to access this server.</p>');
    if (options.override?.(req, res, path)) return;

    if (path === '/robots.txt') {
      const asked = requests.filter((r) => r.path === '/robots.txt').length;
      const answer = Array.isArray(robots) ? robots[Math.min(asked, robots.length) - 1] : robots;
      if (typeof answer === 'number') return send(res, answer, 'robots unavailable', 'text/plain');
      return send(res, 200, answer, 'text/plain');
    }
    // The logo the home page shows: never fetched by the crawl, asked for once after it (G-203).
    if (path === '/img/logo.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(Buffer.from('89504e470d0a1a0a', 'hex'));
    }
    if (path === '/') return send(res, 200, page('home.html'));
    if (path === '/pokedex/all') return send(res, 200, page('list.html'));
    if (path === '/about') return send(res, 200, page('about.html'));
    if (path === '/old-list') {
      res.writeHead(301, { Location: '/pokedex/all' });
      return res.end();
    }
    const pokemon = /^\/pokedex\/([a-z]+)$/.exec(path);
    const pokemonHtml = pokemon && pokemonPage(pokemon[1]);
    if (pokemonHtml) return send(res, 200, pokemonHtml);
    const type = /^\/type\/([a-z]+)$/.exec(path);
    const typeHtml = type && typePage(type[1]);
    if (typeHtml) return send(res, 200, typeHtml);
    if (path.startsWith('/private/')) return send(res, 200, '<!doctype html><title>Admin</title><h1>Secret</h1>');
    if (path === '/files/type-chart.pdf') return send(res, 200, '%PDF-1.4 made-up', 'application/pdf');
    return send(res, 404, page('not-found.html'));
  };

  // Loopback only, so the site is never reachable from other machines (and Windows Firewall has
  // nothing to ask about). IPv4 first; then the same port on IPv6 loopback, so that "localhost"
  // reaches it whichever address it resolves to. Tests use localhost as a second origin.
  const servers = [createServer(handler)];
  await new Promise<void>((resolve, reject) => {
    servers[0].once('error', reject);
    servers[0].listen(options.port ?? 0, '127.0.0.1', resolve);
  });
  const port = (servers[0].address() as AddressInfo).port;
  const v6 = createServer(handler);
  const v6Up = await new Promise<boolean>((resolve) => {
    v6.once('error', () => resolve(false)); // no IPv6 on this machine: 127.0.0.1 is enough
    v6.listen(port, '::1', () => resolve(true));
  });
  if (v6Up) servers.push(v6);

  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    requests,
    pagePaths: () => requests.filter((r) => r.path !== '/robots.txt').map((r) => r.path),
    close: async () => {
      await Promise.all(
        servers.map(
          (server) =>
            new Promise<void>((resolve, reject) => {
              server.closeAllConnections();
              server.close((e) => (e ? reject(e) : resolve()));
            }),
        ),
      );
    },
  };
}
