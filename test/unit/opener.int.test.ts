/**
 * Whether the platform's opener opened the page (launch fixes 7): a program that could not start, or that exits with a failure
 * (xdg-open with no browser, `open` with none), is not opened; Windows' explorer.exe exits 1 even when it opens, so there only a
 * program that could not start counts. Spawns real processes, so the integration project alone runs it.
 */
import { describe, expect, it } from 'vitest';
import { launched } from '../../src/project/show.js';

const node = process.execPath;

describe('launched: whether the opener opened', () => {
  it('a program that exits 0 opened', async () => {
    expect(await launched(node, ['-e', 'process.exit(0)'], 'linux')).toBe(true);
  });
  it('one that exits with a failure did not (xdg-open says 3 when it finds no browser)', async () => {
    expect(await launched(node, ['-e', 'process.exit(3)'], 'linux')).toBe(false);
  });
  it('one that is not there did not', async () => {
    expect(await launched('/no/such/opener', ['http://127.0.0.1:4747/'], 'linux')).toBe(false);
  });
  it("on Windows a failure's exit code still opened (explorer.exe exits 1 when it opens); only a missing program did not", async () => {
    expect(await launched(node, ['-e', 'process.exit(1)'], 'win32')).toBe(true);
    expect(await launched('/no/such/opener', [], 'win32')).toBe(false);
  });
  it('one still running after a moment opened (a browser that keeps its opener waiting)', async () => {
    expect(await launched(node, ['-e', 'setTimeout(() => {}, 10000)'], 'linux', 200)).toBe(true);
  });
});
