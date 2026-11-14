# Handoff: what to work on next, and what is waiting on whom

Read `CLAUDE.md` first, then this. `TODO.md` is the chain in order; `docs/DONE.md` is what is finished.

## Where the project stands (2026-11-14)

Stamped from Ghost-Core today; 0.1 (the ghost) and 0.2 (the stack) landed through the gate (J-002). The leaf
holds the prospect-visible vocabulary (`src/leaf/words.ts`) and the CLI its one command; nothing crawls yet.
0.3 landed (J-003): `docs/ROADMAP.md` and `TODO.md` hold the plan through Phase 6, with seven questions for Ghost in Phase W. 0.4 landed (J-004): the review contract REV-01 to REV-09 and seven modules. GR-010 (J-005): three kinds of gate, fast, medium and the sweep, as Suite Builder's; the sweep is to run nightly by a Claude scheduled task that the code session owning this project sets up (`docs/MUTATION.md`, "The sweep"); none exists yet. 0.5 done (J-008, J-009): GR-002 to GR-005, GR-008 and GR-009 in force on Ghost's words; GR-006 (page size) and GR-007 (ranking weights) stand `proposed`, settled at 2.1 and 5.4. Ghost is away (J-008): agents build the roadmap one item after another and send what the documents do not settle to the ruling grade (`docs/when/grades.md`). 0.6, tune-up pass 0, ran (J-010): both full gates green, metrics re-measured, saved on the session branch for the reviewer to land and move to `docs/DONE.md`; its core-update step is open (Ghost-Core not reachable from the session), so 0.6 moved to Phase W (`Waits on: environment`, the ruling grade's answer, J-011); the lineage stays at Core 9a29945 and the core update is owed at landing. 1.1 done (J-012): `docs/CUT.md` lists the 111 parent files (11,707 lines) the review needs, traced by `scripts/cut_closure.py`, each with its Ghostreach path, what it loses at 1.2 and its flags for 1.3; `test/unit/cut.test.ts` holds it, its "every listed file is copied" check an `it.fails` that 1.2 turns into `it`. The ruling grade answered its four questions (J-013, in CUT.md's "The rulings"). 1.2 done (J-013, J-014): 114 files (10,357 lines) under `src/`, cut as CUT.md's rows say; `tsc`, `knip` and `test/unit/cut.test.ts` green; Playwright `~1.63.0` and `@types/node` (GR-011, `proposed`) in the lockfile; `src/crawl/state.ts` split by what it does on the ruling grade's answer (J-014; 390 lines, five sibling files, its public surface unchanged; its behaviour proof owed to 1.6's golden); the fast loop green. 1.3 done (J-016): every flag of the parent's audit and crawl stripped, each fixed at what a bare `suite audit <site>` does (the full audit) or absent; the parser (`parse`, `src/cli/main.ts`) takes `{ site }` and `--help` alone (`test/unit/no-flags.test.ts`); CUT.md's flags table all `stripped`, so `test/unit/cut.test.ts` finds none under `src/`; `src/crawl/other-hosts.ts` cut (offline-only); SITE-35's why loses a parenthesis naming `--offline` (a named loss); the findings' role reading and the page's software words kept, each for a reason in J-016, both listed for the ruling grade. Next: 1.4, the parent's unit tests carried (TODO 1.4's note from 1.3 names the tests that pass a stripped option).

## For Ghost: waiting on you

A. Approve `@types/node` 22.20.5 (with `undici-types` 6.21.0) as a dev dependency, GR-011 `proposed` (J-013): `tsc` cannot check the copied crawl without Node's types. Nothing lands on `main` before your answer; the review rows in `docs/REVIEWED-VERSIONS.md` say UNSURE because the read-only reviewer was not run.

B. The largest-source-file target at 1.2: ruled by the ruling grade (split `src/crawl/state.ts` by what it does, no exemption; C-022, C-023), done in J-014; reversible.

C. `src/audit/links-to-look.ts` is carried from the parent's `src/model/` against GR-004's letter (MOD-05), on the ruling grade's answer (J-013): it builds the audit's "Links that need a look" and holds no Suite IR. Confirm or reverse.

0. The code session that takes this project over sets up the nightly sweep as a Claude scheduled task (`docs/MUTATION.md`, "The sweep"; a night slot between the other projects' sweeps, e.g. 03:23 Central).

1. GR-007, the ranking's weights (`major × 3 + minor × 1`, `proposed`): confirm, amend or refuse; TODO 5.4 asks for the ruling after ten real audits. GR-006, page size, is Phase W's 2.1 below.

## Trials: questions settled by a run, not an argument

(none yet)

## Phase W: the questions waiting on Ghost (TODO.md)

2.1 page size (Letter or A4, GR-006); 2.2 the GitHub address on the PDF; 3.1 SITE-22 under load (GR-008); 4.1 the lead-finder keys and Adzuna's licence; 4.2 paid aggregators of closed job sites; 6.1 hosting a shared queue. Each unblocks the item that builds it.

## Cooldown overrides: remove at a tune-up once past the cooldown (stack README, Cooldown)

The founding lockfile (2026-11-13) refused these as younger than seven days; each is pinned to the highest same-major
version before it by `overrides` in `package.json`. Removed, each comes in by `docs/DEPENDENCY-REVIEW.md` like any update.
  - `@babel/compat-data` held at 8.0.5
  - `@babel/helper-member-expression-to-functions` held at 8.0.5
  - `@babel/generator` held at 8.1.0
  - `@babel/parser` held at 8.1.0
  - `@babel/traverse` held at 8.1.0
  - `@babel/helper-module-transforms` held at 8.1.0
  - `@babel/helper-string-parser` held at 8.0.8
  - `@babel/helpers` held at 8.1.0
  - `@babel/plugin-transform-modules-commonjs` held at 8.0.1
  - `@babel/template` held at 8.0.0
  - `@babel/types` held at 8.1.0
  - `@inquirer/ansi` held at 2.0.10
  - `@inquirer/checkbox` held at 5.2.8
  - `@inquirer/confirm` held at 6.3.5
  - `@inquirer/core` held at 12.0.6
  - `@inquirer/editor` held at 5.3.6
  - `@inquirer/expand` held at 5.1.8
  - `@inquirer/external-editor` held at 3.0.7
  - `@inquirer/figures` held at 2.0.10
  - `@inquirer/input` held at 5.1.9
  - `@inquirer/number` held at 4.2.6
  - `@inquirer/password` held at 5.2.5
  - `@inquirer/prompts` held at 8.7.5
  - `@inquirer/rawlist` held at 5.3.8
  - `@inquirer/search` held at 4.3.6
  - `@inquirer/select` held at 5.2.8
  - `@inquirer/type` held at 4.2.1
  - `@jridgewell/resolve-uri` held at 3.1.2
  - `@rolldown/binding-android-arm-eabi` held at 1.2.16
  - `@rolldown/binding-android-arm64` held at 1.2.16
  - `@rolldown/binding-darwin-arm64` held at 1.2.16
  - `@rolldown/binding-darwin-x64` held at 1.2.16
  - `@rolldown/binding-freebsd-x64` held at 1.2.16
  - `@rolldown/binding-linux-arm-gnueabihf` held at 1.2.16
  - `@rolldown/binding-linux-arm64-gnu` held at 1.2.16
  - `@rolldown/binding-linux-arm64-musl` held at 1.2.16
  - `@rolldown/binding-linux-ppc64-gnu` held at 1.2.16
  - `@rolldown/binding-linux-s390x-gnu` held at 1.2.16
  - `@rolldown/binding-linux-x64-gnu` held at 1.2.16
  - `@rolldown/binding-linux-x64-musl` held at 1.2.16
  - `@rolldown/binding-openharmony-arm64` held at 1.2.16
  - `@rolldown/binding-wasm32-wasi` held at 1.2.16
  - `@rolldown/binding-win32-arm64-msvc` held at 1.2.16
  - `@rolldown/binding-win32-x64-msvc` held at 1.2.16
  - `@rolldown/pluginutils` held at 1.0.1
  - `baseline-browser-mapping` held at 2.11.35
  - `brace-expansion` held at 5.0.12
  - `caniuse-lite` held at 1.0.30001823
  - `electron-to-chromium` held at 1.5.478
  - `node-releases` held at 2.0.63
  - `postcss` held at 8.5.32
  - `rolldown` held at 1.2.16
  - `unbash` held at 6.0.3
  - `vite` held at 8.3.6

Two more overrides are not cooldown pins and stay until Core's check reads the pins (F-004): `path-key` 3.1.1 (npm-run-path asked ^4; path-key 3 is a CJS default export its import takes) and `@oxc-project/types` 0.156.0 (rolldown pins =0.156.0, another asks ^0.155.0; a types-only package). The gate of 2026-11-13 ran green on both.

## Advisories under the gate's threshold (2026-11-14, tune-up pass 0, `npm audit`)

- `@stryker-mutator/core` moderate, via `typed-rest-client` → `qs` 2.2.5–6.16.0 (https://github.com/advisories/GHSA-q8mj-m7cp-5q26, https://github.com/advisories/GHSA-x5fp-wj9c-mxmx, https://github.com/advisories/GHSA-4mjr-xmp4-gh2g, https://github.com/advisories/GHSA-6pq8-jhm2-2vcw): dev-only, DoS in qs
- `minimatch` 7.0.0–11.0.0 moderate (https://github.com/advisories/GHSA-g3hv-75wg-m249): dev-only, through `@stryker-mutator/core`

## For Ghost-Core: findings to report upstream

F-001 to F-006 in `docs/FINDINGS.md` are faults of the template met on a clean stamp (tsconfig compiles the fixtures; Stryker under TypeScript 7; knip's Stryker plugin against Core's own test; the record refusing a package held at two versions; the glossary governing a record of package names; `ship.sh` not executable). Each is fixed here; Core has them to fix for the next stamp.

## What to distrust

(nothing at present: tune-up pass 0 re-measured `docs/AGENT.md`'s Fast loop and Gate cells on this project, 2026-11-14)
