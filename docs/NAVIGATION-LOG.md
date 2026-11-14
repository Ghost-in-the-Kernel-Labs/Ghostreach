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


### 2026-11-14 · Fix: the four faults of J-044's security read · Opus

- **Task**: fix the four faults tune-up pass 4's security read left in the local server (unescaped queue values, an unreadable data file stopping the server, the PDF stream's missing error handler, no limit on lookups and runs in flight), each with a test red first.
- **Opened**: `docs/paths/code.md`, `docs/HANDOFF.md`, `docs/journal/J-000-099.md`, `src/project/serve.ts`, `src/project/html.ts`, `src/project/page.ts`, `src/project/page-leads.ts`, `src/project/text-file.ts`, `src/project/queue.ts`, `src/project/settings.ts`, `src/project/fetch.ts`, `src/project/company.ts`, `src/project/discover.ts`, `src/project/leads.ts`, `docs/CUT.md`, `docs/modules.json`, `test/unit/serve.test.ts`, `test/unit/company.test.ts`, `docs/when/handoff.md`, `docs/JOURNAL.md`, `docs/FINDINGS.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: the local page's row in `docs/paths/code.md` opens three files, but the fault list reached seven (the four readers live in the lead finder's files); the largest-file metric (< 400 lines) counts test files too, said only by the fast loop's failure, so a test added to `serve.test.ts` had to move to a file of its own.
- **Suggestions**: the local page's row names the data files' readers (`src/project/kept.ts` now holds the rule); `docs/AGENT.md`'s largest-file row says it counts tests.

### 2026-11-14 · Ghost's direction recorded (J-046), TODO 5.5 to Phase W · Opus

- **Task**: record Ghost's newest direction verbatim (the audit at a4c8045 is the product; deployment first), handle TODO 5.5 by `TODO.md`'s rules, update HANDOFF.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `docs/when/handoff.md`, `docs/paths/process.md`, `docs/JOURNAL.md`, `docs/journal/J-000-099.md`, `theGhost.md`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: `TODO.md`'s header has no shape for an item Ghost withdraws; the waiting shape fits only by reading "not planned" as a choice Ghost may still make.
- **Suggestions**: none.

### 2026-11-14 · TODO 5.1, packaging · Opus

- **Task**: TODO 5.1: a `bin`, the smallest build that makes `npm pack` installable, `files` limited, `doctor`'s Node.js and Chromium lines, a version and how a release is tagged, a repeating check that installs the tarball and reviews the fixture.
- **Opened**: `package.json`, `tsconfig.json`, `docs/paths/code.md`, `src/cli/main.ts`, `src/project/crawl.ts`, `src/project/settings.ts`, `test/unit/main.test.ts`, `playwright.config.ts`, `vitest.config.ts`, `test/crawl/ghostreach.spec.ts`, `src/project/review.ts`, `test/fixture-site/server.ts`, `stacks/typescript/gate.sh`, `knip.json`, `docs/modules.json`, `docs/CUT.md`, `test/support/pdf-text.ts`, `scripts/checks/secrets.py`, `stacks/typescript/README.md`, `test/test_stacks.py`, `README.md`, `docs/DONE.md`.
- **Complaints**: no routing row named packaging or a release (acted on: a row in `docs/paths/code.md`); the stack README's "npm 11 with `engine-strict=true`" is the repository's `.npmrc`, which a tarball does not carry, so it took a read to see a salesperson's npm 10 only warns.
- **Suggestions**: none.

### 2026-11-14 · TODO 5.2, Windows on GitHub Actions · Opus

- **Task**: TODO 5.2: a dispatch-only Windows workflow, actions pinned to verified SHAs, that installs the tarball, installs Chromium, reviews the fixture and reads the PDF; then 5.2 to Phase W for Ghost's run.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `docs/when/handoff.md`, `.github/workflows/ci.yml`, `scripts/checks/supply_chain.py`, `test/crawl/package.spec.ts`, `package.json`, `playwright.config.ts`, `stacks/typescript/gate.sh`, `src/project/review.ts`, `docs/journal/J-000-099.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: the session's GitHub tools and API reach only this organization's repositories, so an action's release could be read only from its git tags (`git ls-remote`, then a shallow fetch of the tag); nothing says where a pin's evidence is recorded (here, the journal).
- **Suggestions**: `docs/SUPPLY-CHAIN.md` names how an action's SHA is verified and where it is written down.
