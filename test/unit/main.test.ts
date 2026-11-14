import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../src/cli/main.js';

const said = (): string[] => vi.mocked(console.log).mock.calls.map((c) => String(c[0]));

describe('ghostreach <site> (GR-003: no flag)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('with no site, prints what it takes and exits 1', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(main([])).toBe(1);
    expect(said()).toEqual(['ghostreach <site>: reviews the site and writes its Suite Builder PDF. Nothing else is typed.']);
  });
  it('--help is the one option, and exits 0 with the same sentence', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(main(['--help'])).toBe(0);
    expect(said()[0]).toMatch(/^ghostreach <site>/);
  });
  it('any other option is refused as a missing site', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(main(['--short', 'example.com'])).toBe(1);
  });
  it('with a site, says the review is not yet built and exits 2', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(main(['example.com'])).toBe(2);
    expect(said()[0]).toContain('The review of example.com arrives with Phase 1');
  });
});
