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

### 2026-11-14 · TODO 3.2, ghostreach serve · Opus

- **Task**: `ghostreach serve`, the local page on 127.0.0.1 listing the reviews, each linking its PDF; nothing of 3.3 to 3.6.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `docs/modules.json`, `src/cli/main.ts`, `test/unit/no-flags.test.ts`, `theGhost.md`, `docs/journal/J-000-099.md`, `src/project/review.ts`, `vitest.config.ts`, `knip.json`, `test/unit/main.test.ts`, `docs/CONTRACT.md`, `docs/when/handoff.md`, `docs/NAVIGATION-LOG.md`, `test/crawl/ghostreach.spec.ts`, `docs/CUT.md`, `docs/DONE.md`.
- **Complaints**: three texts (GR-003's title, REV-05, the cli module's purpose) say "a site and nothing else" while the roadmap plans two command words; no row says whether a word is an option. The roadmap lists a `serve` module and `docs/modules.json` gives no way to add one without stopping, so the item's own plan and the module rule disagree until Ghost answers. No row routes "a new file of Ghostreach's own" to `docs/CUT.md`'s list; `test/unit/cut.test.ts` would have found it.
- **Suggestions**: GR-003's text names command words explicitly; the cut's own-files list named in the process row.

### 2026-11-14 · TODO 3.3, the queue · Opus

- **Task**: the queue on the local page: paste sites, `queue.json` with a state each, one review at a time, a failed site retried only by the salesperson.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `docs/when/handoff.md`, `src/project/serve.ts`, `src/project/review.ts`, `src/cli/main.ts`, `test/unit/serve.test.ts`, `src/leaf/pages/url.ts`, `docs/modules.json`, `docs/journal/J-000-099.md`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`, `docs/CUT.md`, `knip.json`, `stacks/typescript/gate.sh`.
- **Complaints**: `scripts/gate.sh --fast` refused at "the typescript stack's fast checks" without the stack's output in the log: running `stacks/typescript/gate.sh --fast` by hand was needed to see which check (cut.test.ts, then knip). 3.2's debrief already asked for the own-files list of `docs/CUT.md` to be named in a routing row; met again.
- **Suggestions**: `scripts/gate.sh` prints the failing stack check's last lines, or names where its output went.


### 2026-11-14 · TODO 3.4, concurrency · Opus

- **Task**: up to N reviews at once from the settings file (default 3, ceiling 5), one Chromium as N contexts, never two of one host together, `ghostreach doctor`; the unit and concurrent checks.
- **Opened**: `docs/HANDOFF.md`, `docs/ROADMAP.md`, `TODO.md`, `theGhost.md`, `src/project/queue.ts`, `src/project/review.ts`, `src/project/crawl.ts`, `src/cli/main.ts`, `src/project/serve.ts`, `src/crawl/crawler.ts`, `src/pdf/pdf.ts`, `src/crawl/loop.ts`, `src/crawl/relaxed-chain.ts`, `src/crawl/options.ts`, `test/unit/queue.test.ts`, `test/unit/serve.test.ts`, `test/unit/main.test.ts`, `test/crawl/ghostreach.spec.ts`, `test/fixture-site/server.ts`, `playwright.config.ts`, `vitest.config.ts`, `docs/CUT.md`, `docs/DONE.md`, `docs/journal/J-000-099.md`, `docs/when/handoff.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: `options.browser`'s comment says "tests do" and nothing of the relaxed robots.txt read it turns off two files away; RF-09 reads as if sharing a browser changed nothing.
- **Suggestions**: RF-09's row and `options.browser`'s comment name `relaxedRefusal`.

### 2026-11-14 · TODO 3.1 recorded and 3.5, SITE-22 withheld under load · Opus

- **Task**: record the ruling grade's answer to 3.1 as a new decision and build 3.5: SITE-22 withheld from a review whose crawl ran beside another, a sentence before the findings, the check row not timed.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `theGhost.md`, `docs/journal/J-000-099.md`, `docs/when/handoff.md`, `docs/paths/process.md`, `src/findings/load-findings.ts`, `src/project/queue.ts`, `src/project/review.ts`, `src/project/crawl.ts`, `src/pdf/pdf.ts`, `src/pdf/brand.ts`, `src/leaf/words.ts`, `test/crawl/concurrent.spec.ts`, `src/audit/audit.ts`, `src/audit/audit-checked.ts`, `src/findings/findings.ts`, `src/findings/page-findings.ts`, `docs/CONTRACT.md`, `src/findings/check-catalogue.ts`, `src/crawl/load-watch.ts`, `test/fixture-site/server.ts`, `docs/CUT.md`, `test/unit/load-findings.test.ts`, `test/unit/audit-golden.test.ts`, `test/unit/queue.test.ts`, `test/unit/words.test.ts`, `test/crawl/ghostreach.spec.ts`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: none of note: the catalogue's `file` column says `src/group/load-findings.ts`, the parent's path, where the code is `src/findings/load-findings.ts`; a reader following it finds nothing.
- **Suggestions**: the catalogue's `file` paths rewritten to the copy's at the next resync, or a line in CUT.md saying they are the parent's.

### 2026-11-14 · TODO 4.3, docs/SOURCES.md · Opus

- **Task**: write `docs/SOURCES.md` before any code, one row per lead-finder source from the providers' own pages, and its two tests, `sources.test.ts` (red by design until 4.6) and `hosts.test.ts`.
- **Opened**: `docs/HANDOFF.md`, `docs/ROADMAP.md` (§2, §3, §4, §5, §6 Phase 4), `TODO.md`, `test/unit/cut.test.ts` (at dfed425, the `it.fails` precedent), `docs/modules.json`, `src/crawl/router.ts`, `src/crawl/after-crawl.ts`, `src/project/serve.ts`, `src/project/crawl.ts`, `test/unit/no-flags.test.ts`, `vitest.config.ts`, `docs/CONTRACT.md`, `theGhost.md` (GR-005), `docs/when/handoff.md`, `docs/JOURNAL.md`, `docs/journal/J-000-099.md`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: REV-09 said "every fetch" while GR-005 said "every fetch of the lead finder"; the crawl's own reach (external links, the browser download) is written nowhere a Phase 4 agent would look. Several providers' pages answer 403 to a cloud session, so "unverified" there is the environment's, not the provider's.
- **Suggestions**: none beyond what SOURCES.md now states.
