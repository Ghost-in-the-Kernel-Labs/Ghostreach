// ghostreach <site>: the one command (GR-003: no flag). Until Phase 1 lands the crawl, it says what it will take.
// Decision: GR-003
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

export function main(argv: readonly string[]): number {
  const values = parse(argv);
  if (values === null || values === 'help') {
    console.log(USAGE);
    return values === 'help' ? 0 : 1;
  }
  console.log(`${USAGE}\nThe review of ${values.site} arrives with Phase 1 (docs/ROADMAP.md).`);
  return 2;
}
