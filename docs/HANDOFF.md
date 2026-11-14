# Handoff: what to work on next, and what is waiting on whom

Read `CLAUDE.md` first, then this. `TODO.md` is the chain in order; `docs/DONE.md` is what is finished.

## Where the project stands (2026-11-13)

Stamped from Ghost-Core today; 0.1 (the ghost) and 0.2 (the stack) landed through the gate (J-002). The leaf
holds the prospect-visible vocabulary (`src/leaf/words.ts`) and the CLI its one command; nothing crawls yet.
Next: 0.3, the roadmap and TODO (the draft is at Ghost's side; it becomes `docs/ROADMAP.md`).

## For Ghost: waiting on you

1. Write the roadmap's §1 to §6 and Phase 1's items in `TODO.md` (TODO 0.3).
2. Write the first invariants of the contract and set `docs/modules.json` (TODO 0.4).
3. Write the founding decisions in `theGhost.md`, a decision for each core decision this project refuses among them (TODO 0.5): agents cannot author them.

## Trials: questions settled by a run, not an argument

(none yet)

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

F-001 to F-005 in `docs/FINDINGS.md` are faults of the template met on a clean stamp (tsconfig compiles the fixtures; Stryker under TypeScript 7; knip's Stryker plugin against Core's own test; the record refusing a package held at two versions; the glossary governing a record of package names). Each is fixed here; Core has them to fix for the next stamp.

## What to distrust

- `docs/AGENT.md`'s Fast loop and Gate cells are Ghost-Core's numbers until Tune-up pass 0 re-measures them here (the gate of 2026-11-13 measured 22.2 s and 0.65 min).
- `docs/AGENT.md`'s Fast loop and Gate cells are Ghost-Core's numbers until Tune-up pass 0 re-measures them here.
