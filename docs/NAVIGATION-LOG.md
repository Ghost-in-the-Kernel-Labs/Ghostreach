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

Last review: c0d55bd (2026-11-14, tune-up pass 2)

## Entries

An entry is `### <date> · <task> · <model>` and these lines:

- **Task**: what the agent was asked.
- **Opened**: the files it opened, in order.
- **Complaints**: what slowed or misled it.
- **Suggestions**: what it would change.

### 2026-11-14 · TODO 2.7, tune-up pass 2 · Opus

- **Task**: tune-up pass 2 by `docs/when/tune-up.md`: the two full gates, the debriefs since 836f363, the core update, the wipe; 2.7 to Phase W if the core-update step alone could not run.
- **Opened**: `docs/when/tune-up.md`, `docs/HANDOFF.md`, `TODO.md`, `scripts/gate.sh`, `docs/when/long-run.md`, `docs/NAVIGATION-LOG.md`, `docs/journal/J-000-099.md`, `docs/when/core-update.md`, `docs/LINEAGE.md`, `README.md`, `stacks/typescript/README.md`, `vitest.config.ts`, `docs/when/grades.md`, `docs/when/handoff.md`, `docs/AGENT.md`.
- **Complaints**: `docs/HANDOFF.md`'s "Where the project stands" was one paragraph of about 2,000 words (split now, one line per item). Two documents (the brief's precedent and `docs/when/core-update.md`) said Ghost-Core is unreachable; asking for it attached it at once, so the precedent, not the environment, had kept two passes waiting. `.stryker-tmp/` doubles every `grep -r`.
- **Suggestions**: `docs/when/core-update.md` step 2 says to ask for Core to be attached before calling it unreachable; `.stryker-tmp/` removed by whoever owns that clone.
