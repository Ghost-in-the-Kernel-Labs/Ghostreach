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

## Phase 2: the PDF

### 2.7 Tune-up pass 2

Check: `docs/when/tune-up.md` followed in full.

## Phase 4: the lead finder

### 4.12 Tune-up pass 4

Check: `docs/when/tune-up.md` followed in full.

## Phase 5: in the salesperson's hands

### 5.2 Windows, by hand on GitHub Actions

Check: the `workflow_dispatch` run (pinned actions, `permissions: contents: read`) green once per release: install, audit the fixture, read the PDF's text; its minutes in the journal's Cost line.

### 5.3 docs/SALES-GUIDE.md

The guide's "read the ranking" needs 3.6, which waits on GR-007 in Phase W (J-033).
Carried from 2.5 (J-026): the guide links to and names the PDF only, never `AUDIT.html` or a review's JSON files.
Check: `grep -rn "AUDIT.html" docs/SALES-GUIDE.md` is empty; a reader who is not Ghost follows it on a clean machine and reaches a PDF, recorded as a finding (P-03).

### 5.4 Ten real audits read

Reads 3.6's ranking, which waits on GR-007 in Phase W (J-033).
Check: `theGhost.md` carries Ghost's ruling on the weights (GR-007 settled) and the ranking's columns.

### 5.6 Tune-up pass 5

Check: `docs/when/tune-up.md` followed in full.

## Phase W: waiting on Ghost

### 0.6 Tune-up pass 0

Waits on: environment (github.com/Ghost-in-the-Kernel-Labs/Ghost-Core, private: the core-update step)
Moved: from Phase 0
Check: `docs/when/tune-up.md` followed in full; the metrics table written; the navigation log's "Last review" set.

### 1.8 Tune-up pass 1

Waits on: environment (github.com/Ghost-in-the-Kernel-Labs/Ghost-Core, private: the core-update step)
Moved: from Phase 1
Check: `docs/when/tune-up.md` followed in full.

### 3.6 The ranking

Waits on: Ghost's ruling on GR-007 (the ranking's weights, `proposed`; nothing is built on a proposed entry, C-008)
Moved: from Phase 3
From 4.10 (J-041): a lead finder row whose site is already reviewed shows "reviewed <date>, PDF" in place of the score 4.10's check names (`queueThis`, `src/project/page-leads.ts`); once the ranking is built, the row shows the review's score there too.
Check: a fixture set of three summaries ranks in the known order by `major × 3 + minor × 1` (GR-007), pages read beside; a tie breaks by findings per page; each row links its PDF.

### 3.7 The ranking as CSV

Waits on: Ghost's ruling on GR-007 (its rows and score column are 3.6's)
Moved: from Phase 3
Check: the CSV reparses to the same rows.

### 3.8 Re-audit keeps history

Waits on: Ghost's ruling on GR-007 (its check reads 3.6's ranking)
Moved: from Phase 3
Check: two audits of the fixture; the ranking shows one row with a history of two.

### 3.9 Tune-up pass 3

Waits on: items 3.6, 3.7 and 3.8
Moved: from Phase 3
Check: `docs/when/tune-up.md` followed in full.

### 4.1 Lead-finder keys

Waits on: Ghost's choice: Adzuna, Jooble, The Muse and USAJOBS developer accounts in Ghost's name or the salesperson's; Adzuna's licence terms after its 14-day trial read before 4.6 ships.
Moved: from Phase 4
From 4.3 (J-034): the names are in `docs/SOURCES.md` (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JOOBLE_API_KEY`, `MUSE_API_KEY`, `USAJOBS_API_KEY`, `USAJOBS_EMAIL`); Adzuna is `excluded` there, since its own terms require a written agreement for "sales prospecting or lead generation" and forbid contacting a listing's provider, so its account is needed only if Ghost obtains that agreement.
Check: the four keys' environment variable names in `docs/SOURCES.md`.

### 4.2 Paid aggregators of closed sites

Waits on: Ghost's choice whether a paid aggregator that reads LinkedIn/Indeed/Glassdoor pages on the program's behalf is acceptable given the terms posture; the free published sources ship first either way.
Moved: from Phase 4
Check: a decision in `theGhost.md`, in force or refused.

### 5.5 Resync once to the parent's then-HEAD

Waits on: Ghost's choice to resync (J-046: the audit at a4c8045 is the product; not planned)
Moved: from Phase 5
Check: 1.5 and 1.6 green after the resync by 1.7's recipe.

### 6.1 Hosting a shared queue

Waits on: Ghost's choice, and a second salesperson; not before Phase 5 is in one salesperson's hands.
Moved: from Phase 6
Check: a decision in `theGhost.md`, in force or refused.

### 6.2 Tune-up pass 6

Waits on: 6.1, the phase's only other item.
Moved: from Phase 6
Check: `docs/when/tune-up.md` followed in full.
