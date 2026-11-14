// ghostreach <site>: the one command (GR-003: no flag). Until Phase 1 lands the crawl, it says what it will take.
// Decision: GR-003
const USAGE = 'ghostreach <site>: reviews the site and writes its Suite Builder PDF. Nothing else is typed.';

export function main(argv: readonly string[]): number {
  const site = argv[0];
  if (!site || site.startsWith('--')) {
    console.log(USAGE);
    return site === '--help' ? 0 : 1;
  }
  console.log(`${USAGE}\nThe review of ${site} arrives with Phase 1 (docs/ROADMAP.md).`);
  return 2;
}
