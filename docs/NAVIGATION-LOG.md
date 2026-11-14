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

Last review: 836f363 (2026-11-14, tune-up pass 1)

## Entries

An entry is `### <date> · <task> · <model>` and these lines:

- **Task**: what the agent was asked.
- **Opened**: the files it opened, in order.
- **Complaints**: what slowed or misled it.
- **Suggestions**: what it would change.

### 2026-11-14 · TODO 1.8, tune-up pass 1 · Opus

- **Task**: tune-up pass 1 by `docs/when/tune-up.md`: the full gate, the debriefs since c14b7e0, the pin written once, the wipe; 1.8 to Phase W if the core-update step alone cannot run.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/when/tune-up.md`, `docs/journal/J-000-099.md`, `docs/when/long-run.md`, `scripts/gate.sh`, `docs/NAVIGATION-LOG.md`, `docs/ROADMAP.md`, `docs/LESSONS.md`, `test/unit/cut.test.ts`, `test/unit/audit-golden.test.ts`, `scripts/parent-findings.mjs`, `docs/CUT.md`, `scripts/resync_moves.py`, `docs/when/core-update.md`, `stacks/typescript/gate.sh`, `scripts/mutate.mjs`, `docs/MUTATION.md`, `docs/AGENT.md`, `test/support/audit-golden.ts`, `knip.json`, `docs/paths/process.md`, `docs/DONE.md`, `docs/when/handoff.md`.
- **Complaints**: nothing warned that the full gate had not run since the copy: its mutation step now takes over two hours (no copied file is cacheable: `src/audit/audit.ts` reads the file system) and is red, which the pass found only by running it; `docs/AGENT.md`'s Gate cell still says 0.4 min. The item's brief asked for Phase 1's roadmap section shrunk per P-06 while the tune-up's may-not list holds `docs/ROADMAP.md`; the tune-up won. The core-update step again had no Core (the second pass to meet it).
- **Suggestions**: a line in `docs/MUTATION.md` or the stack README saying a bulk copy makes the next full gate long and red until its survivors are written up, so the item after a copy measures it; the reviewer decides whether P-06's shrink is a tune-up's write.

### 2026-11-14 · TODO 2.3, the audit HTML as a PDF · Opus

- **Task**: build `src/pdf/pdf.ts` (US Letter, GR-006), write the PDF into the review's folder, and check it with a PDF reader of the tests' own, no dependency.
- **Opened**: `docs/HANDOFF.md`, `docs/ROADMAP.md`, `TODO.md`, `docs/journal/J-000-099.md`, `docs/when/handoff.md`, `docs/modules.json`, `theGhost.md`, `src/project/review.ts`, `test/crawl/ghostreach.spec.ts`, `playwright.config.ts`, `src/project/crawl.ts`, `src/audit/audit.ts`, `src/cli/main.ts`, `test/support/pin.ts`, `test/unit/audit-golden.test.ts`, `vitest.config.ts`, `knip.json`, `tsconfig.json`, `test/unit/main.test.ts`, `docs/CUT.md`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: the brief says "RF-03" and GR-006's "Held by" names the file, but neither says where RF-03 lives (`docs/ROADMAP.md`'s table, found by grep). Node's type stripping refuses parameter properties, which a test helper run outside vitest meets first; nothing says helpers should avoid them.
- **Suggestions**: a line in the stack README that `test/support/` is TypeScript Node can strip (no parameter properties, no enums), so a helper can be run by `node` alone for a look.


### 2026-11-14 · Ghost's ruling: mutation cut (GR-013) · Opus

- **Task**: carry out Ghost's word "Cut the mutant testing": remove Stryker and everything only it brought, the gate's mutation step and its documents; record the refusal of Core C-018; make Core's checks hold the choice.
- **Opened**: `docs/MUTATION.md`, `docs/HANDOFF.md`, `docs/AGENT.md`, `theGhost.md`, `docs/journal/J-000-099.md`, `test/test_ghost.py`, `scripts/checks/ghost.py`, `package.json`, `knip.json`, `stacks/typescript/gate.sh`, `stacks/typescript/README.md`, `scripts/sweep.sh`, `scripts/gate.sh`, `test/test_stacks.py`, `docs/FINDINGS.md`, `docs/when/core-update.md`, `docs/DEPENDENCY-REVIEW.md`, `docs/REVIEWED-VERSIONS.md`, `scripts/checks/dependency_review.py`, `docs/when/dependency-update.md`, `scripts/metrics.py`, `scripts/checks/agent_table.py`, `scripts/checks/pointers.py`, `docs/paths/process.md`, `docs/when/tune-up.md`, `docs/when/long-run.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: nothing says how a dependency's removal is recorded: `docs/DEPENDENCY-REVIEW.md` and `docs/when/dependency-update.md` cover additions and updates, so whether a removed package's baseline rows stay was a guess (kept). No document says how a project refuses a core decision that a Core check enforces (F-007). `theGhost.md`'s entries are single long lines, so `sed -n` on a range printed 45 KB.
- **Suggestions**: one line in `docs/when/dependency-update.md` for a removal (the lockfile diff shows only deletions; the rows stay as the record); Core's checks read a project's refusal the way `test/test_stacks.py` now does here.

### 2026-11-14 · TODO 2.4, the brand: cover page and footer · Opus

- **Task**: the PDF's cover page and running footer with Ghost's address (GR-012), the address one leaf constant, checked by `test/unit/words.test.ts` on every page's text.
- **Opened**: `docs/HANDOFF.md`, `docs/ROADMAP.md`, `TODO.md`, `src/pdf/pdf.ts`, `src/leaf/words.ts`, `test/unit/words.test.ts`, `test/unit/pdf.test.ts`, `test/support/banned-words.ts`, `test/crawl/ghostreach.spec.ts`, `vitest.config.ts`, `playwright.config.ts`, `package.json`, `stacks/typescript/gate.sh`, `src/project/review.ts`, `src/audit/audit.ts`, `tsconfig.json`, `docs/modules.json`, `test/support/pdf-text.ts`, `knip.json`, `docs/CUT.md`, `test/unit/cut.test.ts`, `docs/DONE.md`, `docs/when/handoff.md`, `docs/journal/J-000-099.md`, `docs/NAVIGATION-LOG.md`, `theGhost.md`.
- **Complaints**: the check names a unit-folder file for a check that needs the real Chromium, and nothing said how a file under `test/unit/` runs a browser only in the integration project (`vitest.config.ts` says the unit project leaves browsers out, not how a test opts in).
- **Suggestions**: the switch now exists (`REAL_BROWSER`, set by the integration project); a line for it in the stack README beside the `*.int.test.ts` rule.

### 2026-11-14 · TODO 2.5, the PDF is the one artefact · Opus

- **Task**: nothing the salesperson sees names `AUDIT.html` or the review's JSON files; the check's parts on the local page and the sales guide, both later items, handled by `TODO.md`'s rules.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `docs/journal/J-000-099.md`, `docs/when/handoff.md`, `src/cli/main.ts`, `src/project/review.ts`, `src/pdf/pdf.ts`, `src/pdf/brand.ts`, `src/project/crawl.ts`, `test/unit/main.test.ts`, `test/crawl/ghostreach.spec.ts`, `docs/paths/process.md`, `docs/DONE.md`, `scripts/checks/todo.py`, `docs/CUT.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: `TODO.md` says an open question a later item depends on is copied into its text, but not what to do with a check whose parts name files later items create; the precedent (0.5, 1.1) had to be found in `docs/DONE.md`.
- **Suggestions**: one sentence in `TODO.md`'s header: a check naming a later item's file is met vacuously and its condition copied into that item's text and check.
