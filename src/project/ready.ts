/**
 * Whether this computer can run a review (TODO 5.1): Node.js new enough, and the Chromium the crawl drives downloaded. `ghostreach
 * doctor` says both first, in plain words, each with the exact command that fixes it when it is missing.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

/** The Node.js versions the program runs on: package.json's `engines.node`, the parent's at a4c8045 (GR-002); a test holds the two equal. */
export const NODE_RANGE = '^22.18.0 || ^24.11.0 || >=26.0.0';

/** What the doctor reads of the install: Node's version, the Playwright the program carries, and whether its Chromium is on disk. */
export interface Install {
  node: string;
  playwright: string;
  chromium: boolean;
  /** `process.platform`: Linux also needs Chromium's system libraries (`--with-deps`). */
  platform: string;
}

/** Whether a Node.js version (`24.22.1`) is in `NODE_RANGE`: 22.18 or a later 22, 24.11 or a later 24, or 26 and after. */
export function nodeEnough(version: string): boolean {
  const [major, minor] = version.split('.').map(Number);
  return (major === 22 && minor >= 18) || (major === 24 && minor >= 11) || major >= 26;
}

/**
 * This install, read without launching anything: Chromium counts as there when Playwright's own path for it exists (it honours
 * PLAYWRIGHT_BROWSERS_PATH; `playwright install chromium` writes it and the headless shell the crawl launches together).
 */
export function thisInstall(): Install {
  const playwright = (createRequire(import.meta.url)('playwright/package.json') as { version: string }).version;
  return { node: process.versions.node, playwright, chromium: existsSync(chromium.executablePath()), platform: process.platform };
}

/** The doctor's first two lines: Node.js and Chromium, each enough or missing, and the command that fixes a missing one. */
export function readyLines(install: Install): string[] {
  const node = nodeEnough(install.node)
    ? `Node.js ${install.node}: new enough.`
    : `Node.js ${install.node}: too old, or a version this program does not run on (it needs 22.18 or later 22, 24.11 or later 24, or 26 and after). Install the LTS version: on Windows run winget install OpenJS.NodeJS.LTS, on Linux install it from your distribution or https://nodejs.org/en/download; then install this program again.`;
  const browser = install.chromium
    ? 'Chromium, the browser the review drives: installed.'
    : `Chromium, the browser the review drives: not installed. Run: npx playwright@${install.playwright} install ${install.platform === 'linux' ? '--with-deps ' : ''}chromium`;
  return [node, browser];
}
