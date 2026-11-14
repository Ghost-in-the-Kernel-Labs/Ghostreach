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

Last review: 0000000 (2026-11-13, stamped; set by the first tune-up)

## Entries

An entry is `### <date> · <task> · <model>` and these lines:

- **Task**: what the agent was asked.
- **Opened**: the files it opened, in order.
- **Complaints**: what slowed or misled it.
- **Suggestions**: what it would change.

### 2026-11-14 · Phase 0, items 0.1 to 0.4 after the stamp · Fable

- **Task**: stamp Ghostreach from Ghost-Core and land the founding chain through 0.4 as one gated commit each.
- **Opened**: README.md (the stamp recipe), docs/HANDOFF.md, TODO.md, docs/GHOST-IN-THE-KERNEL.md, stacks/typescript/README.md, stacks/typescript/gate.sh, package.json, stryker.config.mjs, knip.json, tsconfig.json, scripts/mutate.mjs, scripts/cooldown.mjs, scripts/checks/dependency_review.py, scripts/checks/glossary.py, scripts/checks/todo.py, test/test_reviewed_versions.py, test/test_contract.py, docs/REVIEWED-VERSIONS.md, docs/DEPENDENCY-REVIEW.md, docs/JOURNAL.md, docs/ROADMAP.md, docs/CONTRACT.md, docs/modules.json, scripts/commit.sh, scripts/ship.sh.
- **Complaints**: a clean stamp does not pass its own stack gate (F-001 to F-003) nor its own record (F-004, F-005), so 0.2 was mostly working around the template; `--baseline` reads git's file list, which is not said, so it printed nothing until the lockfile was staged; the cooldown's "version before" is by publish date in the README's words but must be by semver within the major, or a backport drags a package down a major; the TODO check's waiting-phase shape (`Moved: from Phase N`, numbered items, the pass travelling with an all-waiting phase) is in `scripts/checks/todo.py`'s docstrings and `TODO.md`'s header, not in `docs/when/` where a planner looks; `ship.sh` is not executable (F-006); the session's git credentials follow the repository's old name after a rename, which cost one failed ship.
- **Suggestions**: Core fixes F-001 to F-006 before the next stamp; `README.md`'s stamp section says "stage the lockfile, then `--baseline`"; the stack README's Cooldown row says "the highest version of the same major older than seven days"; a `docs/when/plan.md` for the roadmap and TODO shapes.
