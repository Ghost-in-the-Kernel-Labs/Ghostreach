# Navigation log: what agents found hard to find

Each new task goes to a fresh agent of the grade it is placed at (C-026, C-036; `docs/when/grades.md`). At the end of its task the agent
debriefs here: one entry, its complaints and suggestions about finding its way (routing rows,
documents, names, rules that were unclear), not about the task's code. "none" is an answer.

**The review is part of every tune-up** (steps 4 and 5 of `docs/when/tune-up.md`; C-024, C-025;
`scripts/commit.sh` says when one is due): read the entries for what agents who did not see each other converge on; wipe the entries
(git keeps them); check each item against the code and act on the valid ones; take an open question
to the ruling grade; record the review in the journal; set the line below to the commit the
review ran at (`git rev-parse --short HEAD`, not the tune-up's own, which does not exist yet). Each entry's **Opened** list, read against the routing row its task matched, is the measure
of whether a fresh agent found its way: files, in order; `CLAUDE.md` does not count.

Last review: c14b7e0 (2026-11-14, tune-up pass 0)

## Entries

An entry is `### <date> · <task> · <model>` and these lines:

- **Task**: what the agent was asked.
- **Opened**: the files it opened, in order.
- **Complaints**: what slowed or misled it.
- **Suggestions**: what it would change.

### 2026-11-14 · TODO 0.5 closed, then tune-up pass 0 · Opus

- **Task**: close 0.5 by its check (GR-006 and GR-007 carried by 2.1 and 5.4) and run tune-up pass 0.
- **Opened**: `TODO.md`, `docs/HANDOFF.md`, `docs/when/tune-up.md`, `docs/when/handoff.md`, `docs/when/long-run.md`, `docs/journal/J-000-099.md`, `scripts/checks/todo.py`, `test/test_todo.py`, `theGhost.md`, `docs/ROADMAP.md`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`, `docs/JOURNAL.md`, `scripts/save.sh`, `stacks/typescript/README.md`, `scripts/gate.sh`, `docs/when/core-update.md`, `docs/AGENT.md`.
- **Complaints**: the container's default npm is 10 and the stack gate refuses it; nothing said npm 11 is at `/opt/node24/bin` (found by listing `/opt`). The tune-up's step 6 said "commit nothing yourself" where a session branch saves (C-040). The core-update step needs a Ghost-Core clone, which this session cannot reach (private repository, no access granted), and says nothing for that case. The process path's grade check refused "Fable" in `docs/HANDOFF.md` though J-008 and the brief name the model; caught at once, fine.
- **Suggestions**: `docs/AGENT.md` "The machine" names the Node 24 path (done); `docs/when/core-update.md` gains a line for a session without Core: the step goes open, named in the hand-back.

### 2026-11-14 · TODO 1.1, docs/CUT.md · Opus

- **Task**: write `docs/CUT.md` and `test/unit/cut.test.ts` before the copy, from the parent's imports at `a4c8045`.
- **Opened**: `TODO.md`, `docs/HANDOFF.md`, `docs/ROADMAP.md`, `docs/when/handoff.md`, `docs/journal/J-000-099.md`, `docs/modules.json`, `package.json`, `vitest.config.ts`, `tsconfig.json`, `knip.json`, `test/unit/words.test.ts`, `test/unit/main.test.ts`, `src/cli/main.ts`, `scripts/weakened.mjs`, `stacks/typescript/gate.sh`, `theGhost.md`, `docs/CONTRACT.md`, `docs/AGENT.md`, `scripts/fast.sh`, `test/support.py`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`, `scripts/checks/todo.py`; the parent's files at `a4c8045` through an archive in the scratchpad.
- **Complaints**: nothing said how a check that is red by design stays in a green gate (found `it.fails` by reasoning, and that the weakened-tests notice flags `skip`); `docs/ROADMAP.md` §5's "no file lists a stripped flag" read as a 1.2 check though the flags go at 1.3; `docs/CONTRACT.md`'s "a threshold lives in the leaf" decided the module map and is not where a module question would look (`docs/modules.json`); GR-004 forbids `src/model/` while the audit's own section lives there.
- **Suggestions**: `stacks/typescript/README.md` names `it.fails` as the shape of a check that fails before its item and passes after; §5's CUT.md row says the flag check is armed by 1.3.


### 2026-11-14 · TODO 1.2, the parent's crawl copied · Opus

- **Task**: copy `docs/CUT.md`'s list from Suite Builder at `a4c8045`, cut as its rows say, and record the ruling grade's answers to 1.1's questions.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `docs/journal/J-000-099.md`, `docs/CUT.md`, `test/unit/cut.test.ts`, `docs/modules.json`, `package.json`, `tsconfig.json`, `knip.json`, `scripts/checks/modules.py`, `stacks/typescript/gate.sh`, `docs/DEPENDENCY-REVIEW.md`, `docs/REVIEWED-VERSIONS.md`, `scripts/cooldown.mjs`, `scripts/review_scan.py`, `scripts/checks/dependency_review.py`, `theGhost.md`, `docs/AGENT.md`, `scripts/checks/metrics.py`, `test/test_metrics.py`, `docs/when/escalation.md`, `docs/CONTRACT.md`, `docs/DONE.md`, `docs/when/handoff.md`.
- **Complaints**: CUT.md said the 400-line target was unarmed until there was source; it is armed (378, a script), so a copy that "records, not splits" can never pass the fast loop, and the metric rule forbids the only edits that would. "Knip: no unused export" meets the parent's exports for its own tests (54 of them) a whole item before those tests arrive. The dependency review asks for a read-only reviewer agent and a web-search agent; a worker without an Agent tool can run neither, and the record has no shape for "not run". `python3 -I -m unittest` cannot import `test` (the `-I` drops the working directory).
- **Suggestions**: `docs/AGENT.md`'s metric could exempt a copied file whose row in CUT.md says it is over, or CUT.md could say which way before a copy; the dependency review could name what a worker without agents records (a `not run` note and an UNSURE verdict is what this one did).

### 2026-11-14 · TODO 1.2 finished, `state.ts` split · Opus

- **Task**: split `src/crawl/state.ts` by what it does on the ruling grade's answer, so the armed largest-file metric holds and the fast loop is green.
- **Opened**: `CLAUDE.md`, `docs/HANDOFF.md`, `src/crawl/state.ts`, `docs/AGENT.md`, `scripts/metrics.py`, `test/unit/cut.test.ts`, `docs/CUT.md`, `docs/modules.json`, `knip.json`, `tsconfig.json`, `src/crawl/discovery.ts`, `src/crawl/providers.ts`, `src/crawl/frontier.ts`, `src/leaf/report.ts`, `docs/journal/J-000-099.md`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: nothing says how to prove a split of a class with private (`#`) fields changes no result before 1.6's golden exists; a scripted old-against-new comparison in the scratchpad did it.
- **Suggestions**: `stacks/typescript/README.md` could name that comparison (both versions compiled to the scratchpad, one script driving each) as the proof a split owes until a golden exists.

### 2026-11-14 · TODO 1.3, the flags stripped · Opus

- **Task**: strip every flag of the parent's audit and crawl from the copy, each fixed at the full audit's value or absent; `Values` to `{ site: string }`; CUT.md's flag rows `stripped`.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `docs/CUT.md`, `src/cli/main.ts`, `test/unit/cut.test.ts`, `test/unit/words.test.ts`, `test/unit/main.test.ts`, `src/crawl/options.ts`, `src/audit/audit.ts`, `src/crawl/loop.ts`, `src/leaf/report.ts`, the parent's `src/cli/parse.ts` and `src/cli/commands/audit.ts` at `a4c8045`, then each file `tsc` and `grep` named; `docs/journal/J-000-099.md`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`, `docs/when/handoff.md`.
- **Complaints**: CUT.md's "Flags at 1.3" column names flag words, not what each flag reaches: `--offline` alone touched eleven files and a whole one (`other-hosts.ts`), `--vulnsec` the catalogue's `option` field and the audit's `requested` parameters, and `load.software` reads as `--vulnsec`'s input though the parent records it in every crawl. Telling dead code from code that only looks dead needed the parent's `crawlLimits` (what a bare audit passes) and the golden's demands (1.6) side by side; neither document points at the other.
- **Suggestions**: CUT.md's flags table carries, per flag, the parent's bare-audit value and the report fields it writes (now its "Fixed at" column does the first); 1.6's golden could name the report fields an audit's output depends on beside the findings (a page's `load` presence decides "ran" against "not confirmed").

### 2026-11-14 · TODO 1.4, the parent's unit tests carried · Opus

- **Task**: carry CUT.md's 55 whole and 5 partial unit tests from `a4c8045`, re-pointed; drop or trim what tests a cut, each with its line; unit project green under 30 s.
- **Opened**: `CLAUDE.md`, `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `docs/journal/J-000-099.md`, `docs/CUT.md`, `vitest.config.ts`, `package.json`, `tsconfig.json`, `knip.json`, `test/unit/cut.test.ts`, `test/unit/words.test.ts`, `scripts/gate.sh`, `stacks/typescript/gate.sh`, `theGhost.md` (C-033), `src/leaf/words.ts`, then each source file a failing test named; the parent's tests, helpers and goldens at `a4c8045`; `docs/DONE.md`, `docs/NAVIGATION-LOG.md`, `docs/when/handoff.md`.
- **Complaints**: CUT.md listed `near-copies.test.ts` and `reasons-wording.test.ts` as carried whole though their subjects are in its own "Traced, not copied"; the tracing counted the test's imports at 1.1, before 1.2 left files out. The parent's tests read goldens and data (`test/golden/*.crawl.json`, `test/data/address-reach.json`) that CUT.md's list of helpers did not name. A failure that comes from the runtime (Node 24's TLS message) and not from the cut has no row to look in; it looked like a cut until the same test passed under Node 22.
- **Suggestions**: `scripts/cut_closure.py` could trace a test's closure after the "Traced, not copied" list, and follow `readFileSync` of a path under `test/` as a dependency; the stack README could say to run a red carried test under the parent's Node too before blaming the cut.

### 2026-11-14 · TODO 1.5, one command · Opus

- **Task**: `ghostreach <site>` writes its review into `<data>/<host>-<date>/`; `test/crawl/ghostreach.spec.ts` holds its findings for the fixture to the parent's.
- **Opened**: `docs/HANDOFF.md`, `docs/ROADMAP.md`, `TODO.md`, `docs/when/handoff.md`, `docs/journal/J-000-099.md`, `package.json`, `knip.json`, `src/cli/main.ts`, `docs/CUT.md`, `src/project/crawl.ts`, `src/audit/audit.ts`, `docs/CONTRACT.md`, `docs/modules.json`, `test/unit/main.test.ts`, `scripts/gate.sh`, `stacks/typescript/gate.sh`, `vitest.config.ts`, `src/audit/page-counts.ts`, `src/leaf/words.ts`, `test/unit/cut.test.ts`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`, `.gitignore`; the parent's audit command, crawl glue, fixture server, crawl specs and Playwright config at `a4c8045`.
- **Complaints**: no document names where `<data>` is (REV-06 and the roadmap use it, nothing sets it), nor how the date is taken; "the parent's findings for the fixture" did not say whether that means the parent's code's output or this program's over the parent's crawl; nothing said how a test reaches a folder the salesperson may not name (no flag); `test/unit/cut.test.ts` reads "Ghostreach's own files" as bare paths, so a description after the path fails it with no hint why.
- **Suggestions**: `docs/CONTRACT.md` REV-06 names the data folder's default once ruled; CUT.md's own-files section says "the bare path, nothing after it".

