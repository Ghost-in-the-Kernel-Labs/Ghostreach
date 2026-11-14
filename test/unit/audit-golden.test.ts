/**
 * The audit golden against the parent (TODO 1.6, REV-07): this program's AUDIT.html for the parent's fixture crawl is the parent's,
 * byte for byte, but for the differences test/support/audit-golden.ts names (the title line, the footer, the named losses of
 * docs/CUT.md). The golden is the parent's page, written by the parent's code: `UPDATE_GOLDEN=1` records it again by archiving the
 * parent at the pinned commit into a temporary folder and running scripts/parent-findings.mjs there (the parent's repository read
 * only, at `../suite-builder` or SUITE_BUILDER), never by this program's code.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditHtml } from '../../src/audit/audit.js';
import { siteFindings } from '../../src/findings/findings.js';
import { auditedCrawl } from '../../src/project/crawl.js';
import { ALLOWED, GOLDEN_AUDIT, GOLDEN_WHEN, asParent, parentAudit } from '../support/audit-golden.js';

const PIN = 'a4c8045';
const root = resolve(new URL('../../', import.meta.url).pathname);

if (process.env.UPDATE_GOLDEN === '1') {
  const parent = resolve(root, process.env.SUITE_BUILDER ?? '../suite-builder');
  const dir = mkdtempSync(join(tmpdir(), 'parent-audit-'));
  try {
    execFileSync('sh', ['-c', 'git -C "$1" archive "$2" src test/golden/fixture-site.crawl.json | tar -x -C "$3"', 'sh', parent, PIN, dir]);
    writeFileSync(GOLDEN_AUDIT, execFileSync(process.execPath, ['scripts/parent-findings.mjs', dir, 'audit'], { cwd: root, encoding: 'utf8' }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const ours = (): string => {
  const report = auditedCrawl(join(root, 'test/golden/fixture-site.crawl.json'));
  return auditHtml(report, siteFindings(report), GOLDEN_WHEN);
};

describe('the audit page against the parent\'s (TODO 1.6)', () => {
  it('is the parent\'s for its fixture crawl, but for the title line, the footer and the named losses', () => {
    expect(asParent(ours())).toBe(parentAudit());
  });
  it('differs in each allowed place, each found once on each side', () => {
    const page = ours();
    const golden = parentAudit();
    for (const { what, ours: mine, parent } of ALLOWED) {
      expect(page.split(mine).length - 1, what).toBe(1);
      expect(golden.split(parent).length - 1, what).toBe(1);
    }
  });
  it('never names this program to the prospect', () => {
    expect(ours()).not.toMatch(/ghostreach/i);
  });
  it('fails on any other difference (planted)', () => {
    expect(asParent(ours().replace('1 broken link', '1 broken links'))).not.toBe(parentAudit());
    expect(() => asParent(ours().replace('| Suite Builder</title>', '</title>'))).toThrow(/the title line/);
  });
});
