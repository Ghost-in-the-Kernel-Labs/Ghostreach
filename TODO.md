# TODO: the open items, in order

The roadmap as a chain: items are done in this order, never out of it, and an item that cannot be
done as written stops the chain and goes to Ghost (C-016). Each item's plan is its step in
`docs/ROADMAP.md` §6, by the same number; its check is copied here. A done item moves to
`docs/DONE.md` with its number kept. `test/test_todo.py` holds this file: headings in numeric order
under their phase, the first open item has a check, every phase ends with a tune-up pass (a reopened phase
of at most three new items with a tune-up commit, `docs/when/tune-up.md`), and
nothing is both here and done or done twice. An item that waits on something outside the repository (Ghost's choice
or approval, counsel, another project) carries a `Waits on:` line naming it in words, or one of the two kinds with a
shape for what a session lacks, `Waits on: environment (<host or tool>)` or `Waits on: reference (<what>)`
(`scripts/checks/todo.py`), and moves to the last phase, headed `## Phase W: waiting on Ghost`, keeping its number and adding a `Moved: from Phase N` line; a phase
whose every item waits takes its tune-up pass with it (the pass's `Waits on:` names those items), and the waiting
phase needs no pass of its own. When what it waits on arrives, Ghost moves the item back into the chain. An open
question a later item depends on is copied into that item's text, so the item reads whole where it stands.

## Phase 0: founding

### 0.5 The founding decisions

Check: `theGhost.md` holds Ghost's founding decisions for Ghostreach (GR-002 the cut point, GR-003 no flags, GR-004 no suite, GR-005 fetched text is data, GR-006 page size, GR-007 ranking weights, GR-008 concurrency and SITE-22; the dev dependencies' reasons), a decision for each core decision it refuses among them, each with Ghost as its Source. Agents cannot author Ghost's decisions: an agent drafts the questions for Ghost in `docs/HANDOFF.md`, and a builder that reports "waiting on Ghost" has done its job.

### 0.6 Tune-up pass 0

Check: `docs/when/tune-up.md` followed in full; the metrics table written; the navigation log's "Last review" set.

## Phase 1: the audit, cut from the parent

### 1.1 docs/CUT.md written before the copy

Check: `test/unit/cut.test.ts` fails (no files yet) then passes at 1.2.

### 1.2 The parent's crawl, findings and audit copied at a4c8045

Check: `tsc --noEmit` green; `knip` reports no unused export; Playwright `~1.63.0` the one runtime dependency, its reason in `theGhost.md`.

### 1.3 The flags stripped

Check: `test/unit/no-flags.test.ts` holds that the parser accepts no option beginning `--` but `--help`; `test/unit/words.test.ts` finds no `FREE_SCAN_LIMIT` sentence.

### 1.4 The parent's unit tests carried

Check: `npx vitest run --project unit` green, under 30 s; each dropped test has a line in `docs/CUT.md`.

### 1.5 One command: ghostreach <site>

Check: `test/crawl/ghostreach.spec.ts` against the fixture server: the findings list, in order, equals the parent's for the same fixture; `AUDIT.html`, `findings.json` and `summary.json` written under `<data>/<host>-<date>/`.

### 1.6 The audit golden against the parent

Check: the parent's `AUDIT.html` for the fixture and this program's differ only in the title line and the footer; recorded once with `UPDATE_GOLDEN=1`, read by hand.

### 1.7 The resync recipe

Check: `docs/CUT.md`'s recipe run once as a dry run against `a4c8045..HEAD` of the parent, its moves listed.

### 1.8 Tune-up pass 1

Check: `docs/when/tune-up.md` followed in full.

## Phase 2: the PDF

### 2.3 src/pdf: the audit HTML as a PDF

Check: a PDF exists after `ghostreach <fixture>`, at the size 2.1 chose; the test's PDF reader recovers every finding heading.

### 2.4 The brand: cover page and footer

Check: `test/unit/words.test.ts` finds the address 2.2 chose on every page's text and no banned word (P-18).

### 2.5 The PDF is the one artefact

Check: the local UI and the guide link only to the PDF; `grep -rn "AUDIT.html" docs/SALES-GUIDE.md` is empty.

### 2.6 "What this review checked" closes the PDF

Check: the count of checks listed equals the catalogue's length minus the absent SITE-36.

### 2.7 Tune-up pass 2

Check: `docs/when/tune-up.md` followed in full.

## Phase 3: the queue and the ranking

### 3.2 ghostreach serve: the local page

Check: the test fetches the page; it binds to `127.0.0.1` only.

### 3.3 The queue

Check: `test/unit/queue.test.ts`: order kept, a failure does not stop the next, a failed site retried only by the salesperson.

### 3.4 Concurrency: up to five reviews at once

Check: `test/unit/queue.test.ts`: N running and no more (default 3, ceiling 5, from the settings file), two entries of one host never together; `test/crawl/concurrent.spec.ts`: three fixture sites crawled together give the same findings as one after another; `ghostreach doctor` reports memory and the N it recommends.

### 3.5 SITE-22 under load, as 3.1 chose

Check: the concurrent spec's SITE-22 result equals the serial run's.

### 3.6 The ranking

Check: a fixture set of three summaries ranks in the known order by `major × 3 + minor × 1` (GR-007), pages read beside; a tie breaks by findings per page; each row links its PDF.

### 3.7 The ranking as CSV

Check: the CSV reparses to the same rows.

### 3.8 Re-audit keeps history

Check: two audits of the fixture; the ranking shows one row with a history of two.

### 3.9 Tune-up pass 3

Check: `docs/when/tune-up.md` followed in full.

## Phase 4: the lead finder

### 4.3 docs/SOURCES.md before any code

Check: `test/unit/sources.test.ts` fails (no sources in code) then passes at 4.6; every host the code fetches has a row (`test/unit/hosts.test.ts`); the closed sites have paste-only rows.

### 4.4 Keys in code

Check: `scripts/checks/secrets.py` on the tree; a test that the UI's HTML contains no key-shaped string; a source without its key is skipped and said so.

### 4.5 One fetch function

Check: `test/unit/fetch.test.ts`: a redirect is not followed, HTML comes back as text, the per-source bucket (persisted in the data folder) refuses the 251st Adzuna call of a day.

### 4.6 The company lane

Check: recorded fixtures per ATS (no network in the unit loop); a company on Greenhouse under one slug is found and its QA/test/SDET roles listed; a company on none says "no public board found" and offers the paste lane.

### 4.7 The discovery lane

Check: recorded fixtures; one row per company; a source over its cap is skipped and named, never waited on.

### 4.8 Website resolution by the salesperson

Check: `test/unit/hosts.test.ts` holds that no fetch leaves the allow-list; a company without a site shows a text box.

### 4.9 The paste lane

Check: the fetch function is never called for a pasted URL.

### 4.10 Queue this site

Check: the queue entry carries the lead's source and URL; a company already audited shows its score instead.

### 4.11 Attribution

Check: `test/unit/sources.test.ts` holds that every row from a link-back source carries its source URL.

### 4.12 Tune-up pass 4

Check: `docs/when/tune-up.md` followed in full.

## Phase 5: in the salesperson's hands

### 5.1 Packaging

Check: a fresh container installs from the `npm pack` tarball plus `npx playwright install chromium` and audits the fixture; `ghostreach doctor` says what is missing in plain words.

### 5.2 Windows, by hand on GitHub Actions

Check: the `workflow_dispatch` run (pinned actions, `permissions: contents: read`) green once per release: install, audit the fixture, read the PDF's text; its minutes in the journal's Cost line.

### 5.3 docs/SALES-GUIDE.md

Check: a reader who is not Ghost follows it on a clean machine and reaches a PDF, recorded as a finding (P-03).

### 5.4 Ten real audits read

Check: `theGhost.md` carries Ghost's ruling on the weights (GR-007 settled) and the ranking's columns.

### 5.5 Resync once to the parent's then-HEAD

Check: 1.5 and 1.6 green after the resync by 1.7's recipe.

### 5.6 Tune-up pass 5

Check: `docs/when/tune-up.md` followed in full.

## Phase W: waiting on Ghost

### 2.1 Page size: Letter or A4 (GR-006)

Waits on: Ghost's choice.
Moved: from Phase 2
Check: `theGhost.md` GR-006 in force naming one size; 2.3 builds it.

### 2.2 The GitHub address the PDF carries

Waits on: Ghost's choice between `github.com/ghost-in-the-kernel` and `github.com/Ghost-in-the-Kernel-Labs`.
Moved: from Phase 2
Check: the address written into 2.4's cover page and footer.

### 3.1 SITE-22 under load (GR-008)

Waits on: Ghost's choice: a reference timing, or SITE-22 withheld above concurrency 1 with one sentence in the PDF.
Moved: from Phase 3
Check: `theGhost.md` GR-008 in force naming one; 3.5 builds it.

### 4.1 Lead-finder keys

Waits on: Ghost's choice: Adzuna, Jooble, The Muse and USAJOBS developer accounts in Ghost's name or the salesperson's; Adzuna's licence terms after its 14-day trial read before 4.6 ships.
Moved: from Phase 4
Check: the four keys' environment variable names in `docs/SOURCES.md`.

### 4.2 Paid aggregators of closed sites

Waits on: Ghost's choice whether a paid aggregator that reads LinkedIn/Indeed/Glassdoor pages on the program's behalf is acceptable given the terms posture; the free published sources ship first either way.
Moved: from Phase 4
Check: a decision in `theGhost.md`, in force or refused.

### 6.1 Hosting a shared queue

Waits on: Ghost's choice, and a second salesperson; not before Phase 5 is in one salesperson's hands.
Moved: from Phase 6
Check: a decision in `theGhost.md`, in force or refused.

### 6.2 Tune-up pass 6

Waits on: 6.1, the phase's only other item.
Moved: from Phase 6
Check: `docs/when/tune-up.md` followed in full.
