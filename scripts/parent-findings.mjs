// The parent's own findings for its fixture crawl (TODO 1.5, REV-07): Suite Builder's siteFindings at the pinned commit, run by
// the parent's code, never this program's, over the parent's crawl of its fixture site; written to test/golden/fixture-site.findings.json,
// which test/crawl/ghostreach.spec.ts compares this program's review with. Run from the repository root:
//   git -C <parent> archive a4c8045 src test/golden/fixture-site.crawl.json | tar -x -C <dir>
//   node scripts/parent-findings.mjs <dir> > test/golden/fixture-site.findings.json
// Node's type stripping runs the parent's TypeScript; the hook below resolves its extensionless imports to their .ts files.
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
  return next(spec, context);
}`;

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/parent-findings.mjs <the parent archived at the pinned commit>');
  process.exit(1);
}
register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
const root = resolve(dir);
const at = (path) => pathToFileURL(join(root, path)).href;
const { readCrawlReport } = await import(at('src/crawl/report-read.ts'));
const { siteFindings } = await import(at('src/group/findings.ts'));
const file = join(root, 'test/golden/fixture-site.crawl.json');
process.stdout.write(`${JSON.stringify(siteFindings(readCrawlReport(readFileSync(file, 'utf8'), file)), null, 2)}\n`);
