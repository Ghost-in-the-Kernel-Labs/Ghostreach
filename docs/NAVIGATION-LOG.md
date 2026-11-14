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
