/**
 * The probes after the crawl and other hosts (G-335), on fakes: another host's images are asked, and a Sitemap: line naming another
 * host is. The parent's cases of `--offline` (what it closed) went with the flag at 1.3; the cases that hold without it stay
 * (docs/CUT.md).
 */
import { describe, expect, it } from 'vitest';
import { askImages, probeSite } from '../../src/crawl/site-probe.js';

const ORIGIN = 'http://site.test';
const none = async () => undefined;

/** A request client that records what it is asked. */
function asker(status = 200) {
  const asked: string[] = [];
  const answer = async (url: string) => (asked.push(url), { status: () => status, headers: () => ({}), text: async () => '' });
  return { asked, request: { get: answer, head: answer } as never };
}

describe('images (askImages)', () => {
  const images = new Map([
    ['http://cdn.test/a.png', '/one'],
    ['http://site.test/b.png', '/one'],
    ['http://site.test/c.png', '/two'],
    ['http://other.test/d.png', '/two'],
  ]);

  it('the site\'s own and another host\'s are asked, and nothing is said of other hosts', async () => {
    const { asked, request } = asker();
    const result = await askImages(request, ORIGIN, images, 1000, none);
    expect(asked).toHaveLength(4);
    expect(result).toEqual({ seen: 4, asked: 4 });
  });
});

describe('a Sitemap: line (probeSite)', () => {
  const sitemapOf = async (sitemaps: string[]) => {
    const { asked, request } = asker(404);
    const probe = await probeSite(request, ORIGIN, sitemaps, [], 1000, none);
    return { asked: asked.filter((u) => /map/.test(u)), probe };
  };

  it('one naming another host is asked', async () => {
    const { asked } = await sitemapOf(['https://cdn.test/maps/main.xml']);
    expect(asked).toEqual(['https://cdn.test/maps/main.xml']);
  });

  it('the site\'s own Sitemap: line is asked, even on its other scheme', async () => {
    for (const own of ['http://site.test/maps/main.xml', 'https://site.test/maps/main.xml']) {
      const { asked } = await sitemapOf([own]);
      expect(asked).toEqual([own]);
    }
  });

  it('with no Sitemap: line the site\'s own /sitemap.xml is asked, and there is nothing to say of one', async () => {
    const { asked, probe } = await sitemapOf([]);
    expect(asked).toEqual(['http://site.test/sitemap.xml']);
    expect(probe.sitemap).toEqual({ url: 'http://site.test/sitemap.xml', status: 404 });
  });
});
