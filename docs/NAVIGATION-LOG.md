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

Last review: 6f17b67 (2026-11-14, tune-up pass 4)

## Entries

An entry is `### <date> · <task> · <model>` and these lines:

- **Task**: what the agent was asked.
- **Opened**: the files it opened, in order.
- **Complaints**: what slowed or misled it.
- **Suggestions**: what it would change.

### 2026-11-14 · TODO 4.12, tune-up pass 4 · Opus

- **Task**: tune-up pass 4 by `docs/when/tune-up.md`: the two full gates, the debriefs of 2.7 to 4.11, the core update, the wipe; with the coordinator's asks: a read of `src/project/` for the `leads` proposal and a security read of the local server.
- **Opened**: `docs/when/tune-up.md`, `docs/when/long-run.md`, `TODO.md`, `docs/HANDOFF.md`, `docs/when/handoff.md`, `docs/when/core-update.md`, `docs/LINEAGE.md`, `docs/NAVIGATION-LOG.md`, `docs/journal/J-000-099.md`, `docs/modules.json`, `src/project/serve.ts`, `src/project/html.ts`, `src/project/page-leads.ts`, `src/project/page.ts`, `src/project/company.ts`, `src/project/fetch.ts`, `src/project/leads.ts`, `src/project/queue.ts`, `scripts/save.sh`, `scripts/checks/metrics.py`, `docs/AGENT.md`, `docs/paths/process.md`, `scripts/checks/claude_md.py`, `scripts/checks/pointers.py`, `test/unit/serve.test.ts`, `vitest.config.ts`, `docs/CUT.md`, `docs/JOURNAL.md`.
- **Complaints**: "Mandatory context" in the metrics is `CLAUDE.md`'s word count alone, said only in `scripts/checks/metrics.py`; `docs/AGENT.md`'s AGT-03 says "plus whatever an agent must read before a task". The brief's `scripts/save.sh -F <file>` and `CLAUDE.md`'s `-m <message>` are both right (`save.sh` takes either), but `CLAUDE.md` names one. No workpath routed the product's code (acted on: `docs/paths/code.md`). A bare file name in a routing document is read as a path from the root by the pointer check.
- **Suggestions**: AGT-03's text names `CLAUDE.md` alone, as the measure does.

