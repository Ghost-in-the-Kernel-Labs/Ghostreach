import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse, type Values } from '../../src/cli/main.js';

// No flag (GR-003, GR-018, P-15, TODO 1.3): the parser takes the site, its command words and `--help`, and refuses every option beside, the parent's
// stripped ones (docs/CUT.md, "The flags stripped") first among them.
const ROOT = new URL('../../', import.meta.url);
const read = (relative: string): string => fs.readFileSync(new URL(relative, ROOT), 'utf8');

/** The flags docs/CUT.md's table lists, as typed: `--short`, `--fail-on`, ... */
const cutFlags = (read('docs/CUT.md').split('## The flags stripped')[1] ?? '').split('\n## ')[0].match(/^\| `(--[a-z-]+)` \|/gm)?.map((row) => row.slice(3, -3)) ?? [];
/** A few options no parent ever had, and the short and odd spellings of one. */
const OTHERS = ['--verbose', '--json', '--pdf', '--HELP', '--help=yes', '-h', '-x', '--', '---help'];
const sources = fs.readdirSync(new URL('src/', ROOT), { recursive: true, encoding: 'utf8' }).filter((f) => /\.ts$/.test(f)).map((f) => `src/${f.replace(/\\/g, '/')}`);

describe('the parser accepts no option but --help (GR-003)', () => {
  it('reads the stripped flags from docs/CUT.md, all twenty', () => {
    expect(cutFlags).toContain('--short');
    expect(cutFlags).toContain('--vulnsec');
    expect(cutFlags.length).toBe(20);
  });
  it('refuses every stripped flag, alone, before the site and after it', () => {
    const accepted = cutFlags.flatMap((flag) => [[flag], [flag, 'example.com'], ['example.com', flag], [`${flag}=1`, 'example.com']].filter((argv) => parse(argv) !== null).map((argv) => argv.join(' ')));
    expect(accepted).toEqual([]);
  });
  it('refuses any other option, long or short', () => {
    expect(OTHERS.flatMap((o) => [[o], [o, 'example.com']]).filter((argv) => parse(argv) !== null)).toEqual([]);
  });
  it('accepts --help alone, and only alone', () => {
    expect(parse(['--help'])).toBe('help');
    expect(parse(['--help', 'example.com'])).toBeNull();
  });
  it('collapses to the site and nothing else', () => {
    const values: Values = { site: 'example.com' };
    expect(parse(['example.com'])).toEqual(values);
    expect(Object.keys(parse(['https://example.com/']) as Values)).toEqual(['site']);
  });
  it('refuses a blank site and a second argument; nothing at all is the page (GR-018)', () => {
    expect([[''], ['  '], ['example.com', 'example.org']].filter((argv) => parse(argv) !== null)).toEqual([]);
    expect(parse([])).toBe('serve');
  });
  it('no file under src/ parses options with node:util parseArgs', () => {
    expect(sources.filter((f) => /\bparseArgs\b/.test(read(f)))).toEqual([]);
  });
});
