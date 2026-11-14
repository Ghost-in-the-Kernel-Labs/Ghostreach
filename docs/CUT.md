# The cut: what Ghostreach copies from Suite Builder, and what each file loses

Ghostreach's crawl, findings and audit are Suite Builder's at one commit, copied, never depended on (GR-002). This file
is the copy's plan before the copy (TODO 1.1) and its record after: the parent commit, every file copied and from where,
what each loses, the flags stripped, and the resync recipe. `test/unit/cut.test.ts` holds it to `src/`.

Parent commit: `a4c8045` (Suite Builder v1.39.0, `git -C <parent> show a4c8045:<path>`).

## How the list was made

The list is the parent's import closure, traced, not guessed: `scripts/cut_closure.py` reads every static import and
`export ... from`, type-only import, side-effect import, `import()` (in a type position too) and `require()`, resolves each
relative one as the parent's Bundler resolution does, and stops at a cut point. It reads the entries and the cut points from
the block below, so the numbers here come from one repeatable run (REV-02):

    git -C <parent> archive a4c8045 src | tar -x -C <dir>
    python3 -I scripts/cut_closure.py <dir> --list      # this list; --before for the uncut closure

The entries are what one review runs: the crawler, the report's scrub (written) and read (read back), the audit page, and the
parent's crawl-to-file glue. The parent's `src/cli/commands/audit.ts` is not an entry: it is the parent's command line (the
dock, `--vulnsec`, `--fail-on`, `--md`, the suite here), and Ghostreach's own `src/cli` and `src/project` replace it (1.5).

```cut-closure
entry src/crawl/crawler.ts
entry src/crawl/report-scrub.ts
entry src/crawl/report-read.ts
entry src/project/audit.ts
entry src/project/crawl.ts
cut src/kits
cut src/model/build
cut src/model/types
cut src/version.ts
cut src/project/dock
cut src/project/login-crawl
cut src/project/files
cut src/project/portable-write
cut src/project/credentials
cut src/project/resolve-locators
cut src/group/unread
cut src/project/audit-lists-said
cut src/crawl/history.ts
cut src/crawl/readers/snapshot.ts
cut src/crawl/readers/snapshot-take.ts
cut src/crawl/readers/inert.ts
cut src/crawl/readers/api-document.ts
cut src/crawl/readers/role-forms.ts
cut src/crawl/as-role.ts
cut src/crawl/readers/declared.ts
cut src/crawl/readers/labels.ts
cut src/crawl/guard-values.ts
cut src/pages/portable-name.ts
```

## The size, before and after

| Closure | Files | Lines |
| --- | --- | --- |
| From the parent's audit command, uncut (`--before`) | 411 | 46,190 |
| From the five entries, uncut | 372 | 41,745 |
| From the five entries, at the cut points (this list) | 111 | 11,707 |

The last row counts whole files; the lines each file loses inside (below) come off at 1.2 and 1.3. By module, at the cut
points: crawl 56 files (5,471 lines), leaf 26 (3,006), findings 23 (2,522), audit 4 (474), project 2 (234).

## The cut points: each import severed, and what replaces it

Severing is preferred to copying: a cut point is an import the copy drops, with the code that used it. Nothing is stubbed.

| Severed import | In | Why | Replaced by |
| --- | --- | --- | --- |
| `kits/common/visible`, `project/files`, `project/portable-write` | `project/crawl.ts` | saved pages for a suite; portable names for a zipped suite | nothing (no page is saved); `writeFileSync` for the report |
| `project/dock`, `version` | `project/crawl.ts` | the parent's dock and build stamp | Ghostreach's data folder (1.5); nothing |
| `project/login-crawl`, `project/credentials`, `project/resolve-locators` | `project/crawl.ts` | signing in, and the locators' typed account | nothing: a review reads the public site; `typedFor` becomes `[]` |
| `group/unread` (a re-export) | `project/crawl.ts` | the parent's crawl summary lines | nothing |
| `project/audit-lists-said` (with `group/listed-versions`, `group/announced-versions`) | `project/audit.ts` | `--vulnsec` and SITE-36, restricted and private-only (RF-05) | nothing: absent, not off |
| `crawl/history` | `crawl/checklist.ts` | a suite's earlier crawls (the parent's history) | nothing: no recrawl comparison |
| `readers/snapshot`, `readers/snapshot-take`, `readers/inert` (and every `snapshot-*`, `pages/portable-name`) | `crawl/readers/index.ts` | the page saved for whoever writes a suite's tests | nothing: no page is saved |
| `readers/api-document` (and `readers/api-schema`) | `crawl/readers/index.ts` | an API's contract, for a suite's API tests | nothing |
| `readers/role-forms` (and `pages/role-form`) | `crawl/readers/index.ts` | the live page's answer to each locator's role form (the Suite IR's) | nothing; page-step's `roleFormsUnfinished` mark goes |
| `readers/declared`, `readers/labels` | `crawl/readers/index.ts` | facts only the grouping and the suite read; no finding or audit line reads them | nothing |
| `crawl/as-role` | `crawl/crawler.ts` | a signed-in crawl's role marks | nothing: no session |
| `crawl/guard-values` | `crawl/readers/controls.ts` | `--sec`'s guards, fixed off | nothing |
| `model/links-to-look` | `project/audit.ts` | not severed: re-homed (see Questions) | `src/audit/links-to-look.ts`, the audit's six names |

A file the cut leaves unused is not copied; a function the cut leaves unused goes at 1.2 (`knip` names it). No finding a
bare `suite audit <site>` reports reads anything severed here: the readers cut write report fields (`declared`, `labels`,
`roleForms`, `snapshot`, `apiDocument`) that no file of `src/group/` or the audit reads.

## The module map

| Parent | Ghostreach module | Folder |
| --- | --- | --- |
| `src/heuristics/*.ts`, `src/pages/*.ts`, `src/crawl/report.ts` | leaf | `src/leaf/heuristics/`, `src/leaf/pages/`, `src/leaf/report.ts` |
| `src/crawl/**` (but `report.ts`) | crawl | `src/crawl/**`, the same paths |
| `src/group/*.ts` | findings | `src/findings/` |
| `src/project/audit.ts`, `audit-checked.ts`, `page-counts.ts`; `src/model/links-to-look.ts` | audit | `src/audit/` |
| `src/project/crawl.ts`, `text-file.ts` | project | `src/project/` |

The leaf takes the thresholds (`docs/CONTRACT.md`: a threshold lives in the leaf and nowhere else), the report's types every
module reads, and the page-address helpers the crawl, the findings and the audit all call. With that, the closure fits
`docs/modules.json` but for three imports of the parent's audit, each cut at 1.2 without a module change:

- `audit.ts` → `crawl/report-read` and `project/text-file` (`auditedCrawl`): the function moves to `src/project/crawl.ts`;
  project reads the report and hands it to the audit.
- `audit.ts` → `crawl/robots-fetch` (`PRODUCT_TOKEN`): the constant moves to `src/leaf/report.ts`; robots-fetch imports it back.

No module is added and no `mayImport` changes. The alternative, `crawl` in audit's `mayImport` (the report and the pages in
the crawl module), is a module change and waits on Ghost; it is listed under Questions.

## What 1.2 needs beside the files

- Every relative import is rewritten for its new folder and, under the stack's `NodeNext`, takes `.js`; the parent's are
  extensionless (`Bundler`). Changing `tsconfig.json` instead is the stack's change, not the copy's.
- `@types/node`: the copy imports `node:fs`, `node:path`, `node:crypto`, `node:dns/promises` and more; `tsc` needs Node's
  types, which no dependency brings now. A second dependency beside Playwright (GR-009 names only Playwright): see Questions.
- Playwright `~1.63.0`, the one runtime dependency (GR-009), its reason in `theGhost.md`.
- `src/leaf/report.ts` (777 lines), `src/crawl/page-step.ts` (461) and `src/crawl/state.ts` (521) pass the 400-line
  largest-source-file target in `docs/AGENT.md` (unarmed until there is source); copied unchanged, they are recorded, not split.

## The files

Lines are the parent's. "Loses at 1.2": what the cut points take. "Flags at 1.3": the options and flag words the file holds,
in code or comment, that 1.3 strips (every option fixed at what a bare `suite audit <site>` uses: `secondLook` on, the rest
at their defaults). A dash: nothing.

| Parent path | Ghostreach path | Lines | Loses at 1.2 | Flags at 1.3 |
| --- | --- | --- | --- | --- |
| `src/heuristics/crawl.ts` | `src/leaf/heuristics/crawl.ts` | 132 | the entries no copied file reads: `CRAWL_GZIP_OVER_BYTES`, `QUICK_MAX_PAGES`, `SCROLL_STEP`, `UNSTABLE_MAX` | --max-pages |
| `src/heuristics/grouping.ts` | `src/leaf/heuristics/grouping.ts` | 64 | the 10 entries no copied file reads (menus, groups, versions looked up) | — |
| `src/heuristics/java-suite.ts` | `src/leaf/heuristics/java-suite.ts` | 129 | all but six entries: `ADDRESS_TIMEOUT_MS`, `FAILED_HOSTS_CHECKED`, `FAILED_HOSTS_LOOKUP_MS`, `FAILED_HOSTS_TOTAL_MS`, `NOT_CRAWLED_MAX`, `SHORT_FINDINGS` (the last goes at 1.3) | — |
| `src/heuristics/similarity.ts` | `src/leaf/heuristics/similarity.ts` | 60 | — | — |
| `src/heuristics/suite.ts` | `src/leaf/heuristics/suite.ts` | 229 | the 33 entries no copied file reads (the load test, guards, API document, role forms, furniture, site-wide forms and links) | — |
| `src/heuristics/types.ts` | `src/leaf/heuristics/types.ts` | 28 | — | — |
| `src/pages/ad-hosts.ts` | `src/leaf/pages/ad-hosts.ts` | 50 | — | — |
| `src/pages/consent-buttons.ts` | `src/leaf/pages/consent-buttons.ts` | 27 | — | — |
| `src/pages/credential-text.ts` | `src/leaf/pages/credential-text.ts` | 61 | — | — |
| `src/pages/failed-hosts.ts` | `src/leaf/pages/failed-hosts.ts` | 38 | — | — |
| `src/pages/finding-address.ts` | `src/leaf/pages/finding-address.ts` | 11 | — | — |
| `src/pages/fingerprint.ts` | `src/leaf/pages/fingerprint.ts` | 83 | — | — |
| `src/pages/locale.ts` | `src/leaf/pages/locale.ts` | 61 | — | — |
| `src/pages/markup-key.ts` | `src/leaf/pages/markup-key.ts` | 13 | — | — |
| `src/pages/person-text.ts` | `src/leaf/pages/person-text.ts` | 39 | — | — |
| `src/pages/recorded.ts` | `src/leaf/pages/recorded.ts` | 97 | — | — |
| `src/pages/saved-secrets.ts` | `src/leaf/pages/saved-secrets.ts` | 107 | — | — |
| `src/pages/secret-shapes.ts` | `src/leaf/pages/secret-shapes.ts` | 191 | — | — |
| `src/pages/similarity.ts` | `src/leaf/pages/similarity.ts` | 333 | — | — |
| `src/pages/site-of.ts` | `src/leaf/pages/site-of.ts` | 16 | — | — |
| `src/pages/site-text.ts` | `src/leaf/pages/site-text.ts` | 59 | — | — |
| `src/pages/twin-name.ts` | `src/leaf/pages/twin-name.ts` | 6 | — | — |
| `src/pages/url.ts` | `src/leaf/pages/url.ts` | 373 | — | — |
| `src/pages/viewport-zoom.ts` | `src/leaf/pages/viewport-zoom.ts` | 6 | — | — |
| `src/pages/worded-headings.ts` | `src/leaf/pages/worded-headings.ts` | 16 | — | — |
| `src/crawl/report.ts` | `src/leaf/report.ts` | 777 | the types of `declared`, `labels`, `roleForms*`, `snapshot`, `apiDocument` (`ApiDocument`, `ApiOperation`, `ApiAnswer`, `ApiField`); gains `PRODUCT_TOKEN` | --all-languages, --exclude, --include, --login, --long, --offline, --sec, --short |
| `src/crawl/abandoned.ts` | `src/crawl/abandoned.ts` | 16 | — | — |
| `src/crawl/addresses.ts` | `src/crawl/addresses.ts` | 69 | — | — |
| `src/crawl/after-crawl.ts` | `src/crawl/after-crawl.ts` | 97 | — | --offline, externalControl, secondLook (fixed on), session (`--login`) |
| `src/crawl/checklist.ts` | `src/crawl/checklist.ts` | 118 | `comparePage` (history.ts), the `before` map and its log line (a recrawl's comparison) | previous (`--fresh`), session (`--login`) |
| `src/crawl/context.ts` | `src/crawl/context.ts` | 32 | — | — |
| `src/crawl/controls-script.ts` | `src/crawl/controls-script.ts` | 3 | — | — |
| `src/crawl/crawler.ts` | `src/crawl/crawler.ts` | 71 | `markedAs` (as-role.ts) and the `options.session` branch: the report is returned as read | --offline, saturationPages (`--long`), session (`--login`) |
| `src/crawl/credentials-entry.ts` | `src/crawl/credentials-entry.ts` | 48 | — | — |
| `src/crawl/deadline.ts` | `src/crawl/deadline.ts` | 80 | — | — |
| `src/crawl/destination.ts` | `src/crawl/destination.ts` | 221 | — | --offline |
| `src/crawl/discovery.ts` | `src/crawl/discovery.ts` | 145 | — | --exclude, --long, --max-pages |
| `src/crawl/error-line.ts` | `src/crawl/error-line.ts` | 9 | — | — |
| `src/crawl/failed-hosts.ts` | `src/crawl/failed-hosts.ts` | 51 | — | — |
| `src/crawl/frontier.ts` | `src/crawl/frontier.ts` | 272 | — | — |
| `src/crawl/load-watch.ts` | `src/crawl/load-watch.ts` | 263 | — | — |
| `src/crawl/loop.ts` | `src/crawl/loop.ts` | 137 | — | --all-languages, --delay, --exclude, --include, --max-pages, --sec, --settle, --user-agent, previous (`--fresh`), session (`--login`) |
| `src/crawl/open.ts` | `src/crawl/open.ts` | 37 | — | — |
| `src/crawl/options.ts` | `src/crawl/options.ts` | 92 | `onSnapshot`, `typed`, `typedNames` (their readers are gone) | --long, --offline, --quick, --sec, --short |
| `src/crawl/page-step.ts` | `src/crawl/page-step.ts` | 461 | the `roleFormsUnfinished` marks (role-forms.ts gone); `onSnapshot` and `snapshotFiles` in the read context | --all-languages, --login, --sec, --settle, session (`--login`) |
| `src/crawl/part-of-page.ts` | `src/crawl/part-of-page.ts` | 11 | — | — |
| `src/crawl/providers.ts` | `src/crawl/providers.ts` | 69 | — | — |
| `src/crawl/read-pages.ts` | `src/crawl/read-pages.ts` | 54 | — | stopWhen |
| `src/crawl/readers/canonical.ts` | `src/crawl/readers/canonical.ts` | 17 | — | — |
| `src/crawl/readers/consent.ts` | `src/crawl/readers/consent.ts` | 30 | — | — |
| `src/crawl/readers/controls.ts` | `src/crawl/readers/controls.ts` | 27 | `readGuardForms` and the `guards` option (guard-values.ts; `--sec` fixed off) | --sec |
| `src/crawl/readers/credentials.ts` | `src/crawl/readers/credentials.ts` | 26 | — | — |
| `src/crawl/readers/frames.ts` | `src/crawl/readers/frames.ts` | 98 | — | — |
| `src/crawl/readers/headings.ts` | `src/crawl/readers/headings.ts` | 63 | — | — |
| `src/crawl/readers/images.ts` | `src/crawl/readers/images.ts` | 64 | — | — |
| `src/crawl/readers/index.ts` | `src/crawl/readers/index.ts` | 235 | the readers `declared`, `labels`, `role-forms`, `snapshot`, `api-document` and their imports; `apiFileFor`, `API_FILES`; `ReadContext.snapshotFiles`, `onSnapshot`, `signedIn`, `typed`, `typedNames` | --sec |
| `src/crawl/readers/language.ts` | `src/crawl/readers/language.ts` | 44 | — | — |
| `src/crawl/readers/late.ts` | `src/crawl/readers/late.ts` | 39 | — | — |
| `src/crawl/readers/links.ts` | `src/crawl/readers/links.ts` | 93 | — | — |
| `src/crawl/readers/login.ts` | `src/crawl/readers/login.ts` | 37 | — | — |
| `src/crawl/readers/markup.ts` | `src/crawl/readers/markup.ts` | 19 | — | — |
| `src/crawl/readers/providers.ts` | `src/crawl/readers/providers.ts` | 27 | — | — |
| `src/crawl/readers/role-path.ts` | `src/crawl/readers/role-path.ts` | 20 | — | — |
| `src/crawl/readers/seen.ts` | `src/crawl/readers/seen.ts` | 124 | — | — |
| `src/crawl/readers/shape.ts` | `src/crawl/readers/shape.ts` | 7 | — | — |
| `src/crawl/readers/structure.ts` | `src/crawl/readers/structure.ts` | 15 | — | — |
| `src/crawl/reading-script.ts` | `src/crawl/reading-script.ts` | 3 | — | — |
| `src/crawl/redirects.ts` | `src/crawl/redirects.ts` | 51 | — | --offline |
| `src/crawl/refusals.ts` | `src/crawl/refusals.ts` | 31 | — | session (`--login`) |
| `src/crawl/relaxed-chain.ts` | `src/crawl/relaxed-chain.ts` | 98 | — | --offline |
| `src/crawl/report-held.ts` | `src/crawl/report-held.ts` | 55 | — | — |
| `src/crawl/report-read.ts` | `src/crawl/report-read.ts` | 199 | — | — |
| `src/crawl/report-scrub.ts` | `src/crawl/report-scrub.ts` | 127 | — | — |
| `src/crawl/robots-fetch.ts` | `src/crawl/robots-fetch.ts` | 102 | `PRODUCT_TOKEN`'s definition (moved to `leaf/report.ts`, imported back) | — |
| `src/crawl/robots.ts` | `src/crawl/robots.ts` | 165 | — | — |
| `src/crawl/router.ts` | `src/crawl/router.ts` | 155 | — | — |
| `src/crawl/second-look.ts` | `src/crawl/second-look.ts` | 145 | — | --delay, --quick, --settle, --user-agent, session (`--login`) |
| `src/crawl/settle.ts` | `src/crawl/settle.ts` | 89 | — | — |
| `src/crawl/site-probe.ts` | `src/crawl/site-probe.ts` | 297 | — | --offline |
| `src/crawl/state.ts` | `src/crawl/state.ts` | 521 | `snapshotNames` (no page is saved) | --all-languages, --offline |
| `src/crawl/trackers.ts` | `src/crawl/trackers.ts` | 45 | — | — |
| `src/crawl/values.ts` | `src/crawl/values.ts` | 47 | — | — |
| `src/group/address-key.ts` | `src/findings/address-key.ts` | 13 | — | — |
| `src/group/by-component.ts` | `src/findings/by-component.ts` | 165 | — | — |
| `src/group/check-catalogue.ts` | `src/findings/check-catalogue.ts` | 188 | — | --sec, --vulnsec |
| `src/group/finding-order.ts` | `src/findings/finding-order.ts` | 30 | — | — |
| `src/group/findings.ts` | `src/findings/findings.ts` | 256 | — | — |
| `src/group/item-evidence.ts` | `src/findings/item-evidence.ts` | 42 | — | — |
| `src/group/link-findings.ts` | `src/findings/link-findings.ts` | 288 | — | — |
| `src/group/load-findings.ts` | `src/findings/load-findings.ts` | 201 | — | --offline |
| `src/group/markup-findings.ts` | `src/findings/markup-findings.ts` | 248 | — | — |
| `src/group/markup-items.ts` | `src/findings/markup-items.ts` | 26 | — | — |
| `src/group/near-copies.ts` | `src/findings/near-copies.ts` | 51 | — | — |
| `src/group/on-purpose.ts` | `src/findings/on-purpose.ts` | 49 | — | — |
| `src/group/other-site-load.ts` | `src/findings/other-site-load.ts` | 98 | — | — |
| `src/group/page-findings.ts` | `src/findings/page-findings.ts` | 11 | — | — |
| `src/group/pages.ts` | `src/findings/pages.ts` | 91 | — | — |
| `src/group/probe-findings.ts` | `src/findings/probe-findings.ts` | 180 | — | — |
| `src/group/query-dropped.ts` | `src/findings/query-dropped.ts` | 18 | — | — |
| `src/group/reasons.ts` | `src/findings/reasons.ts` | 166 | — | — |
| `src/group/script-errors.ts` | `src/findings/script-errors.ts` | 56 | — | — |
| `src/group/softer-items.ts` | `src/findings/softer-items.ts` | 62 | — | — |
| `src/group/stale-menu.ts` | `src/findings/stale-menu.ts` | 52 | — | — |
| `src/group/title-finding.ts` | `src/findings/title-finding.ts` | 42 | — | — |
| `src/group/types.ts` | `src/findings/types.ts` | 189 | — | — |
| `src/project/audit-checked.ts` | `src/audit/audit-checked.ts` | 75 | — | — |
| `src/project/audit.ts` | `src/audit/audit.ts` | 286 | `auditedCrawl` (to `project/crawl.ts`); the lists (audit-lists-said.ts: `listsHtml`, `LISTS_ASKED`, `OWNER_ONLY`, `ownerOnly`, `requestedBy`, `ListsShown`, the `lists`/`listed` parameters); the `expected` (expected-links) parameters; `PRODUCT_TOKEN` from the leaf | --fail-on, --short, --user-agent, --vulnsec, `FREE_SCAN_LIMIT` |
| `src/model/links-to-look.ts` | `src/audit/links-to-look.ts` | 71 | `lookLine`; the `expected` parameter and its branch (a suite's expected-links block) | — |
| `src/project/page-counts.ts` | `src/audit/page-counts.ts` | 42 | — | — |
| `src/project/crawl.ts` | `src/project/crawl.ts` | 223 | all but `installBrowser`, the http:// retry, `scrubbedReport` and the write: the dock (`inCrawls`, `otherSiteCrawl`, `crawlFileName`, `placed`), logins (`crawlBehindLogins`, `credentialsFor`), saved pages (`save`, `visibleText`, `snapshotDir`, `moveNamed`), `writeNamed` (plain `writeFileSync`), `TOOL_BUILD`, `typedFor` (`[]`: no account), `recentCrawl`, `discardCrawl`, the group/unread re-export; gains `auditedCrawl` | --admin-login, --login, --out, --sec |
| `src/project/text-file.ts` | `src/project/text-file.ts` | 11 | — | — |

## Ghostreach's own files

Files under `src/` that are not copies; every other file there is a row above. A new file of Ghostreach's own (the PDF,
the review's folder, the queue) adds its line here.

- `src/leaf/words.ts`
- `src/cli/main.ts`

## The flags stripped

The parent's audit and crawl options, all stripped at 1.3 (P-15, GR-003). Once a row says `stripped`, no file under `src/`
may name the flag, in code or comment (`test/unit/cut.test.ts`). 1.3 sets each row to `stripped` as it goes.

| Flag | What it set | Status |
| --- | --- | --- |
| `--short` | the short audit, `FREE_SCAN_LIMIT`, `shortView`, `H.SHORT_FINDINGS` | at 1.3 |
| `--fail-on` | `FAIL_ON`, `failsAudit`, exit 3 | at 1.3 |
| `--md` | the Markdown audit (`audit-md.ts`, never copied) | at 1.3 |
| `--vulnsec` | the public lists and SITE-36 (never copied; the catalogue's SITE-36 row goes) | at 1.3 |
| `--demo` | the parent's demo build | at 1.3 |
| `--offline` | `options.offline`: no host but the site asked | at 1.3 |
| `--sec` | `options.sec`: the page's guards and forms | at 1.3 |
| `--max-pages` | `options.maxPages` | at 1.3 |
| `--delay` | `options.delayMs` | at 1.3 |
| `--settle` | `options.settleMs` | at 1.3 |
| `--user-agent` | `options.userAgent` | at 1.3 |
| `--include` | `options.include` | at 1.3 |
| `--exclude` | `options.exclude` | at 1.3 |
| `--all-languages` | `options.allLanguages` | at 1.3 |
| `--long` | no page limit, `saturationPages` 0 | at 1.3 |
| `--quick` | `QUICK_MAX_PAGES`, `secondLook` off | at 1.3 |
| `--login` | `options.session` as user | at 1.3 |
| `--admin-login` | `options.session` as admin | at 1.3 |
| `--out` | where the report goes | at 1.3 |
| `--fresh` | `options.previous`: a recrawl beside the last | at 1.3 |

## The parent's unit tests 1.4 carries

Traced as the files are: a test is carried whole when every file of `src/` it reaches, through its helpers too, is in the
list above. 55 tests (5,311 lines), each to `test/unit/` under its own name:

`addresses.test.ts`, `after-crawl.test.ts`, `audit-items.test.ts`, `check-catalogue.test.ts`, `closed-links.test.ts`,
`crawl-format.test.ts`, `crawl-state.test.ts`, `credential-marks.test.ts`, `credential-visit.test.ts`, `destination.test.ts`,
`discovery.test.ts`, `error-statuses.test.ts`, `external-unconfirmed.test.ts`, `failed-hosts.test.ts`, `finding-order.test.ts`,
`findings-in-full.test.ts`, `fingerprint.test.ts`, `frames.test.ts`, `frontier.test.ts`, `head-then-get.test.ts`,
`host-refuses.test.ts`, `hubspot-tracking.test.ts`, `load-findings.test.ts`, `load-other-site.test.ts`,
`load-unknown-source.test.ts`, `markup-findings.test.ts`, `menu-before-stop.test.ts`, `near-copies.test.ts`,
`offline-crawl.test.ts`, `offline-probes.test.ts`, `part-of-page.test.ts`, `person-text.test.ts`, `placeholder-only.test.ts`,
`probe-findings.test.ts`, `providers.test.ts`, `reader-names.test.ts`, `reasons-wording.test.ts`, `recorded.test.ts`,
`redirects.test.ts`, `robots-chain-tls.test.ts`, `robots-chain.test.ts`, `robots.test.ts`, `router.test.ts`,
`run-readers.test.ts`, `same-content.test.ts`, `second-look-late.test.ts`, `second-look-values.test.ts`,
`secret-shapes-differential.test.ts`, `sections-unread.test.ts`, `session-links.test.ts`, `similarity.test.ts`,
`site-text.test.ts`, `stale-menu.test.ts`, `trackers.test.ts`, `unread-reasons.test.ts`.

Their helpers come with them: `test/support/audit-crawls.ts`, `banned-words.ts`, `made-up-keys.ts`, `review-reports.ts`,
`secret-shapes-before-gate.ts`; `test/unit/hostile.ts`, `taint.ts`. `offline-crawl.test.ts` and `offline-probes.test.ts`
test `--offline`: after 1.3 only their cases that hold without it stay.

Carried in part, the roadmap's named six, their suite-side cases dropped: `findings.test.ts` (the `siteFindings` and
`linksToLookAt` cases; not `knownIssues`, `planBugs`, `tagsAsCode`), `audit.test.ts` (`auditHtml`, `AUDIT_FOOTER`, the
banned words; not `auditMarkdown`, `savedCrawl`, `knownIssues`, `--short`, `--fail-on`), `audit-checked.test.ts` (not
`auditMarkdown`), `suite-words.test.ts` (its subject, the words a prospect reads, as cases of `test/unit/words.test.ts` over
`AUDIT.html`; `test/support/prospect-words.ts`), and `check-rules.test.ts` (it parses with `ts5`, a dependency Ghostreach
does not have: carried only if its check can be made without it, else dropped with its line).

Not carried: 22 tests of the parent's own gate and scripts (`gated-commit*`, `check-stages*`, `flakes*`, `secret-scan`,
`release*`, ...), 2 of its saved corpus (`real-sites`, `real-pages`), and the rest, which reach the suite side (kits, model,
back ends), the grouping into page types, the parent's command line, the bench, `--md` or `--vulnsec`. 1.4 writes each
dropped test's line here, under its own heading.

## The fixture 1.5 needs

The parent's fixture site, copied as a test helper: `test/fixture-site/server.ts` (191 lines; `startFixtureSite`, the made-up
"Fixture Dex", every request logged) and its six pages, `test/fixture-site/pages/{home,list,pokemon,type,about,not-found}.html`
(126 lines), to the same paths here. Not `serve.ts` (`npm run serve:fixture`), which also starts the sign-in site
(`login.ts`, `identity.ts`): a review reads the public site. The parent's `AUDIT.html` for the fixture, the golden 1.6 compares
to, is made once by the parent's own build in a scratch folder, never in its tree.

## The resync recipe

Written at 1.7. Its outline (`docs/ROADMAP.md` 1.7): build the parent's new commit's closure with `scripts/cut_closure.py`
and diff it against the list above (files in, files out, files moved); diff each listed file between `a4c8045` and the new
commit; apply each change to its Ghostreach path, the losses above kept; bump the parent commit here; rerun 1.5 and 1.6.

## Questions

Choices this file makes that the documents do not settle; each is the agent's, recorded in the journal (J-012), for Ghost
or the ruling grade to confirm or reverse.

1. `src/model/links-to-look.ts` is carried (as `src/audit/links-to-look.ts`, the audit's six names) though GR-004 says
   nothing of `src/model/` is copied: the audit's "Links that need a look" section is built by it, so leaving it out breaks
   REV-07 and 1.6's golden. It holds no Suite IR. Its `LOOK_INTRO` sentence names "the suite's expected-links block", a
   suite word a prospect would read: kept at 1.2 (the parent's words, REV-07); whether 1.6 allows rewording it is open.
2. The leaf takes the report's types and the page-address helpers so that no module changes; the alternative is `crawl` in
   the audit's `mayImport`.
3. `@types/node` is needed at 1.2 and is not in GR-009.
4. `readers/declared` and `readers/labels` are cut because no finding reads them; if Ghost would rather keep the crawl
   whole and cut only the suite's readers, they return as two files.
