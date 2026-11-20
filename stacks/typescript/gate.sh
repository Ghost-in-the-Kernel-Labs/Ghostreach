#!/usr/bin/env bash
# The TypeScript stack's gate, run by scripts/gate.sh when stacks/typescript/PRESENT exists, in three kinds (GR-010, as
# Suite Builder's G-648): the lockfile install, then
#   --fast    the fast checks, seconds to a minute: the unit tests, typecheck, knip, the cooldown, advisories; the landing;
#   --medium  the fast checks, then the integration project and the crawl specs (Playwright, when playwright.config.ts
#             exists), minutes; the ship when code changed; the weakened-tests notice (never fails);
#   (bare)    the full gate: the medium checks; the release and each tune-up (no mutation: GR-013, refusing Core C-018).
# Each kind ends with one line, `typescript gate: <kind> checks passed` or `typescript gate: passed`.
set -euo pipefail
cd "$(dirname "$0")/../.."
kind=full
case "${1:-}" in
  "") ;;
  --fast) kind=fast;;
  --medium) kind=medium;;
  *) echo "typescript gate: unknown argument $1 (usage: stacks/typescript/gate.sh [--fast | --medium])"; exit 1;;
esac
[ "$(npm --version | cut -d. -f1)" -ge 11 ] || { echo "typescript gate: npm $(npm --version) is below 11 (package.json engines.npm; npm 10 crashes on vitest 4)"; exit 1; }
[ -d node_modules ] || npm ci --ignore-scripts || { echo "typescript gate: npm ci"; exit 1; }
# The fast checks: each a few seconds; together under a minute.
npx vitest run --project unit || { echo "typescript gate: the fast loop"; exit 1; }
npx tsc --noEmit || { echo "typescript gate: tsc"; exit 1; }
npx knip || { echo "typescript gate: knip (something floats: an unused export, file or dependency)"; exit 1; }
node scripts/cooldown.mjs --strict || { echo "typescript gate: a locked version younger than 7 days"; exit 1; }
npm audit --audit-level=high || { echo "typescript gate: a high or critical advisory"; exit 1; }
[ "$kind" != fast ] || { echo "typescript gate: fast checks passed"; exit 0; }
# The medium checks: the tests that spawn, read real data or drive a browser; minutes.
npx vitest run --project integration || { echo "typescript gate: the integration tests"; exit 1; }
if [ -f playwright.config.ts ]; then
  npx playwright test || { echo "typescript gate: the crawl specs"; exit 1; }
fi
node scripts/weakened.mjs || true
[ "$kind" != medium ] || { echo "typescript gate: medium checks passed"; exit 0; }
echo "typescript gate: passed"
