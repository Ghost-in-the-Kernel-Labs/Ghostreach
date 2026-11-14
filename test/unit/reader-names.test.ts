/**
 * A reader's error names the reader (G-659), and the name leads to the component: `src/crawl/readers/<name>.ts`, or `title`, the one
 * reader written in the readers' index itself. A reader renamed or moved without its name fails here, so a `readerErrors` line in a
 * crawl report always resolves to the file that met it.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_READERS, IDENTITY_READERS } from '../../src/crawl/readers/index.js';

/** The readers written in `src/crawl/readers/index.ts` itself, with no file of their own. */
const IN_THE_INDEX = new Set(['title']);

describe('each reader has a name that leads to its file', () => {
  const readers = [...IDENTITY_READERS, ...CONTENT_READERS];

  it('names every reader once', () => {
    const names = readers.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(readers.map((r) => r.name))('%s is a file in src/crawl/readers/, or a reader of the index', (name) => {
    expect(IN_THE_INDEX.has(name) || existsSync(`src/crawl/readers/${name}.ts`), `src/crawl/readers/${name}.ts`).toBe(true);
  });
});
