// ghostreach <site>: the one command (GR-003: no flag). It reads the site and writes its review (src/project/review.ts).
// `ghostreach serve` opens the reviews' local page (TODO 3.2, src/project/serve.ts): a word, not an option.
// `ghostreach doctor` says the machine's memory and the reviews at once it recommends (TODO 3.4, src/project/settings.ts): a word too.
// Decision: GR-003
import { dataDir, review } from '../project/review.js';
import { openInBrowser, servePage, type ServedPage } from '../project/serve.js';
import { doctorLines, thisMachine } from '../project/settings.js';

const USAGE = 'ghostreach <site>: reviews the site and writes its Suite Builder PDF. ghostreach serve: opens the reviews in the browser. ghostreach doctor: says how many sites this computer can review at once. Nothing else is typed.';

/** What the command line holds: the site, and nothing else. The parent's options collapse to this (P-15, GR-003). */
export interface Values {
  site: string;
}

/**
 * The command line read: the site, the one argument; `help` for `--help` alone, the one option; `serve` or `doctor` for that word
 * alone (the roadmap's command words, TODO 3.2 and 3.4, never options); null for anything else (no site, a second argument, or any
 * other option, `-x` or `--x`), which is refused, never guessed at.
 */
// Decision: GR-003
export function parse(argv: readonly string[]): Values | 'help' | 'serve' | 'doctor' | null {
  if (argv.length === 1 && argv[0] === '--help') return 'help';
  if (argv.length === 1 && argv[0] === 'serve') return 'serve';
  if (argv.length === 1 && argv[0] === 'doctor') return 'doctor';
  if (argv.length !== 1 || argv[0].startsWith('-') || !argv[0].trim()) return null;
  return { site: argv[0] };
}

/** Opens the served page in the salesperson's browser; a test hands its own, so no browser opens under test. */
const openPage = (page: ServedPage): void => openInBrowser(page.url);

/**
 * The command: its exit code. `data` is where the reviews go; a test names its own folder, the salesperson never does (no flag).
 * `serve` returns when the page stops serving (Ctrl-C ends it at the terminal).
 */
export async function main(argv: readonly string[], data = dataDir(), open = openPage): Promise<number> {
  const values = parse(argv);
  if (values === null || values === 'help') {
    console.log(USAGE);
    return values === 'help' ? 0 : 1;
  }
  if (values === 'doctor') {
    for (const line of doctorLines(data, thisMachine())) console.log(line);
    return 0;
  }
  if (values === 'serve') {
    const page = await servePage(data);
    console.log(`The reviews are at ${page.url} (this computer only). Ctrl-C stops the page.`);
    if (page.settings.note) console.log(page.settings.note);
    open(page);
    await page.closed;
    return 0;
  }
  return (await review({ site: values.site, data, say: (line) => console.log(line) })).code;
}
