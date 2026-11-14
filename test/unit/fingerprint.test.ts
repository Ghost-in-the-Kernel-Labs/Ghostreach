import { describe, expect, it } from 'vitest';
import { fingerprintFromPaths } from '../../src/leaf/pages/fingerprint.js';

describe('fingerprintFromPaths', () => {
  it('ignores order and repeats', () => {
    const a = fingerprintFromPaths(['main', 'main/h1', 'main/table']);
    const b = fingerprintFromPaths(['main/table', 'main', 'main/h1', 'main']);
    expect(b).toEqual(a);
    expect(a.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes when the structure changes', () => {
    expect(fingerprintFromPaths(['main', 'main/h1']).hash).not.toBe(fingerprintFromPaths(['main', 'main/h2']).hash);
  });
});

