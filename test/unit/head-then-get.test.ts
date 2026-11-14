/**
 * A HEAD that answers an error is confirmed by a GET before anything is said broken (G-731). Found on the first
 * authorized real-site run (G-730, 2026-11-11): the site's Pages Functions answer GET only, so every HEAD was a 404,
 * and SITE-30 said 12 photos a visitor sees were "broken: visitors see an empty box". A browser asks with GET.
 */
import { describe, expect, it } from 'vitest';
import { askDowngrades, askExternal, askImages } from '../../src/crawl/site-probe.js';

const none = async () => undefined;

/** A server whose GET answers as given, and whose HEAD answers 404 for every address (as the site did). */
function getOnly(getStatus: (url: string) => number) {
  const asked: string[] = [];
  const reply = (method: 'HEAD' | 'GET') => async (url: string) => {
    asked.push(`${method} ${url}`);
    const status = method === 'HEAD' ? 404 : getStatus(url);
    return { status: () => status, url: () => url, headers: () => ({}), text: async () => '' };
  };
  return { asked, request: { head: reply('HEAD'), get: reply('GET') } as never };
}

describe('a HEAD error is confirmed by a GET (G-731)', () => {
  it('an image a GET loads is not broken, though its HEAD answered 404', async () => {
    const { asked, request } = getOnly((url) => (url.endsWith('gone.jpg') ? 404 : 200));
    const images = new Map([['http://site.test/media/a-w.jpg', '/'], ['http://site.test/media/gone.jpg', '/about']]);
    const result = await askImages(request, 'http://site.test', images, 1000, none);
    expect(result).toEqual({ seen: 2, asked: 2, broken: [{ url: 'http://site.test/media/gone.jpg', status: 404, page: '/about' }] });
    expect(asked).toContain('GET http://site.test/media/a-w.jpg');
  });

  it('a downgraded address a GET reaches is said as the GET answered', async () => {
    const { request } = getOnly(() => 200);
    expect(await askDowngrades(request, ['http://site.test/x'], 1000, none)).toEqual({ seen: 1, answers: [{ url: 'http://site.test/x', status: 200 }] });
  });

  it('another site\'s link a GET reaches is not dead', async () => {
    const { request } = getOnly(() => 200);
    const result = await askExternal(request, [{ url: 'https://other.test/page', count: 1 }], 1000, 0, none);
    expect(result?.answers).toEqual([{ url: 'https://other.test/page', status: 200 }]);
  });
});
