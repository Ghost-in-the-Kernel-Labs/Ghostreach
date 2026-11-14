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

