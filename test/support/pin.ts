/**
 * The parent commit the copy is pinned at (GR-002), written once: docs/CUT.md's `Parent commit:` line. test/unit/cut.test.ts holds
 * that line to GR-002's text, test/unit/audit-golden.test.ts archives the parent at it, and a resync bumps it there alone
 * (docs/CUT.md, "The resync recipe"; tune-up pass 1).
 */
import { readFileSync } from 'node:fs';

/** The commit a text of docs/CUT.md's shape names on its `Parent commit:` line, or null. */
export const pinIn = (text: string): string | null => /^Parent commit: `([0-9a-f]{7,40})`/m.exec(text)?.[1] ?? null;

/** The pin, read from docs/CUT.md. */
export const PIN = pinIn(readFileSync(new URL('../../docs/CUT.md', import.meta.url), 'utf8')) ?? '';
