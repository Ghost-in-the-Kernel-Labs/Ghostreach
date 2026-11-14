// The parent's own findings and audit page for its fixture crawl (TODO 1.5, 1.6, REV-07): Suite Builder's siteFindings and
// auditHtml at the pinned commit, run by the parent's code, never this program's, over the parent's crawl of its fixture site;
// written to test/golden/fixture-site.findings.json and test/golden/fixture-site.AUDIT.html, which test/crawl/ghostreach.spec.ts
// and test/unit/audit-golden.test.ts compare this program's review with. Run from the repository root, <pin> docs/CUT.md's
// `Parent commit:` line:
//   git -C <parent> archive <pin> src test/golden/fixture-site.crawl.json | tar -x -C <dir>
//   node scripts/parent-findings.mjs <dir> > test/golden/fixture-site.findings.json
//   node scripts/parent-findings.mjs <dir> audit > test/golden/fixture-site.AUDIT.html
// The audit page is the parent's bare `suite audit <site>`'s (auditHtml's defaults: not short, no expected links, no lists),
// dated AUDIT_DAY so the golden does not change by the day; nothing else in it varies.
// Node's type stripping runs the parent's TypeScript; the hook below resolves its extensionless imports to their .ts files, and a
// package to this repository's copy of it.
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOOK = `
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
export async function resolve(spec, context, next) {
  if (spec.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const path = fileURLToPath(new URL(spec, context.parentURL));
    for (const file of [path + '.ts', path + '/index.ts']) if (existsSync(file)) return next(pathToFileURL(file).href, context);
  }
  // A package (the audit's import chain reaches playwright) from this repository's node_modules: the parent's archive has none.
  if (!spec.startsWith('.') && !spec.startsWith('node:') && !spec.startsWith('file:') && !spec.startsWith('data:')) {
    try { return await next(spec, context); } catch { return next(spec, { ...context, parentURL: pathToFileURL(process.cwd() + '/').href }); }
  }
  return next(spec, context);
}`;

/** The day the golden audit page says it was read: a fixed day, the one test/unit/audit-golden.test.ts passes this program's auditHtml. */
const AUDIT_DAY = '2026-11-14T12:00:00Z';

const [dir, what = 'findings'] = process.argv.slice(2);
if (!dir || !['findings', 'audit'].includes(what)) {
  console.error('usage: node scripts/parent-findings.mjs <the parent archived at the pinned commit> [findings|audit]');
  process.exit(1);
}
register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
const root = resolve(dir);
const at = (path) => pathToFileURL(join(root, path)).href;
const { readCrawlReport } = await import(at('src/crawl/report-read.ts'));
const { siteFindings } = await import(at('src/group/findings.ts'));
const file = join(root, 'test/golden/fixture-site.crawl.json');
const report = readCrawlReport(readFileSync(file, 'utf8'), file);
if (what === 'audit') {
  const { auditHtml } = await import(at('src/project/audit.ts'));
  process.stdout.write(auditHtml(report, siteFindings(report), new Date(AUDIT_DAY)));
} else {
  process.stdout.write(`${JSON.stringify(siteFindings(report), null, 2)}\n`);
}
