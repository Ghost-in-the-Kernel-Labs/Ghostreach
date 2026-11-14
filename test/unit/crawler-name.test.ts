/**
 * The name the crawler goes by (GR-017): forecursor, the website's name, in its user agent, the robots.txt group it obeys, the
 * address it asks for a not-found page, the globals its in-page scripts set and the crawl file it writes. What a site's owner
 * reads in a log is a name a search finds. The parent's crawl files (tool `suite-builder`), which 1.5 and 1.6 hold Ghostreach to,
 * are still read; a robots.txt group written for the name the crawler went by before is still obeyed.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_AGENT, ROBOTS_TOKENS } from '../../src/leaf/report.js';
import { isAllowed, parseRobots } from '../../src/crawl/robots.js';
import { notFoundPath } from '../../src/leaf/pages/url.js';
import { readCrawlReport } from '../../src/crawl/report-read.js';
import { CONTROLS_SCRIPT } from '../../src/crawl/controls-script.js';
import { READING_SCRIPT } from '../../src/crawl/reading-script.js';

const allowed = (robots: string, path: string) => isAllowed(parseRobots(robots, ROBOTS_TOKENS), path);

describe('the crawler is forecursor (GR-017)', () => {
  it('names itself in the standard bot form, with the address a search finds', () => {
    expect(DEFAULT_USER_AGENT).toBe('Mozilla/5.0 (compatible; forecursor/1.0; +https://forecursor.com)');
  });

  it("obeys a robots.txt group for forecursor, and one for the name it went by before, over the * group", () => {
    expect(allowed('User-agent: *\nDisallow: /\n\nUser-agent: Forecursor\nDisallow: /admin\n', '/shop')).toBe(true);
    expect(allowed('User-agent: *\nDisallow: /\n\nUser-agent: Forecursor\nDisallow: /admin\n', '/admin')).toBe(false);
    expect(allowed('User-agent: *\nDisallow: /private\n\nUser-agent: SuiteBuilder\nDisallow: /\n', '/shop')).toBe(false);
    const both = 'User-agent: forecursor\nDisallow: /a\n\nUser-agent: SuiteBuilder\nDisallow: /b\n\nUser-agent: *\nDisallow: /c\n';
    expect([allowed(both, '/a'), allowed(both, '/b'), allowed(both, '/c')]).toEqual([false, false, true]);
    expect(allowed('User-agent: *\nDisallow: /private\n\nUser-agent: OtherBot\nDisallow: /\n', '/private')).toBe(false);
    expect(allowed('User-agent: *\nDisallow: /private\n\nUser-agent: OtherBot\nDisallow: /\n', '/shop')).toBe(true);
  });

  it('asks for its not-found page under its own name', () => {
    expect(notFoundPath('https://example.com')).toMatch(/^\/forecursor-no-such-page-[0-9a-f]{8}$/);
  });

  it("sets its in-page globals under its own name, none under the parent's", () => {
    for (const script of [READING_SCRIPT, CONTROLS_SCRIPT]) {
      expect(script).toContain('__forecursor');
      expect(script).not.toMatch(/suite.?builder/i);
    }
  });

  it("reads its own crawl files and the parent's, and refuses any other", () => {
    const file = (tool: string) => JSON.stringify({ tool, reportVersion: 1, pages: [], edges: [] });
    expect(readCrawlReport(file('forecursor'), 'a.crawl.json').tool).toBe('forecursor');
    expect(readCrawlReport(file('suite-builder'), 'b.crawl.json').tool).toBe('suite-builder');
    expect(() => readCrawlReport(file('other'), 'c.crawl.json')).toThrow(/^c\.crawl\.json is not a crawl report\.$/);
  });
});
