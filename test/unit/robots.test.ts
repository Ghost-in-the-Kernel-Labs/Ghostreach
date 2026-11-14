import { describe, expect, it } from 'vitest';
import { ALLOW_ALL, DISALLOW_ALL, isAllowed, parseRobots } from '../../src/crawl/robots.js';
import { H } from '../../src/leaf/heuristics/suite.js';

const allowed = (robots: string, path: string, token = 'SuiteBuilder') => isAllowed(parseRobots(robots, token), path);

describe('robots.txt groups', () => {
  it('uses the * group when no group names the crawler', () => {
    const txt = 'User-agent: *\nDisallow: /private/\n';
    expect(allowed(txt, '/private/x')).toBe(false);
    expect(allowed(txt, '/public')).toBe(true);
  });

  it('prefers the group naming the crawler, case-insensitively, and ignores *', () => {
    const txt = 'User-agent: *\nDisallow: /\n\nUser-agent: suitebuilder\nDisallow: /admin\n';
    expect(allowed(txt, '/pokedex')).toBe(true);
    expect(allowed(txt, '/admin')).toBe(false);
  });

  it('merges several groups for the same agent', () => {
    const txt = 'User-agent: SuiteBuilder\nDisallow: /a\n\nUser-agent: Other\nDisallow: /b\n\nUser-agent: SuiteBuilder\nDisallow: /c\n';
    expect(allowed(txt, '/a')).toBe(false);
    expect(allowed(txt, '/b')).toBe(true);
    expect(allowed(txt, '/c')).toBe(false);
  });

  it('lets consecutive user-agent lines share one group', () => {
    const txt = 'User-agent: Other\nUser-agent: SuiteBuilder\nDisallow: /x\n';
    expect(allowed(txt, '/x')).toBe(false);
  });

  it('allows everything when no group applies', () => {
    expect(allowed('User-agent: Other\nDisallow: /\n', '/anything')).toBe(true);
    expect(allowed('', '/anything')).toBe(true);
  });

  it('ignores comments, blank lines, unknown keys and rules before any group', () => {
    const txt = 'Disallow: /early\n# comment\nSitemap: https://x/sitemap.xml\n\nUser-agent: * # everyone\nDisallow: /late # trailing\n';
    expect(allowed(txt, '/early')).toBe(true);
    expect(allowed(txt, '/late')).toBe(false);
  });

  it('treats an empty Disallow as allow-all', () => {
    expect(allowed('User-agent: *\nDisallow:\n', '/anything')).toBe(true);
  });

  it('handles Windows line endings', () => {
    expect(allowed('User-agent: *\r\nDisallow: /x\r\n', '/x')).toBe(false);
  });
});

describe('robots.txt rule matching (RFC 9309)', () => {
  it('matches paths by prefix', () => {
    const txt = 'User-agent: *\nDisallow: /fish\n';
    expect(allowed(txt, '/fish')).toBe(false);
    expect(allowed(txt, '/fish.html')).toBe(false);
    expect(allowed(txt, '/fish/salmon')).toBe(false);
    expect(allowed(txt, '/Fish')).toBe(true); // paths are case-sensitive
    expect(allowed(txt, '/catfish')).toBe(true);
  });

  it('lets the longest matching rule win', () => {
    const txt = 'User-agent: *\nDisallow: /pokedex/\nAllow: /pokedex/all\n';
    expect(allowed(txt, '/pokedex/all')).toBe(true);
    expect(allowed(txt, '/pokedex/bulbasaur')).toBe(false);
  });

  it('lets Allow win a tie', () => {
    expect(allowed('User-agent: *\nDisallow: /page\nAllow: /page\n', '/page')).toBe(true);
  });

  it('supports * wildcards', () => {
    const txt = 'User-agent: *\nDisallow: /*.php\nDisallow: /search*q=\n';
    expect(allowed(txt, '/index.php')).toBe(false);
    expect(allowed(txt, '/a/b/c.php?x=1')).toBe(false);
    expect(allowed(txt, '/search?q=bulbasaur')).toBe(false);
    expect(allowed(txt, '/index.html')).toBe(true);
  });

  it('supports $ to anchor the end', () => {
    const txt = 'User-agent: *\nDisallow: /*.pdf$\n';
    expect(allowed(txt, '/files/chart.pdf')).toBe(false);
    expect(allowed(txt, '/files/chart.pdf?download=1')).toBe(true);
  });

  it('matches the query string too', () => {
    expect(allowed('User-agent: *\nDisallow: /list?sort=\n', '/list?sort=name')).toBe(false);
    expect(allowed('User-agent: *\nDisallow: /list?sort=\n', '/list')).toBe(true);
  });

  it('treats regex characters in rules literally', () => {
    const txt = 'User-agent: *\nDisallow: /a+b(c)\n';
    expect(allowed(txt, '/a+b(c)')).toBe(false);
    expect(allowed(txt, '/aab(c)')).toBe(true);
  });

  it('compares percent-encoded and plain paths alike', () => {
    expect(allowed('User-agent: *\nDisallow: /pokémon\n', '/pok%C3%A9mon')).toBe(false);
    expect(allowed('User-agent: *\nDisallow: /pok%C3%A9mon\n', '/pokémon')).toBe(false);
  });

  it('always allows /robots.txt itself', () => {
    expect(allowed('User-agent: *\nDisallow: /\n', '/robots.txt')).toBe(true);
  });
});

describe('Crawl-delay and fixed policies', () => {
  it('reads Crawl-delay for the chosen group', () => {
    expect(parseRobots('User-agent: *\nCrawl-delay: 2.5\n', 'SuiteBuilder').crawlDelaySeconds).toBe(2.5);
    expect(parseRobots('User-agent: Other\nCrawl-delay: 9\n', 'SuiteBuilder').crawlDelaySeconds).toBeNull();
    expect(parseRobots('User-agent: *\nCrawl-delay: soon\n', 'SuiteBuilder').crawlDelaySeconds).toBeNull();
  });

  it('ALLOW_ALL allows and DISALLOW_ALL blocks everything', () => {
    expect(isAllowed(ALLOW_ALL, '/x')).toBe(true);
    expect(isAllowed(DISALLOW_ALL, '/')).toBe(false);
    expect(isAllowed(DISALLOW_ALL, '/x')).toBe(false);
  });
});

// Fable's review of 2026-10-11, B9: the site writes robots.txt, so it is hostile input too.
describe('robots.txt from a hostile or careless site', () => {
  it('reads a first group behind a byte-order mark', () => {
    const policy = parseRobots('\uFEFFUser-agent: *\nDisallow: /private', 'SuiteBuilder');
    expect(isAllowed(policy, '/private/x')).toBe(false);
  });

  it('matches a pattern built to make a regular expression backtrack, in well under a second', () => {
    const policy = parseRobots(`User-agent: *\nDisallow: /${'*a'.repeat(24)}b`, 'SuiteBuilder');
    const started = Date.now();
    expect(isAllowed(policy, `/${'a'.repeat(40)}`)).toBe(true);
    expect(isAllowed(policy, `/${'a'.repeat(30)}b`)).toBe(false);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('keeps the wildcards\' meaning: a star anywhere, a dollar at the end', () => {
    const policy = parseRobots('User-agent: *\nDisallow: /*.pdf$\nDisallow: /shop/*/cart\nAllow: /shop/*/cart/help', 'SuiteBuilder');
    expect(isAllowed(policy, '/docs/a.pdf')).toBe(false);
    expect(isAllowed(policy, '/docs/a.pdf?x=1')).toBe(true);
    expect(isAllowed(policy, '/shop/eu/cart')).toBe(false);
    expect(isAllowed(policy, '/shop/eu/cart/help')).toBe(true);
    expect(isAllowed(policy, '/shop/cart')).toBe(true);
  });
});

describe('a robots.txt longer than the crawl reads (Fable\'s review, C3)', () => {
  it(`reads its first ${H.ROBOTS_MAX_CHARS} characters, RFC 9309's 500 KiB, and ignores the rest`, () => {
    const filler = `# ${'x'.repeat(98)}\n`.repeat(Math.ceil(H.ROBOTS_MAX_CHARS / 100));
    const policy = parseRobots(`User-agent: *\nDisallow: /early\n${filler}Disallow: /late\n`, 'SuiteBuilder');
    expect(isAllowed(policy, '/early')).toBe(false);
    expect(isAllowed(policy, '/late')).toBe(true);
  });
});
