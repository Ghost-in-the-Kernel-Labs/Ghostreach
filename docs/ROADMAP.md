# Roadmap: the plan, not the decision log

A plan, in phases. Each phase's steps are items with a check that fails before the work and passes
after; each phase ends with a numbered tune-up pass (C-024). When a phase is built, its section
shrinks to a ten-line header and the decisions it produced live in `theGhost.md`. `TODO.md` is this
plan as a chain: the open items, in order, with the checks copied; `docs/DONE.md` is what is
finished.

## 1. The product in three sentences

Ghostreach is the tool for the people who reach out to find Suite Builder's clients: Suite
Builder's crawl and site audit cut out as one flag-free program. Give it a site, it crawls, writes
the review and hands back a Suite Builder-branded PDF carrying Ghost's GitHub; the prospect sees
Suite Builder's name, never Ghostreach's. Around that one command sit a queue (many sites, run in order), a ranking
(sites sorted by what the audit found, most first) and a lead finder (companies hiring QA
engineers, so the salesperson audits sites that already know they need testing). The thesis to
hold: the salesperson never sees a flag, a terminal option or an HTML file; the thesis to refuse:
that this program grows into a second Suite Builder. It generates no suite, ever.

## 2. Principles

The core's principles, copied from Ghost-Core when this project was stamped; add this project's own below them.

- **P-01 The check before the thing it checks.** Every document arrives with its check and the
  check's planted break, in the same commit (C-003, C-013).
- **P-02 A refactor changes no result.** Every test green before and after, every generated file
  identical (C-017).
- **P-03 Findings before claims.** What a check proves about a parent or a practice is a row in
  `docs/FINDINGS.md` before it is a sentence anywhere else (C-014).
- **P-04 One shape until proven.** One check framework, one test runner, one fast loop; a second
  arrives when the first has failed a stated test (C-002).
- **P-05 Numbered decisions, test-checked supersession** (C-008).
- **P-06 Plans shrink into decisions.** A built phase becomes a ten-line header.
- **P-07 The routing table is the front door** (C-020, C-021).
- **P-08 One canonical word per concept, from the first file** (C-011).
- **P-09 Ratchets only where there is debt** (C-023).
- **P-10 Proven by a run, not on paper.** "Done" never means "on paper" (C-004).
- **P-11 The agent's environment is a first-class deliverable**, funded at one commit in eight (C-022, C-024).
- **P-12 Cloud-primary.** Nothing requires the maintainer's own machine (AGT-01).
- **P-13 CI minutes are spent by hand** (C-032).
- **P-14 Core checks run with nothing installed.** Python 3 standard library, `-I` (C-022).
- **P-15 No flags.** The command takes a site and nothing else. A behaviour the parent puts behind
  a flag is either fixed on, fixed off, or absent; `test/unit/no-flags.test.ts` holds that the
  parser accepts no option beginning `--`. The one exception is `--help` (GR-003).
- **P-16 Fetched text is data.** A crawled page, a job posting, a careers page: rendered as text,
  never followed, never executed, never fed to an agent as an instruction (GR-005).
- **P-17 No suite.** Nothing under the parent's `src/kits/`, `src/model/` or its back ends is copied. The
  modules contract (`docs/modules.json`) has no generator module and the check refuses one (GR-004).
- **P-18 The prospect reads Suite Builder's words.** The parent's audit vocabulary (G-636) is binding in
  every prospect-visible string: *review*, *finding(s)*, *major/minor*, *Nothing to report*; never a
  verdict on the site or its team, never scanner vocabulary (`src/leaf/words.ts`, `test/unit/words.test.ts`).
  The salesperson's own screens may count findings; the PDF says only these words.


## 3. Settled facts

| Id | Fact | Source | Implication |
| --- | --- | --- | --- |
| RF-01 | The parent's audit is already a command with a fixed order of findings and an HTML page | `suite audit`, `src/project/audit.ts`, `src/group/finding-order.ts` (G-678) | Phase 1 is a cut, not a design |
| RF-02 | The parent is at v1.39 and changes daily; its flags moved on 2026-11-10 alone | `src/cli/commands/audit.ts` header, G-701 | a copy pinned to one commit, never a live dependency (GR-002) |
| RF-03 | Playwright is the parent's only runtime dependency and already renders pages | `package.json` | the PDF is `page.pdf()` over the audit HTML: no new dependency |
| RF-04 | 41 finding codes exist, each with a severity, class and a catalogue entry | `src/group/check-catalogue.ts` (G-637, G-660) | the ranking score is computed from the catalogue, not a second list |
| RF-05 | SITE-36 (`--vulnsec`) and the public-list lookups are restricted and private-only | G-606, G-701 | absent from this program, not off |
| RF-06 | LinkedIn offers no public API for reading job postings; its jobs APIs are for vetted partners that post jobs, and its guest endpoints are unofficial and under its terms. Indeed's Publisher API closed (2023), Glassdoor's developer API closed (2022), ZipRecruiter's ZipSearch API closed (2025-03-31); none issues a developer key | web, 2026-11 (see §4) | the lead finder reads every source with a published endpoint and free access, and takes a LinkedIn/Indeed/Glassdoor URL only by paste |
| RF-07 | ATS job boards publish per-company endpoints with no key: Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Personio, Rippling and others; depth per company, no discovery | web, 2026-11 | the primary lane: confirm a named company is hiring QA before its site is crawled |
| RF-08 | Free discovery sources, each with a cap or a condition: Adzuna (free key; 250/day, 2,500/month; a licence may be asked after 14 days), Jooble (free key; links route through Jooble), The Muse (500/hour keyless, 3,600 with a key; must link back), Arbeitnow and Remotive (keyless feeds; Europe/remote), USAJOBS (free; federal only) | web, 2026-11 | discovery runs as a batch inside the caps, never as an interactive search |
| RF-09 | The parent crawls with one browser and one page at a time, and `crawler.ts` takes an injected `options.browser` | `src/crawl/crawler.ts:53` | several crawls can share one Chromium as separate contexts |
| RF-10 | SITE-22 (slow pages) is a timing measurement | `src/group/load-findings.ts` | a loaded laptop can manufacture a slow-page finding; concurrency needs a guard (GR-008) |


## 4. What is deliberately not built

- **A suite, or any part of one** (P-17). The sale is the suite; the audit is the door.
- **Any flag** (P-15). `--short`, `--fail-on`, `--md`, `--vulnsec`, `--demo`, `--offline`, `--sec`
  and every crawl-shaping option of the parent are gone. The audit is always the full audit.
- **A live dependency on the parent.** The parent's license, its dock, its history and its gate are
  not this program's. The code is copied at a pinned commit and resynced by a numbered item (GR-002).
- **A scraper of any job site.** LinkedIn, Indeed, Glassdoor and ZipRecruiter have no developer
  access (RF-06); reading their pages is automated access under their terms and, for LinkedIn, puts
  the salesperson's own account at risk. The lead finder reads only endpoints a source publishes
  (RF-07, RF-08) and accepts a posting from a closed site by paste (the salesperson's own browsing).
  Paid aggregators that scrape those sites on the program's behalf are 4.2, Ghost's choice, not a default.
- **Hosting, accounts, payment.** v1 runs on the salesperson's laptop and opens a local page. A
  hosted queue is Phase 6 (6.1, Ghost's choice), not before there is more than one salesperson.
- **A CI workflow that runs on push** (C-032).
- **A database.** One folder per audit under a data folder: the crawl, the findings, the PDF, a
  summary JSON. The ranking reads the summaries. A database arrives when a stated test fails (P-04).


## 5. The meta-architecture

The core's table, copied from Ghost-Core when this project was stamped; add this project's contract and modules.

| Document | What it holds | Test |
| --- | --- | --- |
| `CLAUDE.md` | the routing table, the when list, the binding rules | `test/test_claude_md.py` (words, rows, pointers) |
| `theGhost.md` | the decisions | `test/test_ghost.py` |
| `docs/GLOSSARY.md` | the words | `test/test_glossary.py` |
| `docs/journal/` | what happened | `test/test_journal.py` |
| `TODO.md`, `docs/DONE.md`, this file | the plan as a chain | `test/test_todo.py` |
| `docs/HANDOFF.md` | what waits on whom | `test/test_journal.py` (open conflicts), `test/test_registers.py` (raised escalations) |
| `docs/FINDINGS.md`, `docs/ESCALATIONS.md` | the registers | `test/test_registers.py` |
| `docs/NAVIGATION-LOG.md` | the debriefs and the last review | `test/test_navigation.py` |
| `docs/AGENT.md` | the environment contract and the metrics | `test/test_metrics.py` |
| `docs/CONTRACT.md`, `docs/modules.json` | the kernel contract and the import graph | `test/test_contract.py`, `test/test_modules.py` |
| `docs/when/*.md`, `docs/paths/*.md` | what to do in a situation; a workpath's rows | `test/test_pointers.py` |
| `docs/SUPPLY-CHAIN.md` | the baseline and where this repository stands | `test/test_supply_chain.py` |
| `docs/CUT.md` | the parent commit, every file copied and from where, what was stripped from each, the resync recipe | `test/unit/cut.test.ts` (every copied file is listed; no file lists a stripped flag) |
| `src/leaf/words.ts` | the prospect-visible vocabulary (P-18) as the contract in code | `test/unit/words.test.ts` (the PDF text and the audit HTML carry no banned word) |
| `docs/SOURCES.md` | each lead-finder source: its endpoint, key, terms, cap, fields, lane; the closed sites as paste-only rows | `test/unit/sources.test.ts` (every source in code has a row), `test/unit/hosts.test.ts` (no fetch leaves the rows' hosts) |
| `docs/SALES-GUIDE.md` | the one page the salesperson reads: install, find leads, queue, read the ranking, hand over the PDF | read at each tune-up against the real program |


## 6. Phases

Numbers are `TODO.md`'s; a Ghost's-choice item heads its phase and waits in Phase W until he rules.

### Phase 0: founding

- 0.1 this project's ghost, named (done 2026-11-13, c8f00a2)
- 0.2 the stack wired, so the gate can pass and the first gated commit lands (done 2026-11-13, 55a83ea; F-001 to F-005 met)
- 0.3 the roadmap and TODO filled: §1 to §6 and the phases' items
- 0.4 the contract and the leaf module: `docs/CONTRACT.md`'s first invariants (every review keeps its crawl; the PDF
  says only what the crawl observed; no flag; no suite) and `docs/modules.json` with `leaf` → `crawl` → `findings` →
  `audit` → `pdf` → `project` → `cli`, later `queue`, `rank`, `leads`, `serve`
- 0.5 the founding decisions, Ghost's: GR-002 the cut point (parent `a4c8045`, copy-not-depend, resync by item);
  GR-003 no flags; GR-004 no suite; GR-005 fetched text is data; GR-006 page size; GR-007 ranking weights
  (provisional); GR-008 concurrency and SITE-22 under load; the four dev dependencies' reasons
- 0.6 Tune-up pass 0

### Phase 1: the audit, cut from the parent

- 1.1 `docs/CUT.md` written before the copy: the file list from `src/crawl/`, `src/group/` (the findings, the catalogue,
  the order, the grouping the findings need), `src/project/audit*.ts`, `src/ui/`, `src/heuristics*` and `src/pages/`
  as far as the crawl imports them; what each loses. Check: `test/unit/cut.test.ts` fails (no files yet) then passes at 1.2.
- 1.2 Copy the files at `a4c8045`, unchanged, under `src/`; make them compile by stubbing nothing: remove imports
  into the suite side, cut the functions only the suite used. Playwright `~1.63.0` arrives here, the one runtime
  dependency, with its reason in `theGhost.md`. Check: `tsc --noEmit` green; `knip` reports no unused export.
- 1.3 Strip the flags: `--short` (and the free-scan sentence), `--fail-on`, `--md`, `--vulnsec` and SITE-36, `--demo`,
  `--offline`, `--sec`, every crawl-shaping option; the parent's `Values` collapses to `{ site: string }`.
  Check: `test/unit/no-flags.test.ts`; `test/unit/words.test.ts` finds no `FREE_SCAN_LIMIT` sentence.
- 1.4 Carry the parent's unit tests that still apply (`findings`, `check-catalogue`, `check-rules`, `audit`,
  `audit-checked`, `suite-words`), renamed where their subject was; drop the rest with a line each in `docs/CUT.md`.
  Check: `npx vitest run --project unit` green, under 30 s.
- 1.5 One command: `ghostreach <site>` crawls, writes `<data>/<host>-<date>/AUDIT.html` plus `findings.json` and
  `summary.json` (host, date, pages read, count by severity, count by code). Check: `test/crawl/ghostreach.spec.ts`
  against the parent's fixture server (`serve-fixture` copied as a test helper): the findings list, in order,
  equals the parent's for the same fixture.
- 1.6 Golden: the parent's `AUDIT.html` for the fixture and this program's differ only in the title line and the
  footer. Check: the golden test, recorded once with `UPDATE_GOLDEN=1`, read by hand.
- 1.7 The resync recipe in `docs/CUT.md`: diff `src/group/` between the pinned commit and the new one; apply; bump the
  pin; rerun 1.5 and 1.6. Check: the recipe run once as a dry run against `a4c8045..HEAD` of the parent, its moves listed.
- 1.8 Tune-up pass 1.

### Phase 2: the PDF

- 2.1 Page size, Ghost's choice (GR-006): Letter (US prospects) or A4; one or the other, the salesperson picks nothing.
- 2.2 The GitHub address the PDF carries, Ghost's choice: `github.com/ghost-in-the-kernel` or
  `github.com/Ghost-in-the-Kernel-Labs`.
- 2.3 `src/pdf/`: Playwright opens the audit HTML and `page.pdf()`s it at the size 2.1 chose. Check: a PDF exists after
  `ghostreach <fixture>`; the test's PDF reader recovers every finding heading.
- 2.4 The brand: a cover page (the Suite Builder wordmark as text or SVG, the site, the date, "Prepared with Suite
  Builder, Ghost in the Kernel Labs" and the address from 2.2), a running footer with the address on every page.
  Check: `test/unit/words.test.ts` finds the address on every page's text and no banned word (P-18).
- 2.5 The PDF is the one artefact: the HTML stays in the data folder for the program's own use, and nothing the
  salesperson sees names it. Check: the local UI (Phase 3) and the guide link only to the PDF;
  `grep -rn "AUDIT.html" docs/SALES-GUIDE.md` is empty.
- 2.6 The audit's "What this review checked" list, read from the catalogue (G-637), closes the PDF. Check: the count
  of checks listed equals the catalogue's length minus the absent SITE-36.
- 2.7 Tune-up pass 2.

### Phase 3: the queue and the ranking

- 3.1 SITE-22 under load, Ghost's choice (GR-008): a reference timing (a known-fast page fetched at the same moment,
  SITE-22 reported relative to it) or SITE-22 withheld above concurrency 1 with one sentence in the PDF saying so. Answered
  (GR-014): withheld, from a review whose crawl another review ran beside.
- 3.2 `ghostreach serve`: a local web page on `127.0.0.1` (Node's `http`, no framework; P-04), opened in the browser.
  Check: the test fetches the page; it binds to loopback only.
- 3.3 The queue: paste one site per line; `queue.json` holds them with a state each (`waiting`, `running`, `done`,
  `failed`); a failed site keeps its error line and is retried only by the salesperson. Check: `test/unit/queue.test.ts`:
  order kept, a failure does not stop the next.
- 3.4 Concurrency (GR-008): up to N crawls at once, default 3, ceiling 5, set once in the program's settings file (not
  a flag, P-15); one Chromium shared as N contexts through `options.browser` (RF-09); never two crawls of one host at
  once; `ghostreach doctor` reports the machine's memory and the N it recommends. Check: `test/unit/queue.test.ts`: N
  running and no more, two entries of one host never together; `test/crawl/concurrent.spec.ts`: three fixture sites
  crawled together give the same findings as one after another.
- 3.5 SITE-22 withheld under load (GR-014, 3.1's answer): SITE-22 is withheld from a review when any other review was running at
  any moment of its crawl (the actual overlap, known to the queue's runner; not merely a setting above one), passed into the
  findings as a flag, never read from a clock; `ghostreach <site>` and a queued review that ran alone report it as before, the
  thresholds untouched. A withheld review's page and PDF say, before the findings: "This review ran alongside others, so it did
  not time the pages: it has no finding on slow pages.", and its "What this review checked" row for SITE-22 says not timed.
  Check: the concurrent spec's SITE-22 result equals the serial run's, read under GR-014: on fixture sites with a slow page, the
  concurrent run reports no SITE-22 the serial run lacks, its PDF carries the sentence, and the serial PDF does not.
- 3.6 The ranking, `src/rank/`: score = `major × 3 + minor × 1` over `summary.json` (GR-007, provisional until ten
  real audits are read), with pages read beside it; sorted most first; each row links its PDF. Check: a fixture set of
  three summaries ranks in the known order; a tie breaks by findings per page.
- 3.7 Export: the ranking as CSV (host, date, pages, major, minor, score, PDF path). Check: the CSV reparses to the same rows.
- 3.8 Re-audit: a site already in the data folder gets a new dated folder; the ranking shows the newest and keeps the
  old. Check: two audits of the fixture, the ranking shows one row with a history of two.
- 3.9 Tune-up pass 3.

### Phase 4: the lead finder

Two lanes. The **company lane** answers "is this company hiring QA?" for a company the salesperson names (RF-07). The
**discovery lane** answers "who is hiring QA that I have not heard of?" from every free board with a published endpoint
(RF-08), run as a batch inside each source's cap. This phase widens the attack surface (P-16): the program now fetches
third-party text chosen by a search, so every source is read through one fetch function.

- 4.1 Keys, Ghost's choice: Adzuna, Jooble, The Muse and USAJOBS developer accounts, in Ghost's name or the
  salesperson's; Adzuna's licence terms after its 14-day trial read before 4.6 ships.
- 4.2 Paid aggregators, Ghost's choice: whether one that reads LinkedIn/Indeed/Glassdoor pages on the program's behalf
  (JobsPipe, LoopCV, OpenWeb Ninja; free tiers of ~100 calls/month) is acceptable given the terms posture; the free
  published sources ship first either way.
- 4.3 `docs/SOURCES.md` before any code, one row per source: endpoint, key (none / free), terms (link-back,
  redistribution, commercial use), rate cap, fields returned, whether it gives the company's website, which lane.
  Company lane: Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Personio, Rippling, Teamtailor,
  Breezy. Discovery lane: Adzuna, Jooble, The Muse, Arbeitnow, Remotive, USAJOBS. Closed sites (LinkedIn, Indeed,
  Glassdoor, ZipRecruiter): a row each saying *paste only* and why (RF-06). Check: `test/unit/sources.test.ts` fails
  (no sources in code) then passes at 4.6; every host the code fetches has a row (`test/unit/hosts.test.ts`).
- 4.4 Keys in code: one named environment variable per keyed source, never printed, never committed; the UI shows
  "key present / absent", never the key; a source without its key is skipped and said so. Check:
  `scripts/checks/secrets.py` on the tree; a test that the UI's HTML contains no key-shaped string.
- 4.5 One fetch function (P-16): returns text or JSON, strips markup, follows no link, honours each source's cap with a
  per-source token bucket persisted in the data folder so a restart does not reset Adzuna's 250/day. Check:
  `test/unit/fetch.test.ts`: a redirect is not followed, HTML comes back as text, the bucket refuses the 251st call.
- 4.6 The company lane, `src/leads/company.ts`: the salesperson types a company name or its site; the program derives
  candidate board slugs and probes each ATS endpoint; a hit lists the open roles filtered to QA/test/SDET titles.
  Check: recorded fixtures per ATS (no network in the unit loop); a company on Greenhouse under one slug is found; a
  company on none says "no public board found" and offers the paste lane.
- 4.7 The discovery lane, `src/leads/discover.ts`: a saved search (titles: QA engineer, test automation, SDET, QA
  analyst; a location or "remote"), run on request as a batch across every discovery source with a key present;
  results deduped by company; each row carries company, title, posting URL, source and the website when given.
  Check: recorded fixtures; one row per company; a source over its cap is skipped and named, never waited on.
- 4.8 Website resolution: when a source gives no site, the company row shows a text box for the salesperson, never a
  search-engine fetch. Check: `test/unit/hosts.test.ts` holds that no fetch leaves the allow-list.
- 4.9 Paste lane: a posting URL from a closed site is kept as a note on the company row; the program does not fetch
  it. Check: the fetch function is never called for a pasted URL.
- 4.10 "Queue this site": a company row with a website goes into Phase 3's queue in one click, the posting kept as
  the row's reason; a company already audited shows its score instead. Check: the queue entry carries the lead's
  source and URL.
- 4.11 Attribution: where a source's terms ask for a link back (The Muse, Jooble, Arbeitnow), the row links the
  source's own posting page. Check: `test/unit/sources.test.ts` holds that every row from a link-back source carries it.
- 4.12 Tune-up pass 4.

### Phase 5: in the salesperson's hands

- 5.1 Packaging: `npm pack` from a tagged release; install is one command plus `npx playwright install chromium`;
  `ghostreach doctor` says what is missing in plain words. Check: a fresh container installs from the tarball and
  audits the fixture.
- 5.2 Windows, by hand on GitHub Actions (P-13, `workflow_dispatch` only, pinned actions, `permissions: contents:
  read`): install, audit the fixture, read the PDF's text. Check: the run green once per release; its minutes in
  the journal's Cost line.
- 5.3 `docs/SALES-GUIDE.md`: one page: install, find leads, queue, read the ranking, send the PDF, what to say when a
  site fails to crawl. Check: a reader who is not Ghost follows it on a clean machine and reaches a PDF (a finding, P-03).
- 5.4 Ten real audits read by Ghost: the weights of 3.6 confirmed or changed (GR-007 settled), the ranking's columns
  pruned to what sold. Check: `theGhost.md` carries the ruling.
- 5.5 Resync once (1.7's recipe) to the parent's then-HEAD, so the cut is proven live before anyone depends on it.
  Check: 1.5 and 1.6 green after the resync.
- 5.6 Tune-up pass 5.

### Phase 6: a shared queue

Not before Phase 5 is in one salesperson's hands, and not before there is a second salesperson.

- 6.1 Hosting, Ghost's choice: a shared queue needs a host, sign-in and a place for PDFs; which, and whether at all.
- 6.2 Tune-up pass 6.
