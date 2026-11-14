// ghostreach <site>: the one command (GR-003: no flag). It reads the site and writes its review (src/project/review.ts).
// Decision: GR-003
import { dataDir, review } from '../project/review.js';

const USAGE = 'ghostreach <site>: reviews the site and writes its Suite Builder PDF. Nothing else is typed.';

/** What the command line holds: the site, and nothing else. The parent's options collapse to this (P-15, GR-003). */
export interface Values {
  site: string;
}

/**
 * The command line read: the site, the one argument; `help` for `--help` alone, the one option; null for anything else (no
 * site, a second argument, or any other option, `-x` or `--x`), which is refused, never guessed at.
 */
// Decision: GR-003
export function parse(argv: readonly string[]): Values | 'help' | null {
  if (argv.length === 1 && argv[0] === '--help') return 'help';
  if (argv.length !== 1 || argv[0].startsWith('-') || !argv[0].trim()) return null;
  return { site: argv[0] };
}

/** The command: its exit code. `data` is where the reviews go; a test names its own folder, the salesperson never does (no flag). */
export async function main(argv: readonly string[], data = dataDir()): Promise<number> {
  const values = parse(argv);
  if (values === null || values === 'help') {
    console.log(USAGE);
    return values === 'help' ? 0 : 1;
  }
  return (await review({ site: values.site, data, say: (line) => console.log(line) })).code;
}
