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

### 2026-11-14 · TODO 4.4, keys in code · Opus

- **Task**: one environment variable per keyed source, never printed; the local page shows key present or absent; a source without its key skipped and said so.
- **Opened**: `docs/HANDOFF.md`, `docs/ROADMAP.md`, `TODO.md`, `docs/SOURCES.md`, `docs/journal/J-000-099.md`, `docs/modules.json`, `docs/when/handoff.md`, `test/unit/hosts.test.ts`, `test/unit/sources.test.ts`, `src/project/serve.ts`, `test/support/made-up-keys.ts`, `scripts/checks/secrets.py`, `test/support/secret-shapes-before-gate.ts`, `knip.json`, `docs/CUT.md`, `docs/DONE.md`, `docs/JOURNAL.md`.
- **Complaints**: where Phase 4's code lives is settled nowhere but in a precedent (3.2, 3.3) and the brief; `test/unit/sources.test.ts` already names `src/leads/sources.ts`, a folder the module rules do not admit. The live secret shapes are cut from `src/`, and their frozen copy sits under `test/support/` with a name (`before-gate`) that does not say it is the one a test should reach for.
- **Suggestions**: a routing row for "the lead finder's code: where it lives until the `leads` module is ruled"; a one-line note in `test/support/made-up-keys.ts` pointing at `findSecrets`.

### 2026-11-14 · TODO 4.5, one fetch function · Opus

- **Task**: the lead finder's one fetch function: text or JSON, markup stripped, no redirect, per-source buckets persisted in the data folder, the allow-list, a timeout, a body cap, no URL logged.
- **Opened**: `docs/ROADMAP.md`, `TODO.md`, `docs/SOURCES.md`, `test/unit/hosts.test.ts`, `test/support/sources.ts`, `src/project/queue.ts`, `src/project/text-file.ts`, `tsconfig.json`, `docs/CUT.md`, `docs/DONE.md`, `docs/HANDOFF.md`.
- **Complaints**: the item's check named a source 4.3 had excluded, so the check could not be met as written until restated; the allow-list exists twice (the document and the code), joined only by a test.
- **Suggestions**: when an item excludes a source, restate every later check that names it in the same commit, not as a note in the item's text.

### 2026-11-14 · TODO 4.6, the company lane · Opus

- **Task**: the company lane: a company typed on the local page, its board names derived, each `in` ATS probed through the fetch function, bounded, its QA roles listed; "no public board found" offering the paste lane; `sources.test.ts`'s `it.fails` flipped onto `FETCHED_SOURCES`.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `docs/SOURCES.md`, `src/project/fetch.ts`, `src/project/keys.ts`, `src/project/serve.ts`, `src/project/queue.ts`, `src/project/text-file.ts`, `src/project/review.ts`, `test/unit/sources.test.ts`, `test/unit/hosts.test.ts`, `test/unit/serve.test.ts`, `test/unit/keys.test.ts`, `test/unit/fetch.test.ts`, `test/support/sources.ts`, `docs/when/handoff.md`, `docs/journal/J-000-099.md`, `docs/CUT.md`, `docs/modules.json`, `knip.json`, `tsconfig.json`, `vitest.config.ts`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: the roadmap and the item's text still name `src/leads/company.ts` while every earlier item put the lead finder in `src/project/`; where a fixture of a test lives is not said (`test/fixtures/` is the Python checks' planted breaks, outside the TypeScript project).
- **Suggestions**: one line in `stacks/typescript/README.md` naming `test/support/` as the TypeScript fixtures' place; the `leads` module ruled before 4.7 adds a fourth file.

### 2026-11-14 · TODO 4.7, the discovery lane · Opus

- **Task**: one saved search run as a batch across the discovery-lane `in` sources through the fetch function, keyed ones only with their key, within each cap; one row per company; a source over its cap, keyless or failing skipped and named; a section on the local page to edit, run and read it.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `docs/SOURCES.md`, `docs/journal/J-000-099.md`, `src/project/company.ts`, `src/project/fetch.ts`, `src/project/keys.ts`, `src/project/serve.ts`, `test/unit/company.test.ts`, `test/unit/hosts.test.ts`, `test/unit/sources.test.ts`, `test/support/sources.ts`, `test/support/boards/greenhouse.ts`, `test/support/boards/lever.ts`, `docs/CUT.md`, `docs/DONE.md`, `docs/when/handoff.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: the brief's "one page per source per run" and the roadmap's titles meet badly where a source searches one phrase a request (Jooble, USAJOBS): one call could carry only one title. Arbeitnow's fields sat behind a Postman page 4.3 did not read; its JSON form (documenter.gw.postman.com) answered where the page timed out.
- **Suggestions**: the `leads` module ruled: the lead finder is now four files in `src/project/` beside the review's.

### 2026-11-14 · TODO 4.8, website resolution by the salesperson · Opus

- **Task**: split `src/project/serve.ts` (398 lines) as a refactor; then a text box per company row for the salesperson's typed website, validated like a site, kept, never looked up.
- **Opened**: `docs/HANDOFF.md`, `TODO.md`, `docs/ROADMAP.md`, `docs/journal/J-000-099.md`, `docs/when/handoff.md`, `src/project/serve.ts`, `src/project/queue.ts`, `src/project/discover.ts`, `src/project/company.ts`, `src/project/review.ts`, `src/leaf/pages/url.ts`, `docs/modules.json`, `docs/CUT.md`, `test/unit/serve.test.ts`, `test/unit/discover.test.ts`, `test/unit/company.test.ts`, `test/unit/sources.test.ts`, `test/unit/hosts.test.ts`, `docs/SOURCES.md`, `docs/DONE.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: "the company row" is two things on the page (a discovery row, a company lane lookup), and the item does not say which; the metrics table's largest-file line goes stale on a refactor and fails the fast loop until rewritten.
- **Suggestions**: none beyond the `leads` module ruling already asked.

### 2026-11-14 · TODO 4.9, the paste lane · Opus

- **Task**: a closed site's posting pasted on a company row, kept as a note, never fetched; rendered escaped, a link with `rel="noopener noreferrer"`.
- **Opened**: `TODO.md`, `docs/ROADMAP.md`, `docs/SOURCES.md`, `src/project/leads.ts`, `src/project/page-leads.ts`, `src/project/serve.ts`, `test/unit/leads.test.ts`, `test/unit/hosts.test.ts`, `test/unit/company.test.ts`, `docs/DONE.md`.
- **Complaints**: none.
- **Suggestions**: none.

### 2026-11-14 · TODO 4.10, queue this site · Opus

- **Task**: "Queue this site" on a company row with a website, the lead's source and URL the queue entry's reason; a reviewed company shown as reviewed, no score (GR-007 waits).
- **Opened**: `TODO.md`, `docs/ROADMAP.md`, `src/project/queue.ts`, `src/project/leads.ts`, `src/project/page-leads.ts`, `src/project/page.ts`, `src/project/serve.ts`, `test/unit/serve.test.ts`, `test/unit/leads.test.ts`, `docs/DONE.md`.
- **Complaints**: the item's check names a score that a Phase W item (3.6, GR-007) owns; the item's text does not say so.
- **Suggestions**: an item whose check depends on an item in Phase W carries a `From` line naming it, as the chain's rule asks for open questions.

### 2026-11-14 · TODO 4.11, attribution · Opus

- **Task**: where SOURCES.md says a source asks for a link back (`yes` only), each of its rows links the source's own posting page; `sources.test.ts` holds it.
- **Opened**: `TODO.md`, `docs/SOURCES.md`, `src/project/discover.ts`, `src/project/page-leads.ts`, `test/unit/sources.test.ts`, `test/support/sources.ts`, `test/support/boards/remotive.ts`, `test/unit/discover.test.ts`, `docs/DONE.md`.
- **Complaints**: the roadmap's step names three link-back sources the document left `unverified`; the item's text corrects it, the roadmap does not.
- **Suggestions**: none.
