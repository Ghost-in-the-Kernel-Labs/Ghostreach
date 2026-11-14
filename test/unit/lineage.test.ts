/**
 * The lineage check (J-053) on planted files: what it finds, what its allow-list lets through and where. The packed tarball itself
 * is held to it by test/crawl/package.spec.ts (the medium gate).
 */
import { describe, expect, it } from 'vitest';
import { ALLOWED, leaks, unused } from '../support/lineage.js';
import { CONTROLS_SCRIPT } from '../../src/crawl/controls-script.js';
import { READING_SCRIPT } from '../../src/crawl/reading-script.js';

describe('the lineage check', () => {
  it('finds each planted marker', () => {
    const planted = [
      'x = 1; // G-450',
      'see GR-013 and C-040 and J-019',
      'at a4c8045, as CUT.md says',
      'stamped from Ghost-Core',
      'https://github.com/x/suite-builder',
      'Suite Builder',
      'from src/kits and src/model, the Suite IR',
      "the parent's audit; as the parent does",
      'copied from it, cut from it, cut out of it',
      'run suite build <site>',
    ];
    const found = leaks(planted.map((text, i) => ({ path: `dist/f${i}.js`, text })));
    expect(found.map((line) => line.split(':')[0])).toEqual([
      'dist/f0.js', ...Array(3).fill('dist/f1.js'), ...Array(2).fill('dist/f2.js'), 'dist/f3.js', 'dist/f4.js', 'dist/f5.js',
      ...Array(3).fill('dist/f6.js'), ...Array(2).fill('dist/f7.js'), ...Array(3).fill('dist/f8.js'), 'dist/f9.js',
    ]);
  });

  it('lets an allowed string through in its own file only, and nothing beside it', () => {
    const byline = ALLOWED.find((a) => a.file === 'dist/leaf/words.js')!;
    expect(leaks([{ path: byline.file, text: `export const BYLINE = ${byline.text};` }])).toEqual([]);
    expect(leaks([{ path: 'dist/other.js', text: byline.text }])).toEqual([`dist/other.js: the parent's name "Suite Builder"`]);
    expect(leaks([{ path: byline.file, text: `${byline.text}; // Suite Builder G-636` }])).toEqual([
      `dist/leaf/words.js: a decision id of the parent (G-nnn) "G-636"`,
      `dist/leaf/words.js: the parent's name "Suite Builder"`,
    ]);
    expect(unused([{ path: byline.file, text: 'nothing' }], [byline])).toEqual([`dist/leaf/words.js: "${byline.text}"`]);
  });

  it('passes the DOM words and ids that only look like a marker', () => {
    const text = 'for (let a = el.parentElement; a; a = a.parentElement) {} const parent = `//x`; "SITE-22"; "REV-07"; "XG-1234"';
    expect(leaks([{ path: 'dist/a.js', text }])).toEqual([]);
  });

  it("finds no comment line in the in-page scripts, which ship as strings tsc's removeComments cannot reach", () => {
    for (const script of [CONTROLS_SCRIPT, READING_SCRIPT]) expect(script.split('\n').filter((line) => /^\s*\/\//.test(line))).toEqual([]);
  });
});
