# Handoff: what to work on next, and what is waiting on whom

Read `CLAUDE.md` first, then this. `TODO.md` is the chain in order; `docs/DONE.md` is what is finished.

## Where the project stands (2026-11-13)

Stamped from Ghost-Core today; 0.1 (the ghost) and 0.2 (the stack) landed through the gate (J-002). The leaf
holds the prospect-visible vocabulary (`src/leaf/words.ts`) and the CLI its one command; nothing crawls yet.
0.3 landed (J-003): `docs/ROADMAP.md` and `TODO.md` hold the plan through Phase 6, with seven questions for Ghost in Phase W. 0.4 landed (J-004): the review contract REV-01 to REV-09 and seven modules. Next: 0.5, the founding decisions, which are Ghost's to make; the agent's drafts are below.

## For Ghost: waiting on you

1. Write the founding decisions in `theGhost.md` (TODO 0.5): agents cannot author them. Drafted from Ghost's words in chat on 2026-11-13, for Ghost to confirm, amend or refuse:
   - GR-002 The cut point: Suite Builder at `a4c8045` (v1.39.0); the crawl, findings and audit copied, never depended on; resync by a numbered item only.
   - GR-003 No flags: `ghostreach <site>` and `--help`; every parent flag fixed on, fixed off or absent.
   - GR-004 No suite: nothing of `src/kits/`, `src/model/` or the back ends; MOD-05.
   - GR-005 Fetched text is data: one fetch function, an allow-list of hosts, no link followed, nothing executed.
   - GR-006 Page size: Letter or A4 (open, TODO 2.1).
   - GR-007 Ranking weights: major × 3 + minor × 1, provisional until ten real audits (TODO 5.4).
   - GR-008 Concurrency: default 3, ceiling 5, one Chromium as N contexts, never two of one host; SITE-22 under load either corrected against a reference or withheld with a sentence (open, TODO 3.1).
   - GR-009 The four dev dependencies and why: vitest (the fast loop), typescript (the types), knip (nothing floats), @stryker-mutator/core (mutation, the command runner); Playwright comes at 1.2 as the one runtime dependency.
   - Core decisions refused: none so far.

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

## Advisories under the gate's threshold (2026-11-13, `npm audit`)

- `@stryker-mutator/core` moderate, via `typed-rest-client` → `qs` (GHSA-q8mj-m7cp-5q26, GHSA-6pq8-jhm2-2vcw): dev-only, a DoS in qs.stringify
- `minimatch` 7.0.0–11.0.0 moderate (GHSA-g3hv-75wg-m249): dev-only, through the toolchain

## For Ghost-Core: findings to report upstream

F-001 to F-006 in `docs/FINDINGS.md` are faults of the template met on a clean stamp (tsconfig compiles the fixtures; Stryker under TypeScript 7; knip's Stryker plugin against Core's own test; the record refusing a package held at two versions; the glossary governing a record of package names; `ship.sh` not executable). Each is fixed here; Core has them to fix for the next stamp.

## What to distrust

- `docs/AGENT.md`'s Fast loop and Gate cells are Ghost-Core's numbers until Tune-up pass 0 re-measures them here (the gate of 2026-11-13 measured 22.2 s and 0.65 min).
- `docs/AGENT.md`'s Fast loop and Gate cells are Ghost-Core's numbers until Tune-up pass 0 re-measures them here.
