// The command line (GR-003, GR-018): no flag but `--help`. `ghostreach` alone opens the local page in the browser, starting it if
// none runs for the data folder (src/project/serve.ts); `ghostreach serve` is the same. `ghostreach <site>` reads the site and
// writes its review (src/project/review.ts). `ghostreach doctor` says whether Node.js and Chromium are ready (src/project/ready.ts),
// then the machine's memory and the reviews at once it uses (src/project/settings.ts). `ghostreach shortcut` puts a shortcut with
// the icon on the desktop and in the menu (src/project/shortcut.ts, GR-022). Each is a word, never an option.
// Decision: GR-003, GR-018, GR-022
import { readFileSync } from 'node:fs';
import { dataDir, review } from '../project/review.js';
import { openInBrowser, showPage, type Open } from '../project/show.js';
import { makeShortcut } from '../project/shortcut.js';
import { readyLines, thisInstall } from '../project/ready.js';
import { doctorLines, thisMachine } from '../project/settings.js';

/**
 * `Ghostreach <version> (<commit>)`: the package's version, and the commit the build was made from when the launchers' stamp
 * (build/launch.json, scripts/launch.mjs) names one, so a copy of the source running an old build shows it (J-070). Read from the
 * folder two above the running file: the copy's (or the installed package's) package.json, and the stamp where one was written.
 */
export function versionLine(): string {
  const read = (path: string): { version?: unknown; commit?: unknown } => {
    try {
      return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
    } catch {
      return {};
    }
  };
  const { version } = read('../../package.json');
  const { commit } = read('../../build/launch.json');
  return ['Ghostreach', typeof version === 'string' ? version : '', typeof commit === 'string' ? `(${commit})` : '']
    .filter(Boolean).join(' ');
}

/** The version, every command in plain words, then where the reviews are kept and how the page stops: `--help`'s answer, and a refusal's. */
export function helpLines(data: string): string[] {
  return [
    versionLine(),
    'Ghostreach reviews websites and writes each review as a PDF.',
    '',
    '  ghostreach                 Open the Ghostreach page in your browser (starts it if needed)',
    '  ghostreach <site>          Review one website and write its PDF, for example: ghostreach www.example.com',
    '  ghostreach doctor          Check this computer: Node.js, the browser, how many reviews at once',
    '  ghostreach shortcut        Put Ghostreach, with its icon, on your desktop and in your menu',
    '  ghostreach serve           Same as ghostreach',
    '  ghostreach --help          This list (ghostreach help too)',
    '',
    `Reviews are saved in ${data}`,
    'The page runs while its window stays open; press Ctrl+C in that window to stop it.',
  ];
}

/** What the command line holds: the site, and nothing else. The parent's options collapse to this (P-15, GR-003). */
export interface Values {
  site: string;
}

/**
 * The command line read: nothing, or `serve` alone, is `serve` (GR-018); `--help` alone, the one option, or the word `help`, is
 * `help`; `doctor` alone is `doctor`, and `shortcut` alone `shortcut`; one other argument is the site; anything else (a second argument, any other option, `-x` or
 * `--x`, a blank) is null, refused, never guessed at.
 */
// Decision: GR-003, GR-018, GR-022
export function parse(argv: readonly string[]): Values | 'help' | 'serve' | 'doctor' | 'shortcut' | null {
  if (argv.length === 0) return 'serve';
  if (argv.length !== 1) return null;
  const [word] = argv;
  if (word === '--help' || word === 'help') return 'help';
  if (word === 'serve' || word === 'doctor' || word === 'shortcut') return word;
  if (word.startsWith('-') || !word.trim()) return null;
  return { site: word };
}

/** Opens the page in the salesperson's browser, and says whether it did; a test hands its own, so no browser opens under test. */
const openPage: Open = (url) => openInBrowser(url);

/**
 * The command: its exit code. `data` is where the reviews go; a test names its own folder, the salesperson never does (no flag).
 * The page returns when it stops serving (Ctrl+C ends it at the terminal), or at once when one already runs.
 */
export async function main(argv: readonly string[], data = dataDir(), open: Open = openPage): Promise<number> {
  const values = parse(argv);
  if (values === null || values === 'help') {
    for (const line of helpLines(data)) console.log(line);
    return values === 'help' ? 0 : 1;
  }
  if (values === 'doctor') {
    for (const line of [...readyLines(thisInstall()), ...doctorLines(data, thisMachine())]) console.log(line);
    return 0;
  }
  if (values === 'shortcut') return makeShortcut(data, (line) => console.log(line));
  if (values === 'serve') {
    await showPage(data, (line) => console.log(line), open);
    return 0;
  }
  return (await review({ site: values.site, data, say: (line) => console.log(line) })).code;
}
