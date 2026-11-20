/**
 * How the crawl records a frame (src/crawl/readers/frames.ts; docs/FRAMES-PLAN.md): its address, the
 * one loaded when it is a page's, else the one its element asks for; same-site or not; an ad host's
 * (G-049) or not. The frames spec (test/crawl/frames.spec.ts) shows it in a browser; these are the
 * cases a local site cannot serve.
 */
import { describe, expect, it } from 'vitest';
import { frameRecord, type FrameFacts } from '../../src/crawl/readers/frames.js';

const SITE = 'https://example.com';
const facts = (more: Partial<FrameFacts>): FrameFacts => ({ xpath: '//iframe', src: null, srcdoc: false, title: null, width: 300, height: 250, shown: true, ...more });

describe('a frame, as the crawl records it', () => {
  it('keeps the address its element asks for when the browser shows an error page there (another site, not fetched)', () => {
    const record = frameRecord(facts({ src: 'https://pay.example.net/card' }), 'chrome-error://chromewebdata/', `${SITE}/checkout`, ['//iframe'], SITE);
    expect(record).toMatchObject({ url: 'https://pay.example.net/card', sameSite: false });
    expect(record.ad).toBeUndefined();
  });

  it('marks another site\'s frame on an ad host, or a subdomain of one, as an ad', () => {
    expect(frameRecord(facts({ src: 'https://tpc.googlesyndication.com/x' }), 'chrome-error://chromewebdata/', SITE, ['//iframe'], SITE).ad).toBe(true);
    expect(frameRecord(facts({ src: 'https://criteo.com/frame' }), 'chrome-error://chromewebdata/', SITE, ['//iframe'], SITE).ad).toBe(true);
    expect(frameRecord(facts({ src: 'https://notcriteo.com/frame' }), 'chrome-error://chromewebdata/', SITE, ['//iframe'], SITE).ad).toBeUndefined();
  });

  it('gives a srcdoc frame no address, and counts it, and about:blank, as the site\'s', () => {
    expect(frameRecord(facts({ srcdoc: true }), 'about:srcdoc', SITE, ['//iframe'], SITE)).toMatchObject({ url: null, sameSite: true });
    expect(frameRecord(facts({}), 'about:blank', SITE, ['//iframe'], SITE)).toMatchObject({ url: 'about:blank', sameSite: true });
  });

  it('resolves a relative address against the document that holds the frame, and survives one that is no URL', () => {
    expect(frameRecord(facts({ src: '/sample' }), '', `${SITE}/frames`, ['//iframe'], SITE)).toMatchObject({ url: `${SITE}/sample`, sameSite: true });
    expect(frameRecord(facts({ src: 'javascript:void(0)' }), '', SITE, ['//iframe'], SITE)).toMatchObject({ sameSite: false });
  });
});
