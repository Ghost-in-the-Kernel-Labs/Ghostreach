# Handoff: what to work on next, and what is waiting on whom

Read `CLAUDE.md` first, then this. `TODO.md` is the chain in order; `docs/DONE.md` is what is finished.

## Where the project stands (2026-11-14)

Stamped from Ghost-Core today; 0.1 (the ghost) and 0.2 (the stack) landed through the gate (J-002). The leaf
holds the prospect-visible vocabulary (`src/leaf/words.ts`) and the CLI its one command; nothing crawls yet.
0.3 landed (J-003): `docs/ROADMAP.md` and `TODO.md` hold the plan through Phase 6, with seven questions for Ghost in Phase W. 0.4 landed (J-004): the review contract REV-01 to REV-09 and seven modules. GR-010 (J-005): three kinds of gate, fast, medium and the sweep, as Suite Builder's; the sweep is to run nightly by a Claude scheduled task that the code session owning this project sets up (`docs/MUTATION.md`, "The sweep"); none exists yet. 0.5 done (J-008, J-009): GR-002 to GR-005, GR-008 and GR-009 in force on Ghost's words; GR-006 (page size) and GR-007 (ranking weights) stand `proposed`, settled at 2.1 and 5.4. Ghost is away (J-008): agents build the roadmap one item after another and send what the documents do not settle to the ruling grade (`docs/when/grades.md`). 0.6, tune-up pass 0, ran (J-010): both full gates green, metrics re-measured, saved on the session branch for the reviewer to land and move to `docs/DONE.md`; its core-update step is open (Ghost-Core not reachable from the session), so 0.6 moved to Phase W (`Waits on: environment`, the ruling grade's answer, J-011); the lineage stays at Core 9a29945 and the core update is owed at landing. 1.1 done (J-012): `docs/CUT.md` lists the 111 parent files (11,707 lines) the review needs, traced by `scripts/cut_closure.py`, each with its Ghostreach path, what it loses at 1.2 and its flags for 1.3; `test/unit/cut.test.ts` holds it, its "every listed file is copied" check an `it.fails` that 1.2 turns into `it`. The ruling grade answered its four questions (J-013, in CUT.md's "The rulings"). 1.2 done (J-013, J-014): 114 files (10,357 lines) under `src/`, cut as CUT.md's rows say; `tsc`, `knip` and `test/unit/cut.test.ts` green; Playwright `~1.63.0` and `@types/node` (GR-011, `proposed`) in the lockfile; `src/crawl/state.ts` split by what it does on the ruling grade's answer (J-014; 390 lines, five sibling files, its public surface unchanged; its behaviour proof owed to 1.6's golden); the fast loop green. 1.3 done (J-016): every flag of the parent's audit and crawl stripped, each fixed at what a bare `suite audit <site>` does (the full audit) or absent; the parser (`parse`, `src/cli/main.ts`) takes `{ site }` and `--help` alone (`test/unit/no-flags.test.ts`); CUT.md's flags table all `stripped`, so `test/unit/cut.test.ts` finds none under `src/`; `src/crawl/other-hosts.ts` cut (offline-only); SITE-35's why loses a parenthesis naming `--offline` (a named loss); the findings' role reading and the page's software words kept, each for a reason in J-016, both listed for the ruling grade. 1.4 done (J-017): 54 of the parent's unit tests carried under `test/unit/` (501 tests with Ghostreach's own, about 6 s, all in the `unit` project: each fakes the browser or serves on 127.0.0.1), five dropped and the trimmed ones each with a line in CUT.md ("dropped or trimmed at 1.4", held by `test/unit/cut.test.ts`); the parent's three fixture crawls under `test/golden/`; 26 exports back. Two changes to `src/`: `incompleteChain` takes Node 24's hint after its phrase (else the relaxed robots.txt read and SITE-37 never run under Node 24; CUT.md "Where the copy differs"), and `CrawlSettings.userAgent` folded into `DEFAULT_USER_AGENT` (now in `src/leaf/report.ts`), the ruling grade's condition on 1.3's choices, which it kept all four of (J-017). SITE-29's why and SITE-06's title, open then, were settled at 1.6 (J-019). 1.5 done (J-018): `ghostreach <site>` (`main` in `src/cli/main.ts`, `src/project/review.ts`) crawls with the bare defaults and writes `<host>.crawl.json`, `AUDIT.html`, `findings.json` and `summary.json` into `<data>/<host>-<date>/`; `test/crawl/ghostreach.spec.ts` (the medium gate, about 45 s in the session's Chromium at `/opt/pw-browsers`) holds its findings for the parent's fixture byte for byte to the parent's own (`test/golden/fixture-site.findings.json`, written by the parent's code at `a4c8045` through `scripts/parent-findings.mjs`); knip's five copy roots dropped, ten names they alone kept alive unexported or cut. Open for the ruling grade, each the agent's choice (J-018): the data folder `~/Ghostreach`; the folder's date the crawl's start day in UTC; a second review that day `-2`, `-3`; the folder named by the host typed. Nothing runs `ghostreach` outside a test until 5.1's packaging. 1.6 done (J-019): `test/golden/fixture-site.AUDIT.html` is the parent's own page for its fixture crawl (`scripts/parent-findings.mjs ... audit`, recorded with `UPDATE_GOLDEN=1` by `test/unit/audit-golden.test.ts`, which archives the parent read only); this program's page differs from it in the title line, the footer and `LOOK_INTRO`'s last sentence and nowhere else (`test/support/audit-golden.ts`'s `ALLOWED`), over the parent's crawl and over a live crawl normalised only in its origin and day; the behaviour proof of 1.2's split and 1.3's cuts. The ruling grade's rule on prospect-visible words applied (J-019): the leaf bans "problem found", not "problem", so SITE-29's why stands and the page is held to the leaf's list. Open for the ruling grade, the agent's choice: the title `Site audit: <host> | Suite Builder` and the footer's added "Prepared with Suite Builder, Ghost in the Kernel Labs." 1.7 done (J-020): `docs/CUT.md`'s "The resync recipe" is mechanical moves (`skip`, `apply`, `trimmed`, `split`, `whole`, `new`, `gone`, `flag`), listed for any range of the parent's commits by `python3 -I scripts/resync_moves.py <fresh clone> <pin> <target>` (a dry run; `test/test_resync_moves.py`); its dry run against the parent's HEAD `e7dd523` lists one move (the carried `test/unit/audit.test.ts`; nothing of `src/` changed past the pin), and a rehearsal over `681a783..a4c8045` four, each read against the copy; nothing applied, the pin still `a4c8045`. Open for the ruling grade, the agent's choices (J-020): the moves cover the carried tests and the fixture, not only `src/`; a hunk lands where most of its lines are. 1.8, tune-up pass 1, ran (J-021): the cold full gate refused at the TypeScript stack's gate after 136 min (the first full gate since the copy; see "What to distrust" and For Ghost F); the debriefs of 1.1 to 1.7 reviewed, the navigation log wiped; the pin written once, in `docs/CUT.md`'s `Parent commit:` line (`test/support/pin.ts`), a refactor proved by the fast and medium gates and the golden re-recorded byte for byte; its core-update step open again (Ghost-Core unreachable), so 1.8 moved to Phase W as 0.6 was; saved for the reviewer, who lands the `tune-up:` commit. 2.1 and 2.2 settled by Ghost in chat (J-022): Letter (GR-006) and github.com/ghost-in-the-kernel (GR-012). Next: 2.3.

## For Ghost: waiting on you

A. Approve `@types/node` 22.20.5 (with `undici-types` 6.21.0) as a dev dependency, GR-011 `proposed` (J-013): `tsc` cannot check the copied crawl without Node's types. Nothing lands on `main` before your answer; the review rows in `docs/REVIEWED-VERSIONS.md` say UNSURE because the read-only reviewer was not run.

B. The largest-source-file target at 1.2: ruled by the ruling grade (split `src/crawl/state.ts` by what it does, no exemption; C-022, C-023), done in J-014; reversible.

C. `src/audit/links-to-look.ts` is carried from the parent's `src/model/` against GR-004's letter (MOD-05), on the ruling grade's answer (J-013): it builds the audit's "Links that need a look" and holds no Suite IR. Confirm or reverse.

D. What a prospect reads differently from the parent's audit, each a deleted clause on the ruling grade's rule (J-019), named in `docs/CUT.md` ("Named losses"): `LOOK_INTRO`'s last sentence (the suite's expected-links block) and SITE-35's parenthesis naming `--offline`. And SITE-06's title keeps "the suite's tests" byte for byte, the parent's words: you may ask for that clause to go.

E. The audit page's title line and footer, the agent's choice at 1.6 (J-019), minimal until 2.4's brand: `Site audit: <host> | Suite Builder`, and the parent's footer followed by "Prepared with Suite Builder, Ghost in the Kernel Labs.". Confirm or amend.

0. The code session that takes this project over sets up the nightly sweep as a Claude scheduled task (`docs/MUTATION.md`, "The sweep"; a night slot between the other projects' sweeps, e.g. 03:23 Central).

1. GR-007, the ranking's weights (`major × 3 + minor × 1`, `proposed`): confirm, amend or refuse; TODO 5.4 asks for the ruling after ten real audits. GR-006 (Letter) and GR-012 (github.com/ghost-in-the-kernel) are in force on Ghost's word (J-022).

F. The full gate is red at mutation, a fix-forward item for a roadmap line (J-021): the copied code was never mutated here. The cold run (tune-up pass 1) ran 68 of 116 source files in 136 min, each uncacheable (`src/audit/audit.ts` reads the file system), 2,637 mutants surviving in 63 of them with no line in `docs/MUTATION.md`, and stopped at `src/findings/findings.ts`, whose initial test run fails under Stryker: `test/unit/audit.test.ts`'s `ruleFiles` misses the instrumented files, the one move of 1.7's dry run (the parent's fix past the pin, `e7dd523`). Options: (a) a Phase 2 item that applies that one resync move, then kills or writes up the survivors file by file (as the sweep does), the gate's time measured after; (b) the copied files left out of `scripts/mutate.mjs`'s run until 5.5's resync, their tests the parent's; (c) the Gate target moved by a decision. Recommendation: (a), the move alone first, since it is a test change the parent already made.

## Trials: questions settled by a run, not an argument

(none yet)

## Phase W: the questions waiting on Ghost (TODO.md)

3.1 SITE-22 under load (GR-008); 4.1 the lead-finder keys and Adzuna's licence; 4.2 paid aggregators of closed job sites; 6.1 hosting a shared queue. Each unblocks the item that builds it.

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

## Advisories under the gate's threshold (2026-11-14, tune-up pass 1, `npm audit`: unchanged since pass 0)

- `@stryker-mutator/core` moderate, via `typed-rest-client` → `qs` 2.2.5–6.16.0 (https://github.com/advisories/GHSA-q8mj-m7cp-5q26, https://github.com/advisories/GHSA-x5fp-wj9c-mxmx, https://github.com/advisories/GHSA-4mjr-xmp4-gh2g, https://github.com/advisories/GHSA-6pq8-jhm2-2vcw): dev-only, DoS in qs
- `minimatch` 7.0.0–11.0.0 moderate (https://github.com/advisories/GHSA-g3hv-75wg-m249): dev-only, through `@stryker-mutator/core`

## For Ghost-Core: findings to report upstream

F-001 to F-006 in `docs/FINDINGS.md` are faults of the template met on a clean stamp (tsconfig compiles the fixtures; Stryker under TypeScript 7; knip's Stryker plugin against Core's own test; the record refusing a package held at two versions; the glossary governing a record of package names; `ship.sh` not executable). Each is fixed here; Core has them to fix for the next stamp.

## What to distrust

`docs/AGENT.md`'s Gate cell (0.4 min) is pass 0's, before the copy: the full gate now runs mutation over 116 copied source files, none cacheable, and is red there (For Ghost F); pass 1 measured no warm minutes to replace it with. The fast and medium gates' times are current (0.58 and 1.45 min, 2026-11-14).
