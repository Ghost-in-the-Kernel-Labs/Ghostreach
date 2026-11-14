# Mutation: every survivor explained

This file is a template: a stamped project keeps the text and adds its survivors under the heading below.

`scripts/mutate.mjs` runs Stryker one source file at a time with only the tests that reach the file
(C-018; the command runner, because Stryker's own vitest runner once tested nothing after its first
pass and the scores were fake, Suite Builder G-290). A mutant no test kills is a survivor, and a
survivor is either killed by a better test or written up here, one line each:

    - <file>:<line> <mutator> — why the code is right as written and no test can tell the mutant apart

A line here with no survivor behind it is stale and fails the gate, so this list shrinks as tests
improve. A source file no test reaches is red, and so is a run that kills nothing when there were
mutants: then the runner may have tested nothing.

A file's report is cached under `reports/mutation/cache/`, keyed by a SHA-256 over every
byte that can change its verdict: the file, the tests that reach it, everything those tests load
(the other sources, helpers, goldens, fixtures), the configs, the setup files `vitest.config.ts`
names, every tsconfig in the `extends` chain, the lockfile, `scripts/mutate.mjs` and the tool versions. A hit replays the report and its line says `cached`; a file whose tests load
something the key cannot see (the file system, the environment) is never cached. The check above
reads this file afresh on every run. `--no-cache` or `MUTATE_CACHE=0` runs everything; a tune-up
pass does, so the gate's time is the full run. The cache can be deleted at any time.

Not mutated: `scripts/*.mjs`, the gate's own tooling: `mutate.mjs` and the rest run `git`, Stryker or a
build when invoked, and the gate running them is what holds them. `mutate.mjs` exports its graph and
key functions, and `test/test_stacks.py` runs them through `node` on `test/fixtures/typescript-graph/`;
the other scripts have no unit tests of their own until the project writes them.

## Survivors

None yet.

## The sweep (GR-010)

The slow overnight run: `scripts/sweep.sh`, the cold full gate (`GHOST_COLD=1 scripts/gate.sh`: every cache off, so every
mutant of every file is tried), its log under `build/sweep/`, never committed. Not a gate: nothing lands or ships on it, and
what it finds is fixed forward, never a reason to undo a landing (C-040). A Claude scheduled task named "Ghostreach nightly
sweep" opens a fresh session on this repository at 03:23 America/Chicago each night and runs it (never a GitHub scheduled
trigger: C-032). Where its brief and this section differ, this section wins.

The sweep session: setup from `origin/main` on a branch `sweep-<date>`; `scripts/sweep.sh`; on a passed verdict, report and
stop. Otherwise fix what it found there and then, one attempt each: a surviving mutant gets a unit test that kills it
(preferred) or a line in this file; any other red step is fixed by the step that failed. It never weakens a test, raises a
limit or a metric target, edits a decision's text, touches an auto-execution surface (`docs/SUPPLY-CHAIN.md`) or a
setting, adds or updates a dependency, or runs anything against a real website. What it cannot settle goes to
`docs/HANDOFF.md` under "For Ghost". It lands through `scripts/gate.sh --medium` and `scripts/commit.sh` with the subject
`sweep: <files>: <what>`, then `bash scripts/ship.sh`; a due tune-up stops it (the work stays on its branch, pushed by
`scripts/save.sh`, and the summary says so). Its last message, under ten lines: the verdict line, what was killed or
explained, what shipped, the cold gate's minutes, any question for Ghost.
