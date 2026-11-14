// `ghostreach doctor`'s first two lines (TODO 5.1, src/project/ready.ts): Node.js new enough, Chromium installed, each said in plain
// words with the exact command that fixes it when it is not.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NODE_RANGE, nodeEnough, readyLines, thisInstall } from '../../src/project/ready.js';

describe('ghostreach doctor: is this computer ready (TODO 5.1)', () => {
  it("holds the Node.js range package.json's engines states", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { engines: { node: string } };
    expect(pkg.engines.node).toBe(NODE_RANGE);
  });
  it('reads the range: 22.18 or a later 22, 24.11 or a later 24, 26 and after; nothing else', () => {
    expect(['22.18.0', '22.23.4', '24.11.0', '24.22.1', '26.0.0', '27.3.1'].filter((v) => !nodeEnough(v))).toEqual([]);
    expect(['18.20.0', '20.19.0', '22.17.9', '23.11.0', '24.10.0', '25.2.0'].filter(nodeEnough)).toEqual([]);
  });
  it('says each in plain words, a missing one with the command that fixes it', () => {
    expect(readyLines({ node: '24.22.1', playwright: '1.63.0', chromium: true, platform: 'win32' })).toEqual([
      'Node.js 24.22.1: new enough.',
      'Chromium, the browser the review drives: installed.',
    ]);
    const [node, browser] = readyLines({ node: '20.19.0', playwright: '1.63.0', chromium: false, platform: 'win32' });
    expect(node).toMatch(/^Node\.js 20\.19\.0: too old, /);
    expect(node).toContain('winget install OpenJS.NodeJS.LTS');
    expect(node).toContain('https://nodejs.org/en/download');
    // The Playwright the program carries, so the browser downloaded is the one it drives.
    expect(browser).toBe('Chromium, the browser the review drives: not installed. Run: npx playwright@1.63.0 install chromium');
  });
  it('on Linux, names the command that also adds Chromium\'s system libraries', () => {
    const [, browser] = readyLines({ node: '24.22.1', playwright: '1.63.0', chromium: false, platform: 'linux' });
    expect(browser).toBe('Chromium, the browser the review drives: not installed. Run: npx playwright@1.63.0 install --with-deps chromium');
  });
  it("reads this install: Node's own version and the Playwright in the lockfile", () => {
    const install = thisInstall();
    expect(install.node).toBe(process.versions.node);
    expect(install.playwright).toMatch(/^1\.63\.\d+$/);
    expect(typeof install.chromium).toBe('boolean');
  });
  it("keeps the README's install steps to this version and the lockfile's Playwright", () => {
    const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
    const { version } = JSON.parse(read('package.json')) as { version: string };
    const lock = JSON.parse(read('package-lock.json')) as { packages: Record<string, { version: string }> };
    const readme = read('README.md');
    expect(readme).toContain(`npm install -g ghostreach-${version}.tgz`);
    expect(readme).toContain(`npx playwright@${lock.packages['node_modules/playwright'].version} install chromium`);
  });
});
