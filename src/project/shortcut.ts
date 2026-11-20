/**
 * `ghostreach shortcut` (launch fixes 10, GR-022; the icon GR-020): opt-in, made only when asked. On Windows, `Ghostreach.lnk` on the
 * desktop and in the Start menu's programs, with `assets/icon.ico`, made by PowerShell's WScript.Shell: the script is fixed and
 * sent encoded, and every path reaches it in its environment, never in a command line. On Linux, `ghostreach.desktop` in
 * ~/.local/share/applications (and ~/Desktop when there is one, executable and marked trusted where the desktop allows), its icon
 * `assets/icon-256.png` copied to ~/.local/share/icons. It runs the folder's own launcher in a copy of the source, else Node and
 * the installed program. Elsewhere nothing is made. The first launch's one-line tip about it is said once (`tipLine`, `tipFile`).
 */
// Decision: GR-022
import { spawn } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The program the shortcut starts, and the words after it. */
export interface Target {
  program: string;
  args: string[];
}

/** A program run to its end: its exit code (null when it could not start) and what it printed. */
export type Run = (command: string, args: string[], env: NodeJS.ProcessEnv) => Promise<{ code: number | null; out: string }>;

/** Where the shortcut is made from and for: a test's own, else this computer's. */
export interface Here {
  platform: NodeJS.Platform;
  home: string;
  /** The package's folder: two up from this file, built (dist/project/) or not (src/project/). */
  root: string;
  node: string;
  run: Run;
}

/** The mark in the data folder that the first launch's tip was said (or a shortcut made), so it is said once. */
export const tipFile = (data: string): string => join(data, 'shortcut-tip.txt');

/** The first launch's one line about the shortcut, where one can be made; null elsewhere. */
export function tipLine(platform: NodeJS.Platform): string | null {
  if (platform === 'win32') return 'Tip: type ghostreach shortcut to put Ghostreach, with its icon, on your desktop and in the Start menu.';
  if (platform === 'linux') return 'Tip: type ghostreach shortcut to put Ghostreach, with its icon, in your applications menu and on your desktop.';
  return null;
}

/** Marks the tip as said, with the day: the next launch says nothing of the shortcut. */
export function markTip(data: string): void {
  mkdirSync(data, { recursive: true });
  writeFileSync(tipFile(data), `${new Date().toISOString().slice(0, 10)}\n`);
}

/** Whether the package's folder is a copy of the source: it holds the launcher for this system (`ghostreach`, `ghostreach.cmd`). */
export const isClone = (root: string, platform: NodeJS.Platform): boolean => existsSync(join(root, platform === 'win32' ? 'ghostreach.cmd' : 'ghostreach'));

/** What the shortcut runs: the folder's own launcher in a copy of the source (it builds first when needed), else Node and the installed program. */
export function shortcutTarget(platform: NodeJS.Platform, root: string, node: string, clone: boolean): Target {
  const path = platform === 'win32' ? win32 : posix;
  if (clone) return { program: path.join(root, platform === 'win32' ? 'ghostreach.cmd' : 'ghostreach'), args: [] };
  return { program: node, args: [path.join(root, 'dist', 'cli', 'bin.js')] };
}

/**
 * The PowerShell that makes the two `.lnk` files, fixed: it reads the target, its arguments, the icon and the working folder from
 * its environment, and prints each file it saved. The desktop and the Start menu are the system's own (`GetFolderPath`), so a
 * desktop moved into OneDrive is found.
 */
export const WINDOWS_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '$shell = New-Object -ComObject WScript.Shell',
  "foreach ($folder in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {",
  "  $file = Join-Path $folder 'Ghostreach.lnk'",
  '  $link = $shell.CreateShortcut($file)',
  '  $link.TargetPath = $env:GHOSTREACH_TARGET',
  '  $link.Arguments = $env:GHOSTREACH_ARGUMENTS',
  '  $link.WorkingDirectory = $env:GHOSTREACH_FOLDER',
  '  $link.IconLocation = $env:GHOSTREACH_ICON',
  "  $link.Description = 'Review websites and write each review as a PDF'",
  '  $link.Save()',
  '  Write-Output $file',
  '}',
].join('\r\n');

/**
 * The Windows command, as a program and a fixed argument list (no shell): PowerShell, the script encoded as it asks (UTF-16LE,
 * base64), and the paths in its environment. A Windows path cannot hold `"`, so each argument is quoted whole.
 */
export function windowsShortcut(target: Target, icon: string, home: string): { command: string; args: string[]; env: Record<string, string> } {
  return {
    command: 'powershell.exe',
    args: ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64')],
    env: {
      GHOSTREACH_TARGET: target.program,
      GHOSTREACH_ARGUMENTS: target.args.map((a) => `"${a}"`).join(' '),
      GHOSTREACH_ICON: icon,
      GHOSTREACH_FOLDER: home,
    },
  };
}

/** A path a desktop file's value cannot carry as one line: a control character. */
const CONTROL = /[\u0000-\u001f\u007f]/;

/** A value of a desktop file: its backslashes escaped (the spec's string type); a control character refused. */
function desktopValue(text: string): string {
  if (CONTROL.test(text)) throw new Error(`A shortcut cannot name ${JSON.stringify(text)}: it holds a control character.`);
  return text.replace(/\\/g, '\\\\');
}

/**
 * The Exec line's words, as the Desktop Entry Specification asks: each word quoted whole, `"` `` ` `` `$` `\` escaped by a
 * backslash inside the quotes, `%` doubled (not a field code), then the line escaped as any value is.
 */
export function execLine(words: readonly string[]): string {
  return desktopValue(words.map((w) => `"${w.replace(/["`$\\]/g, '\\$&').replace(/%/g, '%%')}"`).join(' '));
}

/** The Linux shortcut: a terminal application, so the page's lines and its Ctrl+C are where the salesperson sees them. */
export function desktopEntry(target: Target, icon: string): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Version=1.0',
    'Name=Ghostreach',
    'Comment=Review websites and write each review as a PDF',
    `Exec=${execLine([target.program, ...target.args])}`,
    `Icon=${desktopValue(icon)}`,
    'Terminal=true',
    'Categories=Network;',
    '',
  ].join('\n');
}

/** A program run with a fixed argument list and no shell: its exit code (null when it could not start) and its output. */
const runProgram: Run = (command, args, env) =>
  new Promise((done) => {
    const child = spawn(command, args, { shell: false, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')));
    child.on('error', (e) => done({ code: null, out: e.message }));
    child.on('close', (code) => done({ code, out }));
  });

const thisComputer = (): Here => ({
  platform: process.platform,
  home: homedir(),
  root: fileURLToPath(new URL('../../', import.meta.url)),
  node: process.execPath,
  run: runProgram,
});

/** The Windows shortcut, by PowerShell: 0 when both files were saved, said with their paths; 1, with what Windows said, otherwise. */
async function onWindows(here: Here, say: (line: string) => void): Promise<number> {
  const target = shortcutTarget('win32', here.root, here.node, isClone(here.root, 'win32'));
  const { command, args, env } = windowsShortcut(target, win32.join(here.root, 'assets', 'icon.ico'), here.home);
  const done = await here.run(command, args, { ...process.env, ...env });
  const saved = done.out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (done.code !== 0) {
    say(`The shortcut could not be made. Windows said: ${saved[0] ?? 'nothing'}`);
    say('Copy that line to Ghost.');
    return 1;
  }
  say(`Made the Ghostreach shortcut, with its icon: ${saved.join(' and ')}`);
  return 0;
}

/** The Linux shortcut: the icon copied, the desktop file written to the applications menu and, when there is one, the desktop. */
async function onLinux(here: Here, say: (line: string) => void): Promise<number> {
  const share = join(here.home, '.local', 'share');
  const icon = join(share, 'icons', 'ghostreach.png');
  const entry = desktopEntry(shortcutTarget('linux', here.root, here.node, isClone(here.root, 'linux')), icon);
  mkdirSync(join(share, 'icons'), { recursive: true });
  copyFileSync(join(here.root, 'assets', 'icon-256.png'), icon);
  const menu = join(share, 'applications', 'ghostreach.desktop');
  mkdirSync(join(share, 'applications'), { recursive: true });
  writeFileSync(menu, entry);
  const desktop = join(here.home, 'Desktop');
  if (!existsSync(desktop)) {
    say(`Made the Ghostreach shortcut, with its icon, in your applications menu: ${menu}`);
    return 0;
  }
  const onDesktop = join(desktop, 'ghostreach.desktop');
  writeFileSync(onDesktop, entry);
  // A desktop launches a file on it only when it may run it, and GNOME only once it is marked trusted; gio missing or refusing changes nothing.
  chmodSync(onDesktop, 0o755);
  await here.run('gio', ['set', onDesktop, 'metadata::trusted', 'true'], process.env);
  say(`Made the Ghostreach shortcut, with its icon, in your applications menu and on your desktop: ${menu}, ${onDesktop}`);
  return 0;
}

/** `ghostreach shortcut`: makes it for this system and marks the first launch's tip as said; 1 where none is made or it failed. */
// Decision: GR-022
export async function makeShortcut(data: string, say: (line: string) => void, given: Partial<Here> = {}): Promise<number> {
  const here = { ...thisComputer(), ...given };
  if (here.platform !== 'win32' && here.platform !== 'linux') {
    say('A shortcut is made on Windows and Linux; on this computer, type ghostreach to open the page.');
    return 1;
  }
  const code = here.platform === 'win32' ? await onWindows(here, say) : await onLinux(here, say);
  if (code === 0) markTip(data);
  return code;
}
