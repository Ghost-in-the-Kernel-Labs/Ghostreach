import { describe, expect, it } from 'vitest';

// docs/CUT.md held to src/ (GR-002, docs/ROADMAP.md §5): every copied file is listed, nothing of the suite side is, and no
// file names a flag the document says was stripped. Red by design until 1.2 copies the files: that one check is `it.fails`,
// which passes while the files are missing and fails the day they all exist, so 1.2 must turn it into `it` (J-012).

// The stack has no @types/node until 1.2 (docs/CUT.md, "What 1.2 needs"): node:fs is reached through an untyped import and
// given the three functions this file calls.
interface Fs {
  readFileSync(path: URL, encoding: 'utf8'): string;
  existsSync(path: URL): boolean;
  readdirSync(path: URL, options: { recursive: true }): string[];
}
const fs = (await import(`node:${'fs'}`)) as Fs;
const ROOT = new URL('../../', import.meta.url);
const read = (relative: string): string => fs.readFileSync(new URL(relative, ROOT), 'utf8');

/** The parent's paths a copy may never come from (GR-004, P-17, J-008): the suite and what only the suite uses. */
const SUITE_SIDE = [/^src\/(kits|model|targets|bench|truth|theme|guide|sec)\//, /^src\/project\/(dock|history|recipe|generate|write)/, /^src\/crawl\/(history\.ts|locator-ladder\/)/];
/** The one file of src/model/ carried, as its own row in docs/CUT.md's Questions says (J-012): the audit's links section. */
const CARRIED_FROM_MODEL = ['src/model/links-to-look.ts'];

/** The lines of a `## heading` section of a Markdown text, up to the next `## `. */
function section(text: string, heading: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === `## ${heading}`);
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/** A section's table rows as cells, the header and the rule left out: [["`src/a.ts`", "`src/b.ts`", ...], ...]. */
function rows(lines: string[]): string[][] {
  const table = lines.filter((l) => l.startsWith('| '));
  return table.slice(2).map((l) => l.slice(2, -2).split(' | '));
}

const unquote = (cell: string): string => cell.replace(/^`|`$/g, '');

interface Cut {
  commit: string | null;
  files: { parent: string; here: string }[];
  own: string[];
  stripped: string[];
}

/** docs/CUT.md as data: its parent commit, its file rows, Ghostreach's own files, and the flags it says are stripped. */
function parseCut(text: string): Cut {
  return {
    commit: /^Parent commit: `([0-9a-f]{7,40})`/m.exec(text)?.[1] ?? null,
    files: rows(section(text, 'The files')).map(([parent, here]) => ({ parent: unquote(parent), here: unquote(here) })),
    own: section(text, "Ghostreach's own files").filter((l) => l.startsWith('- `')).map((l) => unquote(l.slice(2))),
    stripped: rows(section(text, 'The flags stripped')).filter((r) => r[2] === 'stripped').map((r) => unquote(r[0])),
  };
}

/** Each row whose parent path is on the suite side, said. */
function suiteSideRows(cut: Cut): string[] {
  return cut.files.filter((f) => SUITE_SIDE.some((p) => p.test(f.parent)) && !CARRIED_FROM_MODEL.includes(f.parent)).map((f) => `${f.parent} is the suite side`);
}

/** Each file under src/ that is neither a row nor one of Ghostreach's own. */
function unlisted(cut: Cut, files: string[]): string[] {
  const known = new Set([...cut.files.map((f) => f.here), ...cut.own]);
  return files.filter((f) => !known.has(f));
}

/** Each (file, flag) where a file's text names a stripped flag as a whole word: `--short`, not `--shortcut`. */
function flagsNamed(stripped: string[], texts: Record<string, string>): string[] {
  return Object.entries(texts).flatMap(([file, text]) =>
    stripped.filter((flag) => new RegExp(`${flag.replace(/[-]/g, '\\-')}(?![\\w-])`).test(text)).map((flag) => `${file} names ${flag}`),
  );
}

const cut = parseCut(read('docs/CUT.md'));
const modules = Object.values((JSON.parse(read('docs/modules.json')) as { modules: Record<string, { folder: string }> }).modules).map((m) => `${m.folder}/`);
const sources = fs.readdirSync(new URL('src/', ROOT), { recursive: true }).map((f) => `src/${f.replace(/\\/g, '/')}`).filter((f) => /\.(ts|mts|js|mjs)$/.test(f));

describe('docs/CUT.md (GR-002)', () => {
  it('names the parent commit, a4c8045', () => {
    expect(cut.commit).toBe('a4c8045');
  });
  it('lists the files to copy, each once, each into a module folder of docs/modules.json', () => {
    expect(cut.files.length).toBeGreaterThan(100);
    expect(new Set(cut.files.map((f) => f.here)).size).toBe(cut.files.length);
    expect(cut.files.filter((f) => !modules.some((m) => f.here.startsWith(m))).map((f) => f.here)).toEqual([]);
  });
  it('copies nothing of the suite side (GR-004)', () => {
    expect(suiteSideRows(cut)).toEqual([]);
  });
  it('lists every file under src/: each is a copy or one of its own', () => {
    expect(unlisted(cut, sources)).toEqual([]);
  });
  it('no file under src/ names a flag it says was stripped (GR-003)', () => {
    expect(flagsNamed(cut.stripped, Object.fromEntries(sources.map((f) => [f, read(f)])))).toEqual([]);
  });
  // Red by design (TODO 1.1): the files arrive at 1.2, which turns `it.fails` into `it`.
  it.fails('every listed file is copied', () => {
    expect(cut.files.filter((f) => !fs.existsSync(new URL(f.here, ROOT))).map((f) => f.here)).toEqual([]);
  });
});

describe('the checks catch what they are for (planted breaks)', () => {
  const planted = parseCut(
    [
      'Parent commit: `a4c8045`',
      '## The files',
      '| Parent path | Ghostreach path | Lines | Loses at 1.2 | Flags at 1.3 |',
      '| --- | --- | --- | --- | --- |',
      '| `src/kits/common/bugs.ts` | `src/audit/bugs.ts` | 1 | — | — |',
      '| `src/model/links-to-look.ts` | `src/audit/links-to-look.ts` | 1 | — | — |',
      '| `src/group/findings.ts` | `src/findings/findings.ts` | 1 | — | — |',
      "## Ghostreach's own files",
      '- `src/cli/main.ts`',
      '## The flags stripped',
      '| Flag | What it set | Status |',
      '| --- | --- | --- |',
      '| `--short` | the short audit | stripped |',
      '| `--sec` | the guards | at 1.3 |',
    ].join('\n'),
  );
  it('reads the rows, the own files and only the flags marked stripped', () => {
    expect(planted.files.map((f) => f.here)).toEqual(['src/audit/bugs.ts', 'src/audit/links-to-look.ts', 'src/findings/findings.ts']);
    expect(planted.own).toEqual(['src/cli/main.ts']);
    expect(planted.stripped).toEqual(['--short']);
  });
  it('refuses a row from the kits, and lets the one model file through', () => {
    expect(suiteSideRows(planted)).toEqual(['src/kits/common/bugs.ts is the suite side']);
  });
  it('names a file under src/ that no row lists', () => {
    expect(unlisted(planted, ['src/cli/main.ts', 'src/findings/findings.ts', 'src/crawl/extra.ts'])).toEqual(['src/crawl/extra.ts']);
  });
  it('finds a stripped flag as a whole word, in code or comment, and only a stripped one', () => {
    expect(flagsNamed(planted.stripped, { 'src/a.ts': "// --short: the free scan\nconst x = '--sec';", 'src/b.ts': 'the --shortcut key' })).toEqual(['src/a.ts names --short']);
  });
});
