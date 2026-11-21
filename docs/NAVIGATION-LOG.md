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

### 2026-11-14 · TODO 5.3, docs/SALES-GUIDE.md · Opus

- **Task**: TODO 5.3: the one-page salesperson's guide, accurate to the program as run, the PDF its only file, no score; then 5.3 to Phase W for its reader.
- **Opened**: `README.md`, `src/cli/main.ts`, `src/project/page.ts`, `src/project/page-leads.ts`, `src/project/serve.ts`, `src/project/review.ts`, `src/project/queue.ts`, `src/leaf/words.ts`, `src/project/company.ts`, `src/project/keys.ts`, `src/project/ready.ts`, `test/fixture-site/server.ts`, `TODO.md`, `docs/HANDOFF.md`, `docs/journal/J-000-099.md`.
- **Complaints**: no routing row names the salesperson's documents (the README's install, this guide); walking the page by hand needed the fixture site started from its TypeScript source, which nothing documents outside the specs.
- **Suggestions**: a row in `docs/paths/code.md` for "the salesperson's documents: README's Install, docs/SALES-GUIDE.md", read against `--help`, `doctor` and the page at each tune-up (ROADMAP §4 says so already).

### 2026-11-14 · The distributable without lineage (J-052, J-053) · Opus

- **Task**: Ghost's direction recorded; a tarball that names no source: `removeComments`, the in-page bundles, a salesperson's README, `package.json` read, a lineage check in the medium gate with a short allow-list, a planted leak; the marker counts before and after.
- **Opened**: `docs/HANDOFF.md`, `docs/journal/J-000-099.md`, `docs/when/handoff.md`, `package.json`, `tsconfig.build.json`, `test/crawl/package.spec.ts`, `README.md`, `src/leaf/report.ts`, `src/crawl/controls-script.ts`, `src/crawl/report-read.ts`, `test/unit/crawl-format.test.ts`, `docs/CUT.md`, `test/support/pin.ts`, `knip.json`, `stacks/typescript/README.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: the bundles' header said "run npm run controls-script", a script Ghostreach does not have; only CUT.md's resync step says they are copied whole. Nothing said the root `README.md` is what `npm pack` ships, so a developer's paragraph there reached the salesperson.
- **Suggestions**: none.

### 2026-11-14 · The crawler is forecursor (J-055, J-056, GR-017) · Opus

- **Task**: Ghost's word recorded as a journal entry and GR-017; the crawler's user agent, robots.txt token, not-found probe, in-page globals and crawl file's `tool` renamed to forecursor; the parent's golden crawls still read; the lineage check tightened.
- **Opened**: `docs/HANDOFF.md`, `src/leaf/report.ts`, `test/support/lineage.ts`, `src/crawl/robots.ts`, `src/crawl/reading-script.ts`, `test/unit/lineage.test.ts`, `test/crawl/package.spec.ts`, `docs/journal/J-000-099.md`, `theGhost.md`, `src/audit/audit.ts`, `test/golden/fixture-site.crawl.json`, `test/crawl/ghostreach.spec.ts`, `test/fixture-site/server.ts`, `src/crawl/report-read.ts`, `src/leaf/pages/url.ts`, `src/crawl/state-report.ts`, `test/unit/robots.test.ts`, `docs/CUT.md`, `test/unit/crawl-format.test.ts`, `docs/when/handoff.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: the bundles' first line still says "Generated by scripts/controls-script.mjs", a script Ghostreach does not have (J-053's complaint, still open); nothing but CUT.md's resync step says the bundles are hand-edited copies.
- **Suggestions**: none.

### 2026-11-17 · The server's setup script and unit (J-058, GR-015) · Opus

- **Task**: Ghost's word recorded; `deploy/setup.sh`, `deploy/ghostreach.service` and `deploy/README.md` for an Ubuntu 24.04 server behind a Cloudflare Tunnel and Access, the API's command left a marked placeholder; `test/test_deploy.py`.
- **Opened**: `docs/HANDOFF.md`, `docs/paths/code.md`, `theGhost.md` (GR-015), `docs/journal/J-000-099.md`, `scripts/checks/supply_chain.py`, `docs/SUPPLY-CHAIN.md`, `scripts/checks/secrets.py`, `src/project/ready.ts`, `src/project/review.ts`, `src/cli/main.ts`, `package.json`, `package-lock.json`, `test/support.py`, `test/test_save.py`, `docs/when/handoff.md`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: nothing routed a file outside `src/`, `test/` and `scripts/` (a new top-level folder); the data folder's place (`$HOME/Ghostreach`) is said only in `src/project/review.ts`.
- **Suggestions**: none.

### 2026-11-18 · The command line, friendlier (J-059, J-060, GR-018) · Opus

- **Task**: Ghost's word recorded as J-059 and GR-018 (superseding GR-003 in part); bare `ghostreach` opens the page, one per data folder; `--help` lists every command; launchers `ghostreach` and `ghostreach.cmd` for a copy of the source; tests, README, SALES-GUIDE.
- **Opened**: the brief, `docs/HANDOFF.md`, `src/cli/main.ts`, `src/cli/bin.ts`, `src/project/serve.ts`, `test/unit/main.test.ts`, `test/unit/no-flags.test.ts`, `test/unit/serve.test.ts`, `test/unit/lineage.test.ts`, `test/support/lineage.ts`, `test/crawl/package.spec.ts`, `theGhost.md`, `scripts/checks/ghost.py`, `docs/CONTRACT.md`, `docs/modules.json`, `docs/paths/code.md`, `src/project/page.ts`, `src/project/kept.ts`, `README.md`, `docs/SALES-GUIDE.md`, `.gitattributes`, `.npmrc`, `scripts/fast.sh`, `test/test_deploy.py`, `docs/journal/J-000-099.md`, `docs/when/handoff.md`.
- **Complaints**: HANDOFF's first section reads as one 30 KB block in a terminal (the For Ghost list is in the same grep window); the rule for which of REV-05's and modules.json's words an agent may change is said nowhere but the brief.
- **Suggestions**: none.

### 2026-11-20 · The landing of the session branch, GR-011 approved · Opus

- **Task**: record Ghost's approval of GR-011 and the landing (J-064), and land the session branch's net change on `main` as the reviewer's `tune-up:` commit for passes 2 and 4 (J-065).
- **Opened**: `theGhost.md` (C-040, GR-011), `scripts/commit.sh`, `scripts/ship.sh`, `docs/when/tune-up.md`, `TODO.md`, `docs/DONE.md`, `docs/HANDOFF.md`, `scripts/gate.sh`, `docs/JOURNAL.md`, `docs/journal/J-000-099.md`, `docs/decisions.md`, `docs/REVIEWED-VERSIONS.md`, `scripts/checks/dependency_review.py`, `docs/when/handoff.md`, `docs/NAVIGATION-LOG.md`, `docs/CUT.md`.
- **Complaints**: `docs/when/tune-up.md` says the reviewer lands a pass with a `tune-up:` commit, but not what to do when the passes ran on a session branch and `main`'s count is 0 (no tune-up "due" by `scripts/commit.sh`); the review record's Journal cell takes one id, said only in the check, so a later approval has to go in the Decision cell.
- **Suggestions**: a line in tune-up.md's edge cases: a pass saved on a session branch lands as the `tune-up:` commit of that branch's landing, whatever the count.

### 2026-11-20 · Launch fixes, item A (the page) · Opus

- **Task**: item A (points 1 to 6) of the launch walk's fixes: the primary action, a done row's PDF and counts, progress, plain errors, the lead finder folded, the favicon.
- **Opened**: `docs/HANDOFF.md`, `src/project/page.ts`, `src/project/html.ts`, `src/project/page-leads.ts`, `src/project/serve.ts`, `src/project/queue.ts`, `src/project/review.ts`, `src/project/crawl.ts`, `test/unit/serve.test.ts`, `docs/paths/code.md`, `docs/CUT.md`, `test/unit/keys.test.ts`, `test/unit/discover.test.ts`, `test/crawl/package.spec.ts`, `test/support/lineage.ts`, `docs/SALES-GUIDE.md`, `docs/journal/J-000-099.md`.
- **Complaints**: HANDOFF's first section is one long list (about 30 KB) with no "the latest" marker, so finding where the last session stopped means reading to its end. A new file under `src/` needs its line in CUT.md and, if it uses the network, a moved exemption in both `test/unit/hosts.test.ts` and SOURCES.md: the code row names neither.
- **Suggestions**: the local page's row in `docs/paths/code.md` names `test/unit/hosts.test.ts` and SOURCES.md's exemption list for a file split.

### 2026-11-20 · Launch fixes, item B (the launch and the shortcut) · Opus

- **Task**: item B (points 7 to 10) of the launch walk's fixes: the honest opener and Ctrl+C, a stable port, the doctor's own number, `ghostreach shortcut` opt-in with the tip once (GR-022, J-067).
- **Opened**: the brief, `docs/HANDOFF.md`, `docs/journal/J-000-099.md` (J-066), `src/project/show.ts`, `src/cli/main.ts`, `src/project/settings.ts`, `src/project/serve.ts`, `test/unit/main.test.ts`, `test/unit/serve.test.ts`, `test/unit/queue.test.ts`, `test/unit/hosts.test.ts`, `test/test_launchers.py`, `test/crawl/package.spec.ts`, `test/support/lineage.ts`, `docs/modules.json`, `docs/paths/code.md`, `docs/CUT.md`, `docs/SOURCES.md`, `theGhost.md` (GR-008, GR-018, GR-020, GR-021), `knip.json`, `README.md`, `docs/SALES-GUIDE.md`.
- **Complaints**: the stack gate's refusal prints only "refused at the typescript stack's fast checks" to the terminal; the reason (knip's unlisted binary) is in `build/gate-fast.log`, which the refusal line does not name. A partial supersession's "See also on the old entry" is said only by C-036's precedent, not in theGhost.md's header.
- **Suggestions**: the gate's refusal line names the log file it wrote.

### 2026-11-20 · Launch fixes, item C (the three bugs) · Opus

- **Task**: item C (points 11 to 13) of the launch walk's fixes: host:port as the site, a guessed company board shown as a maybe, a failed review set aside under `failed/` (J-068).
- **Opened**: the brief, `docs/HANDOFF.md`, `docs/journal/J-000-099.md` (J-066, J-067), `src/project/queue.ts`, `src/project/review.ts`, `src/project/serve.ts`, `src/project/page.ts`, `src/project/page-leads.ts`, `src/project/company.ts`, `src/project/crawl.ts`, `src/project/leads.ts`, `src/leaf/pages/url.ts`, `src/audit/audit.ts`, `test/unit/queue.test.ts`, `test/unit/main.test.ts`, `test/unit/company.test.ts`, `test/support/boards/greenhouse.ts`, `test/crawl/ghostreach.spec.ts`, `test/crawl/concurrent.spec.ts`, `test/crawl/package.spec.ts`, `docs/CONTRACT.md`, `docs/SALES-GUIDE.md`, `docs/when/handoff.md`
- **Complaints**: the review folder's name is built in `review.ts` and parsed back in `serve.ts` (`FOLDER`), with three specs each spelling it again; nothing routes a change of it to all five.
- **Suggestions**: none.


### 2026-11-21 · A pulled copy ran its old build (J-070) · Opus

- **Task**: make the root launchers rebuild a copy whose source changed since its build (Ghost's Windows bug after `git pull`), with tests and a version line.
- **Opened**: the brief, `ghostreach`, `ghostreach.cmd`, `docs/HANDOFF.md`, `docs/journal/J-000-099.md` (J-060 to J-069), `test/test_launchers.py`, `.npmrc`, `package.json`, `src/cli/main.ts`, `knip.json`, `docs/paths/code.md`, `docs/modules.json`, `src/cli/bin.ts`, `test/unit/main.test.ts`, `test/crawl/package.spec.ts`, `docs/SUPPLY-CHAIN.md`, `theGhost.md` (GR-018), `README.md`, `scripts/gate.sh`, `docs/NAVIGATION-LOG.md`.
- **Complaints**: the package spec's refusal of any `.json` under the packed `dist/` is the only place that says where a build-time file may not go; I found it only by reading the spec before choosing the stamp's place.
- **Suggestions**: the package row in `docs/paths/code.md` says that nothing but built `.js` may sit in `dist/`.
