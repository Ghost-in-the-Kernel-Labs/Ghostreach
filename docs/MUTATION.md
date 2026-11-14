# Mutation: cut from this project

Ghostreach runs no mutation testing (GR-013, Ghost in chat, 2026-11-14: "Cut the mutant testing. Its been copied in
and is mostly already done for the crawl. There are minimal benefits from it, and suite builder needed it for the
compiler. Our faults are less systemic if they occur."). It refuses Core C-018 for itself: no mutation tool, no
survivors listed here, no mutation step in the full gate, the sweep or a tune-up. Stryker, its config and its runner
are gone from the tree and the lockfile (J-024).

What stays of C-018: a test is never weakened to make code pass, and `scripts/weakened.mjs` lists a weakened one for
the reviewer in the medium gate. What stays of the checks' own proof: each check rejects a planted break (C-001, AGT-06).

This file stays so that C-018, which names it, points at the reason it is empty; Core's `test/test_stacks.py` reads
GR-013 and leaves the runner's checks aside (F-007).

## The sweep (GR-010)

The slow overnight run: `scripts/sweep.sh`, the cold full gate (`GHOST_COLD=1 scripts/gate.sh`: the medium checks, the
integration tests and the crawl specs among them, then the metrics, checked and never written), its log under
`build/sweep/`, never committed. Without mutation it is a nightly medium gate over `origin/main` in a fresh session: it
catches what the fast landings let through (a crawl spec or an integration test broken since the last ship). Not a gate:
nothing lands or ships on it, and what it finds is fixed forward, never a reason to undo a landing (C-040). A Claude agent
runs it nightly: the code session that owns this project sets up the scheduled task (a fresh session on this repository
each night; Ghost, 2026-11-14), never a GitHub scheduled trigger (C-032). Where the task's brief and this section
differ, this section wins.

The sweep session: setup from `origin/main` on a branch `sweep-<date>`; `scripts/sweep.sh`; on a passed verdict, report and
stop. Otherwise fix what it found there and then, one attempt each, by the step that failed. It never weakens a test,
raises a limit or a metric target, edits a decision's text, touches an auto-execution surface (`docs/SUPPLY-CHAIN.md`) or
a setting, adds or updates a dependency, or runs anything against a real website. What it cannot settle goes to
`docs/HANDOFF.md` under "For Ghost". It lands through `scripts/gate.sh --medium` and `scripts/commit.sh` with the subject
`sweep: <files>: <what>`, then `bash scripts/ship.sh`; a due tune-up stops it (the work stays on its branch, pushed by
`scripts/save.sh`, and the summary says so). Its last message, under ten lines: the verdict line, what was fixed, what
shipped, the cold gate's minutes, any question for Ghost.
