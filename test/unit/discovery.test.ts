/**
 * The crawl budget (Ghost, 2026-09-29): stop once SATURATION_PAGES pages in a row show nothing new. The parent's summary lines
 * (`budgetLines`) were cut at 1.2, and their cases with them (docs/CUT.md).
 */
import { describe, expect, it } from 'vitest';
import { Discovery } from '../../src/crawl/discovery.js';
import { fingerprintFromPaths } from '../../src/leaf/pages/fingerprint.js';

const shape = (name: string) => fingerprintFromPaths(Array.from({ length: 12 }, (_, i) => `main/div.${name}/p.row${i}`));

describe('Discovery', () => {
  it('a new shape or a new address pattern is new; more of the same is not', () => {
    const d = new Discovery(3);
    expect(d.see(1, 'https://x.test/', shape('home'))).toBe(true);
    expect(d.see(2, 'https://x.test/pokedex/bulbasaur', shape('dex'))).toBe(true);
    expect(d.see(3, 'https://x.test/pokedex/ivysaur', shape('dex'))).toBe(false);
    // Same shape, new pattern (a site builder draws every page alike): still new.
    expect(d.see(4, 'https://x.test/careers/jobs', shape('dex'))).toBe(true);
    expect(d.newAt).toEqual([1, 2, 4]);
  });

  it('is saturated after `patience` pages in a row with nothing new', () => {
    const d = new Discovery(3);
    d.see(1, 'https://x.test/pokedex/a', shape('dex'));
    for (let n = 2; n <= 4; n++) {
      expect(d.saturated).toBe(false);
      d.see(n, `https://x.test/pokedex/${n}`, shape('dex'));
    }
    expect(d.saturated).toBe(true);
  });
});
