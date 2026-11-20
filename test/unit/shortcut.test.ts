/**
 * `ghostreach shortcut` (launch fixes, item B, point 10; GR-022, the icon GR-020): opt-in, a command word like `doctor`. On Windows a
 * `.lnk` on the desktop and in the Start menu, made by PowerShell's WScript.Shell from a fixed script with the paths in its
 * environment, never in a command line; asserted here as the exact command built, not run (this machine is Linux). On Linux a
 * `.desktop` file in ~/.local/share/applications (and ~/Desktop when there is one), its icon the PNG copied beside it; made here
 * in a home folder of the test's own.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from '../../src/cli/main.js';
import {
  WINDOWS_SCRIPT, desktopEntry, execLine, isClone, makeShortcut, shortcutTarget, tipFile, windowsShortcut, type Run,
} from '../../src/project/shortcut.js';

const REPO = new URL('../../', import.meta.url).pathname;

let root: string;
let home: string;
let pkg: string;
let data: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ghostreach-shortcut-'));
  home = join(root, 'home');
  data = join(home, 'Ghostreach');
  pkg = join(root, 'lib', 'node_modules', 'ghostreach');
  mkdirSync(home);
  mkdirSync(join(pkg, 'assets'), { recursive: true });
  mkdirSync(join(pkg, 'dist', 'cli'), { recursive: true });
  for (const icon of ['icon.ico', 'icon-256.png']) copyFileSync(join(REPO, 'assets', icon), join(pkg, 'assets', icon));
  writeFileSync(join(pkg, 'dist', 'cli', 'bin.js'), '');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** A stand-in for the programs the shortcut runs: each call kept, each answered as the test says. */
function runs(answer: { code: number | null; out: string } = { code: 0, out: '' }): { calls: Parameters<Run>[]; run: Run } {
  const calls: Parameters<Run>[] = [];
  return { calls, run: async (...call) => (calls.push(call), answer) };
}

describe('the word (GR-018, GR-022)', () => {
  it('shortcut is a word, alone; nothing comes with it', () => {
    expect(parse(['shortcut'])).toBe('shortcut');
    expect([['shortcut', 'example.com'], ['--shortcut'], ['shortcut', '--desktop']].filter((argv) => parse(argv) !== null)).toEqual([]);
  });
});

describe('what the shortcut runs', () => {
  it("from a copy of the source, the folder's own launcher; installed, Node and the installed program", () => {
    expect(shortcutTarget('linux', '/home/ann/ghostreach', '/usr/bin/node', true)).toEqual({ program: '/home/ann/ghostreach/ghostreach', args: [] });
    expect(shortcutTarget('linux', '/usr/lib/node_modules/ghostreach', '/usr/bin/node', false)).toEqual({
      program: '/usr/bin/node', args: ['/usr/lib/node_modules/ghostreach/dist/cli/bin.js'],
    });
    expect(shortcutTarget('win32', 'C:\\Users\\Ann\\ghostreach', 'C:\\Program Files\\nodejs\\node.exe', true)).toEqual({
      program: 'C:\\Users\\Ann\\ghostreach\\ghostreach.cmd', args: [],
    });
    expect(shortcutTarget('win32', 'C:\\Users\\Ann\\AppData\\Roaming\\npm\\node_modules\\ghostreach', 'C:\\Program Files\\nodejs\\node.exe', false)).toEqual({
      program: 'C:\\Program Files\\nodejs\\node.exe', args: ['C:\\Users\\Ann\\AppData\\Roaming\\npm\\node_modules\\ghostreach\\dist\\cli\\bin.js'],
    });
  });

  it('a copy of the source is the folder holding the launcher for this system', () => {
    expect(isClone(REPO, 'linux')).toBe(true);
    expect(isClone(REPO, 'win32')).toBe(true);
    expect(isClone(pkg, 'linux')).toBe(false);
  });
});

describe('on Windows: the exact command built, not run here', () => {
  const target = { program: 'C:\\Program Files\\nodejs\\node.exe', args: ["C:\\Users\\Ann O'Neil & Co\\npm\\node_modules\\ghostreach\\dist\\cli\\bin.js"] };
  const icon = "C:\\Users\\Ann O'Neil & Co\\npm\\node_modules\\ghostreach\\assets\\icon.ico";

  it('PowerShell with a fixed argument list; the script fixed and encoded; every path in its environment alone', () => {
    const built = windowsShortcut(target, icon, 'C:\\Users\\Ann');
    const encoded = Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64');
    expect(built).toEqual({
      command: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      env: {
        GHOSTREACH_TARGET: 'C:\\Program Files\\nodejs\\node.exe',
        GHOSTREACH_ARGUMENTS: `"${target.args[0]}"`,
        GHOSTREACH_ICON: icon,
        GHOSTREACH_FOLDER: 'C:\\Users\\Ann',
      },
    });
    // No path, and nothing of the user's, reaches the command line.
    expect(built.args.join(' ')).not.toMatch(/Ann|ghostreach|\\/);
  });

  it("the script makes Ghostreach.lnk on the desktop and in the Start menu's programs, with the icon, through WScript.Shell", () => {
    expect(WINDOWS_SCRIPT).toContain("New-Object -ComObject WScript.Shell");
    expect(WINDOWS_SCRIPT).toContain("[Environment]::GetFolderPath('Desktop')");
    expect(WINDOWS_SCRIPT).toContain("[Environment]::GetFolderPath('Programs')");
    expect(WINDOWS_SCRIPT).toContain("'Ghostreach.lnk'");
    expect(WINDOWS_SCRIPT).toContain('.CreateShortcut(');
    for (const name of ['GHOSTREACH_TARGET', 'GHOSTREACH_ARGUMENTS', 'GHOSTREACH_ICON', 'GHOSTREACH_FOLDER']) expect(WINDOWS_SCRIPT).toContain(`$env:${name}`);
    // Fixed: no placeholder a path could be pasted into.
    expect(WINDOWS_SCRIPT).not.toMatch(/\$\{|%s|\{\d\}/);
  });

  it('makes it by that command, says where, and marks the tip as said', async () => {
    const { calls, run } = runs({ code: 0, out: 'C:\\Users\\Ann\\Desktop\\Ghostreach.lnk\r\nC:\\Users\\Ann\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Ghostreach.lnk\r\n' });
    const lines: string[] = [];
    const code = await makeShortcut(data, (line) => void lines.push(line), { platform: 'win32', home: 'C:\\Users\\Ann', root: pkg, node: 'C:\\node\\node.exe', run });
    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
    const [command, args, env] = calls[0];
    expect(command).toBe('powershell.exe');
    expect(args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-EncodedCommand']);
    expect(env.GHOSTREACH_TARGET).toBe('C:\\node\\node.exe');
    expect(env.GHOSTREACH_ICON?.endsWith('icon.ico')).toBe(true);
    // The rest of the environment is the process's own, so PowerShell finds the system.
    expect(env.PATH).toBe(process.env.PATH);
    expect(lines).toEqual([
      'Made the Ghostreach shortcut, with its icon: C:\\Users\\Ann\\Desktop\\Ghostreach.lnk and C:\\Users\\Ann\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Ghostreach.lnk',
    ]);
    expect(existsSync(tipFile(data))).toBe(true);
  });

  it('when PowerShell fails, says so plainly and exits 1', async () => {
    const { run } = runs({ code: 1, out: 'Exception calling "Save"' });
    const lines: string[] = [];
    expect(await makeShortcut(data, (line) => void lines.push(line), { platform: 'win32', home: 'C:\\Users\\Ann', root: pkg, node: 'node.exe', run })).toBe(1);
    expect(lines).toEqual(['The shortcut could not be made. Windows said: Exception calling "Save"', 'Copy that line to Ghost.']);
  });
});

describe('on Linux: the .desktop file, made here', () => {
  const entry = (): string => readFileSync(join(home, '.local', 'share', 'applications', 'ghostreach.desktop'), 'utf8');
  const iconAt = (): string => join(home, '.local', 'share', 'icons', 'ghostreach.png');

  it('Exec quotes each word as the desktop entry spec asks: " ` $ \\ escaped inside, % doubled, the backslashes escaped again', () => {
    expect(execLine(['/usr/bin/node', '/opt/a b/bin.js'])).toBe('"/usr/bin/node" "/opt/a b/bin.js"');
    expect(execLine(['/x/$y"z`w\\v%'])).toBe('"/x/\\\\$y\\\\"z\\\\`w\\\\\\\\v%%"');
    expect(() => execLine(['/x/a\nb'])).toThrow();
  });

  it('the entry: a terminal application named Ghostreach, Exec the program, Icon the copied PNG', () => {
    expect(desktopEntry({ program: '/usr/bin/node', args: ['/opt/gr/dist/cli/bin.js'] }, '/home/ann/.local/share/icons/ghostreach.png')).toBe([
      '[Desktop Entry]',
      'Type=Application',
      'Version=1.0',
      'Name=Ghostreach',
      'Comment=Review websites and write each review as a PDF',
      'Exec="/usr/bin/node" "/opt/gr/dist/cli/bin.js"',
      'Icon=/home/ann/.local/share/icons/ghostreach.png',
      'Terminal=true',
      'Categories=Network;',
      '',
    ].join('\n'));
  });

  it('makes the file in the applications menu with the icon beside it; no desktop folder, no desktop copy', async () => {
    const { calls, run } = runs();
    const lines: string[] = [];
    expect(await makeShortcut(data, (line) => void lines.push(line), { platform: 'linux', home, root: pkg, node: '/usr/bin/node', run })).toBe(0);
    expect(entry()).toContain(`Exec="/usr/bin/node" "${join(pkg, 'dist', 'cli', 'bin.js')}"`);
    expect(entry()).toContain(`Icon=${iconAt()}`);
    expect(readFileSync(iconAt())).toEqual(readFileSync(join(REPO, 'assets', 'icon-256.png')));
    expect(existsSync(join(home, 'Desktop'))).toBe(false);
    expect(calls).toEqual([]);
    expect(lines).toEqual([`Made the Ghostreach shortcut, with its icon, in your applications menu: ${join(home, '.local', 'share', 'applications', 'ghostreach.desktop')}`]);
    expect(existsSync(tipFile(data))).toBe(true);
  });

  it('with a desktop folder, a copy there too, executable, and marked trusted where the desktop allows (gio)', async () => {
    mkdirSync(join(home, 'Desktop'));
    const { calls, run } = runs({ code: 2, out: 'gio: not supported' });
    const lines: string[] = [];
    expect(await makeShortcut(data, (line) => void lines.push(line), { platform: 'linux', home, root: pkg, node: '/usr/bin/node', run })).toBe(0);
    const onDesktop = join(home, 'Desktop', 'ghostreach.desktop');
    expect(readFileSync(onDesktop, 'utf8')).toBe(entry());
    expect(statSync(onDesktop).mode & 0o111).toBe(0o111);
    expect(calls).toEqual([['gio', ['set', onDesktop, 'metadata::trusted', 'true'], process.env]]);
    // gio refusing changes nothing: the file is there, and the line names both places.
    expect(lines).toEqual([
      `Made the Ghostreach shortcut, with its icon, in your applications menu and on your desktop: ${join(home, '.local', 'share', 'applications', 'ghostreach.desktop')}, ${onDesktop}`,
    ]);
  });

  it('a second run makes the same files again, nothing beside them', async () => {
    const { run } = runs();
    for (let i = 0; i < 2; i++) expect(await makeShortcut(data, () => {}, { platform: 'linux', home, root: pkg, node: '/usr/bin/node', run })).toBe(0);
    expect(entry()).toContain('Name=Ghostreach');
  });
});

describe('elsewhere', () => {
  it('on a Mac it makes nothing, says so and exits 1', async () => {
    const { calls, run } = runs();
    const lines: string[] = [];
    expect(await makeShortcut(data, (line) => void lines.push(line), { platform: 'darwin', home, root: pkg, node: '/usr/local/bin/node', run })).toBe(1);
    expect(lines).toEqual(['A shortcut is made on Windows and Linux; on this computer, type ghostreach to open the page.']);
    expect(calls).toEqual([]);
    expect(existsSync(join(home, '.local'))).toBe(false);
  });
});
