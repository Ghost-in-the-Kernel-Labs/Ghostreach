/**
 * Reading a text file that may be kept compressed (a large crawl, <site>.crawl.json.gz): split from crawl-files.ts so
 * the many readers that need only this do not carry the rest (SRC-17, TODO 135's S2).
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

/** A text file's text; a .gz file is decompressed. */
export function readText(path: string): string {
  return path.endsWith('.gz') ? gunzipSync(readFileSync(path)).toString('utf8') : readFileSync(path, 'utf8');
}
