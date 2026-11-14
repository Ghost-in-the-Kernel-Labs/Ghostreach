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
| From the five entries, at the cut points (1.1's list) | 111 | 11,707 |
| Copied at 1.2, cut inside (this list) | 114 | 10,357 |
| After 1.3, the flags stripped | 113 | 9,879 |

The third row counts whole files; the fourth is what 1.2 left: four files the cut left unused were not copied ("Traced, not
copied"), two were split by a pure move and one by what it does (`state.ts`, J-014), and each file lost what its row says. By module after 1.2: crawl 60 files (5,287
lines), leaf 27 (2,439), findings 21 (2,110), audit 4 (427), project 2 (94). The flags came off at 1.3 (J-016): by module after it, crawl 59 files (5,010 lines), leaf 27 (2,340), findings 21 (2,103),
audit 4 (336), project 2 (90).

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
| `crawl/guard-values` | `crawl/readers/controls.ts` | `--sec`'s guards, fixed off | nothing; its `heldControl` without the guards' half moved into `readers/controls.ts` (the page's answer held again in Node, against a hostile page) |
| `model/links-to-look` | `project/audit.ts` | not severed: re-homed (the ruling grade, J-013) | `src/audit/links-to-look.ts`, the audit's names |

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

## What 1.2 did beside the files

- Every relative import is rewritten for its new folder and takes `.js` under the stack's `NodeNext`; the parent's are
  extensionless (`Bundler`). `tsconfig.json` names `"types": ["node"]` (TypeScript 7 loads no `@types` by default).
- `@types/node` 22.20.5, a dev dependency, exact, on the ruling grade's recommendation: GR-011, `proposed`, waiting on Ghost's
  approval before anything lands on `main` (J-013). It brings `undici-types` 6.21.0.
- Playwright `~1.63.0` (locked at 1.63.0, past the cooldown), the one runtime dependency (GR-009); it brings `playwright-core`.
  No browser is downloaded here.
- `knip.json` named the five entries of the block above beside `src/cli/main.ts`: until 1.5 wired the command to them, they
  were the roots knip measured the copy from. 1.5 dropped all five (`src/cli/main.ts` reaches each through
  `src/project/review.ts`); what they alone kept alive went ("Exports dropped at 1.5").
- What the cut left unused went (`knip`, `tsc --noUnusedLocals`): the functions and constants each row names, and four whole
  files ("Traced, not copied"). An export only the parent's own tests imported lost its `export` ("Exports dropped at 1.2").
- The largest-source-file target (`docs/AGENT.md`, < 400 lines) is armed (378 before the copy), not unarmed as 1.1 wrote.
  `src/leaf/report.ts` and `src/crawl/page-step.ts` were split by a pure move (`src/leaf/report-page.ts`, re-exported by
  `report.ts`; `src/crawl/page-load.ts`); `src/crawl/state.ts` (514 lines, one class) was split by what it does on the
  ruling grade's answer (C-022, C-023; J-014): five parts of the class moved to sibling files it delegates to, its public
  surface unchanged, 390 lines left. Not a pure move: its behaviour proof is owed to 1.6's golden.

## The files

Lines are the parent's. "Loses at 1.2": what the cut points take. "Flags at 1.3": the options and flag words the file holds,
in code or comment, that 1.3 strips (every option fixed at what a bare `suite audit <site>` uses: `secondLook` on, the rest
at their defaults). A dash: nothing.

| Parent path | Ghostreach path | Lines | Loses at 1.2 | Flags at 1.3 |
| --- | --- | --- | --- | --- |
| `src/heuristics/crawl.ts` | `src/leaf/heuristics/crawl.ts` | 132 | the entries no copied file reads: `CRAWL_GZIP_OVER_BYTES`, `QUICK_MAX_PAGES`, `SCROLL_STEP`, `SECTION_HINT_SHARE`, `UNSTABLE_MAX` | --max-pages |
| `src/heuristics/grouping.ts` | `src/leaf/heuristics/grouping.ts` | 64 | the 10 entries no copied file reads (menus, groups, versions looked up) | — |
| `src/heuristics/java-suite.ts` | `src/leaf/heuristics/java-suite.ts` | 129 | all but five entries: `ADDRESS_TIMEOUT_MS`, `FAILED_HOSTS_CHECKED`, `FAILED_HOSTS_LOOKUP_MS`, `FAILED_HOSTS_TOTAL_MS`, `SHORT_FINDINGS` (the last goes at 1.3); `javaNumber` | — |
| `src/heuristics/similarity.ts` | `src/leaf/heuristics/similarity.ts` | 60 | `NEAR_COPY_SHAPE`, `NEAR_COPY_HEADINGS`, `NEAR_COPY_CHROME` (near-copies.ts not copied) | — |
| `src/heuristics/suite.ts` | `src/leaf/heuristics/suite.ts` | 229 | the 33 entries no copied file reads (the load test, guards, API document, role forms, furniture, site-wide forms and links) | — |
| `src/heuristics/types.ts` | `src/leaf/heuristics/types.ts` | 28 | — | — |
| `src/pages/ad-hosts.ts` | `src/leaf/pages/ad-hosts.ts` | 50 | `adHostLines` (generated code) | — |
| `src/pages/consent-buttons.ts` | `src/leaf/pages/consent-buttons.ts` | 27 | — | — |
| `src/pages/credential-text.ts` | `src/leaf/pages/credential-text.ts` | 61 | `withoutCredentials`, `SENTENCE_END` | — |
| `src/pages/failed-hosts.ts` | `src/leaf/pages/failed-hosts.ts` | 38 | — | — |
| `src/pages/finding-address.ts` | `src/leaf/pages/finding-address.ts` | 11 | — | — |
| `src/pages/fingerprint.ts` | `src/leaf/pages/fingerprint.ts` | 83 | `shapeSimilarity` | — |
| `src/pages/locale.ts` | `src/leaf/pages/locale.ts` | 61 | — | — |
| `src/pages/markup-key.ts` | `src/leaf/pages/markup-key.ts` | 13 | — | — |
| `src/pages/person-text.ts` | `src/leaf/pages/person-text.ts` | 39 | `holdsRemoved`, `withoutRemoved`, `REMOVED` | — |
| `src/pages/recorded.ts` | `src/leaf/pages/recorded.ts` | 97 | — | — |
| `src/pages/saved-secrets.ts` | `src/leaf/pages/saved-secrets.ts` | 107 | — | — |
| `src/pages/secret-shapes.ts` | `src/leaf/pages/secret-shapes.ts` | 191 | `findSecrets`, `findIn`, `Found`, `secretShapeSources` | — |
| `src/pages/similarity.ts` | `src/leaf/pages/similarity.ts` | 333 | `JOIN_RULES` (the grouping's reasons) | — |
| `src/pages/site-of.ts` | `src/leaf/pages/site-of.ts` | 16 | — | — |
| `src/pages/site-text.ts` | `src/leaf/pages/site-text.ts` | 59 | `SITE_TEXT_NOTE`, `PLAIN_TEXT`, `plainOrQuoted`, `outsideQuotes`, `withSiteTextNote` | — |
| `src/pages/twin-name.ts` | `src/leaf/pages/twin-name.ts` | 6 | — | — |
| `src/pages/url.ts` | `src/leaf/pages/url.ts` | 373 | `PAGE_EXTENSION`, `asRole`, `exactPattern` (`startUrlFromArg`, cut at 1.2, back at 1.5: the command calls it) | — |
| `src/pages/viewport-zoom.ts` | `src/leaf/pages/viewport-zoom.ts` | 6 | — | — |
| `src/pages/worded-headings.ts` | `src/leaf/pages/worded-headings.ts` | 16 | — | — |
| `src/crawl/report.ts` | `src/leaf/report.ts` | 777 | the types of `declared`, `labels`, `roleForms*`, `snapshot`, `apiDocument` (`RoleProbe`, `ApiDocument`, `ApiOperation`, `ApiAnswer`, `ApiField`); gains `PRODUCT_TOKEN`, and `DEFAULT_USER_AGENT` from `crawl/loop.ts` at 1.4 (J-017); its page parts moved to `report-page.ts` (next row) | --all-languages, --exclude, --include, --login, --long, --offline, --sec, --short |
| `src/crawl/report.ts` | `src/leaf/report-page.ts` | (part) | its page parts (`PageLoad` to `PageAnchor`), moved unchanged and re-exported by `report.ts`: the 400-line target | — |
| `src/crawl/abandoned.ts` | `src/crawl/abandoned.ts` | 16 | — | — |
| `src/crawl/addresses.ts` | `src/crawl/addresses.ts` | 69 | — | — |
| `src/crawl/after-crawl.ts` | `src/crawl/after-crawl.ts` | 97 | — | --offline, externalControl, secondLook (fixed on), session (`--login`) |
| `src/crawl/checklist.ts` | `src/crawl/checklist.ts` | 118 | `comparePage` (history.ts), the `before` map (a local set keeps a page queued once), `said`, `say` and the `pages` option (a recrawl's comparison) | previous (`--fresh`), session (`--login`) |
| `src/crawl/context.ts` | `src/crawl/context.ts` | 32 | — | — |
| `src/crawl/controls-script.ts` | `src/crawl/controls-script.ts` | 3 | — | — |
| `src/crawl/crawler.ts` | `src/crawl/crawler.ts` | 71 | `markedAs` (as-role.ts) and the `options.session` branch: the report is returned as read; the `DEFAULT_USER_AGENT` re-export (1.5: nothing reads it from here) | --offline, saturationPages (`--long`), session (`--login`) |
| `src/crawl/credentials-entry.ts` | `src/crawl/credentials-entry.ts` | 48 | the `labels` line | — |
| `src/crawl/deadline.ts` | `src/crawl/deadline.ts` | 80 | — | — |
| `src/crawl/destination.ts` | `src/crawl/destination.ts` | 221 | `guardedPost` (`--vulnsec`'s lists) | --offline |
| `src/crawl/discovery.ts` | `src/crawl/discovery.ts` | 145 | `budgetLines`, `sectionsUnread`, `menuUnread`, `sectionOfUrl`, `SECTIONS_SHOWN`, `LEFT_UNREAD` (the parent's crawl summary) | --exclude, --long, --max-pages |
| `src/crawl/error-line.ts` | `src/crawl/error-line.ts` | 9 | — | — |
| `src/crawl/failed-hosts.ts` | `src/crawl/failed-hosts.ts` | 51 | — | — |
| `src/crawl/frontier.ts` | `src/crawl/frontier.ts` | 272 | the `urlPattern` re-export | — |
| `src/crawl/load-watch.ts` | `src/crawl/load-watch.ts` | 263 | — | — |
| `src/crawl/loop.ts` | `src/crawl/loop.ts` | 137 | `roleSnapshots`; the run's `sec`, `onSnapshot`, `typed`, `typedNames`; `PRODUCT_TOKEN` from the leaf | --all-languages, --delay, --exclude, --include, --max-pages, --sec, --settle, --user-agent, previous (`--fresh`), session (`--login`) |
| `src/crawl/open.ts` | `src/crawl/open.ts` | 37 | — | — |
| `src/crawl/options.ts` | `src/crawl/options.ts` | 92 | `onSnapshot`, `typed`, `typedNames` (their readers are gone) | --long, --offline, --quick, --sec, --short |
| `src/crawl/page-step.ts` | `src/crawl/page-step.ts` | 461 | the `roleFormsUnfinished` marks (role-forms.ts gone); `onSnapshot`, `snapshotFiles`, `allowed`, `sec`, `typed`, `typedNames` in the run and the read context; `markCredentialsIn` from `credentials-entry.ts`; its page load moved to `page-load.ts` (next row) | --all-languages, --login, --sec, --settle, session (`--login`) |
| `src/crawl/page-step.ts` | `src/crawl/page-load.ts` | (part) | its page load (`isNoAnswer`, `triedAgain`, `loadPage`, `followRedirect`), moved unchanged: the 400-line target | — |
| `src/crawl/part-of-page.ts` | `src/crawl/part-of-page.ts` | 11 | — | — |
| `src/crawl/providers.ts` | `src/crawl/providers.ts` | 69 | — | — |
| `src/crawl/read-pages.ts` | `src/crawl/read-pages.ts` | 54 | — | stopWhen |
| `src/crawl/readers/canonical.ts` | `src/crawl/readers/canonical.ts` | 17 | — | — |
| `src/crawl/readers/consent.ts` | `src/crawl/readers/consent.ts` | 30 | — | — |
| `src/crawl/readers/controls.ts` | `src/crawl/readers/controls.ts` | 27 | `readGuardForms` and the `guards` option (guard-values.ts; `--sec` fixed off); gains `heldControl` without its guards' half, from guard-values.ts | --sec |
| `src/crawl/readers/frames.ts` | `src/crawl/readers/frames.ts` | 98 | — | — |
| `src/crawl/readers/headings.ts` | `src/crawl/readers/headings.ts` | 63 | — | — |
| `src/crawl/readers/images.ts` | `src/crawl/readers/images.ts` | 64 | — | — |
| `src/crawl/readers/index.ts` | `src/crawl/readers/index.ts` | 235 | the readers `declared`, `labels`, `role-forms`, `snapshot`, `api-document` and their imports; `apiFileFor`, `API_FILES`; `ReadContext.snapshotFiles`, `onSnapshot`, `signedIn`, `typed`, `typedNames`, `allowed`, `sec`, `readerFailed` | --sec |
| `src/crawl/readers/language.ts` | `src/crawl/readers/language.ts` | 44 | — | — |
| `src/crawl/readers/late.ts` | `src/crawl/readers/late.ts` | 39 | — | — |
| `src/crawl/readers/links.ts` | `src/crawl/readers/links.ts` | 93 | — | — |
| `src/crawl/readers/login.ts` | `src/crawl/readers/login.ts` | 37 | — | — |
| `src/crawl/readers/markup.ts` | `src/crawl/readers/markup.ts` | 19 | — | — |
| `src/crawl/readers/providers.ts` | `src/crawl/readers/providers.ts` | 27 | — | — |
| `src/crawl/readers/seen.ts` | `src/crawl/readers/seen.ts` | 124 | — | — |
| `src/crawl/readers/shape.ts` | `src/crawl/readers/shape.ts` | 7 | — | — |
| `src/crawl/readers/structure.ts` | `src/crawl/readers/structure.ts` | 15 | — | — |
| `src/crawl/reading-script.ts` | `src/crawl/reading-script.ts` | 3 | — | — |
| `src/crawl/redirects.ts` | `src/crawl/redirects.ts` | 51 | `movedOffline` | --offline |
| `src/crawl/refusals.ts` | `src/crawl/refusals.ts` | 31 | — | session (`--login`) |
| `src/crawl/relaxed-chain.ts` | `src/crawl/relaxed-chain.ts` | 98 | — | --offline |
| `src/crawl/report-held.ts` | `src/crawl/report-held.ts` | 55 | `asHeld`, `maskedOnRead`, `alsoKnownAs`, `crawlHashes`, `NAMES` (the parent's history); `crawlHash` (1.5: read by nothing once the command is the root) | — |
| `src/crawl/report-read.ts` | `src/crawl/report-read.ts` | 199 | at 1.5, once the command is knip's root and nothing reads them: `signInForms` (the sign-in form per role, `--login`), `JSON_TYPE`, `pathAt` (the parent's API documents), the `crawlHash` re-export | — |
| `src/crawl/report-scrub.ts` | `src/crawl/report-scrub.ts` | 127 | — | — |
| `src/crawl/robots-fetch.ts` | `src/crawl/robots-fetch.ts` | 102 | `PRODUCT_TOKEN`'s definition (moved to `leaf/report.ts`, imported back) | — |
| `src/crawl/robots.ts` | `src/crawl/robots.ts` | 165 | — | — |
| `src/crawl/router.ts` | `src/crawl/router.ts` | 155 | — | — |
| `src/crawl/second-look.ts` | `src/crawl/second-look.ts` | 145 | `markCredentialsIn` from `credentials-entry.ts` | --delay, --quick, --settle, --user-agent, session (`--login`) |
| `src/crawl/settle.ts` | `src/crawl/settle.ts` | 89 | — | — |
| `src/crawl/site-probe.ts` | `src/crawl/site-probe.ts` | 297 | — | --offline |
| `src/crawl/state.ts` | `src/crawl/state.ts` | 521 | `snapshotNames` and `#snapshotFiles` (no page is saved); five parts of its class moved to sibling files it delegates to, its public surface unchanged (next four rows, the fifth cut at 1.3; J-014) | --offline |
| `src/crawl/state.ts` | `src/crawl/language-folders.ts` | (part) | its other languages (`#otherLocales`, `#localeFolders`, `#folderDecided`; the language-folder methods), bodies moved, the site's language passed in: the 400-line target (C-022, J-014) | --all-languages |
| `src/crawl/state.ts` | `src/crawl/not-crawled.ts` | (part) | its addresses not crawled (`#notCrawled*`, `skip`, `leaveOver`), bodies moved, why the crawl stopped and the pages read passed in: the 400-line target | — |
| `src/crawl/state.ts` | `src/crawl/sign-ins.ts` | (part) | its sign-ins (`#loginForms`, `#providerSignIns`, `#providerStarts`, `addLoginForm`, `addProviderSignIns`), bodies moved: the 400-line target | — |
| `src/crawl/state.ts` | `src/crawl/state-report.ts` | (part) | `report()`'s assembly, the fields in the parent's order, what it read of the class passed in: the 400-line target | — |
| `src/crawl/trackers.ts` | `src/crawl/trackers.ts` | 45 | — | — |
| `src/crawl/values.ts` | `src/crawl/values.ts` | 47 | `heldValue` and its four constants (it runs in the page, bundled into `CONTROLS_SCRIPT`) | — |
| `src/group/address-key.ts` | `src/findings/address-key.ts` | 13 | — | — |
| `src/group/by-component.ts` | `src/findings/by-component.ts` | 165 | — | — |
| `src/group/check-catalogue.ts` | `src/findings/check-catalogue.ts` | 188 | — | --sec, --vulnsec |
| `src/group/finding-order.ts` | `src/findings/finding-order.ts` | 30 | — | — |
| `src/group/findings.ts` | `src/findings/findings.ts` | 256 | `defectsOf`, `brokenLinksOf` (the grouping's report) | — |
| `src/group/item-evidence.ts` | `src/findings/item-evidence.ts` | 42 | — | — |
| `src/group/link-findings.ts` | `src/findings/link-findings.ts` | 288 | — | — |
| `src/group/load-findings.ts` | `src/findings/load-findings.ts` | 201 | — | --offline |
| `src/group/markup-findings.ts` | `src/findings/markup-findings.ts` | 248 | — | — |
| `src/group/markup-items.ts` | `src/findings/markup-items.ts` | 26 | — | — |
| `src/group/on-purpose.ts` | `src/findings/on-purpose.ts` | 49 | — | — |
| `src/group/other-site-load.ts` | `src/findings/other-site-load.ts` | 98 | — | — |
| `src/group/page-findings.ts` | `src/findings/page-findings.ts` | 11 | — | — |
| `src/group/pages.ts` | `src/findings/pages.ts` | 91 | `skippedPages`, `skipReason`, `isBrokenLink` (the grouping's report) | — |
| `src/group/probe-findings.ts` | `src/findings/probe-findings.ts` | 180 | — | — |
| `src/group/query-dropped.ts` | `src/findings/query-dropped.ts` | 18 | — | — |
| `src/group/script-errors.ts` | `src/findings/script-errors.ts` | 56 | — | — |
| `src/group/softer-items.ts` | `src/findings/softer-items.ts` | 62 | — | — |
| `src/group/stale-menu.ts` | `src/findings/stale-menu.ts` | 52 | — | — |
| `src/group/title-finding.ts` | `src/findings/title-finding.ts` | 42 | — | — |
| `src/group/types.ts` | `src/findings/types.ts` | 189 | `SeenMenuLink`, `TemplateLink`, `Template`, `TemplatesReport`, `NearCopy`, `SeenControl`, `BrokenLink` (the grouping's report) | — |
| `src/project/audit-checked.ts` | `src/audit/audit-checked.ts` | 75 | — | — |
| `src/project/audit.ts` | `src/audit/audit.ts` | 286 | `auditedCrawl` (to `project/crawl.ts`); the lists (audit-lists-said.ts: `listsHtml`, `LISTS_ASKED`, `OWNER_ONLY`, `ownerOnly`, `requestedBy`, `ListsShown`, the `lists`/`listed` parameters, and the `requested` parameters they fed); the `expected` (expected-links) parameters; `PRODUCT_TOKEN` from the leaf | --fail-on, --short, --user-agent, --vulnsec, `FREE_SCAN_LIMIT` |
| `src/model/links-to-look.ts` | `src/audit/links-to-look.ts` | 71 | `lookLine`; the `expected` parameter and its branch (a suite's expected-links block); `LOOK_INTRO`'s last sentence, deleted (named below) | — |
| `src/project/page-counts.ts` | `src/audit/page-counts.ts` | 42 | `pagesReadSaid` (the parent's crawl summary) | — |
| `src/project/crawl.ts` | `src/project/crawl.ts` | 223 | all but `installBrowser`, the http:// retry, `scrubbedReport` and the write: the dock (`inCrawls`, `otherSiteCrawl`, `crawlFileName`, `placed`), logins (`crawlBehindLogins`, `credentialsFor`, `roles`), saved pages (`save`, `visibleText`, `snapshotDir`, `moveNamed`), `writeNamed` (plain `writeFileSync`; `out` is required), `TOOL_BUILD`, `typedFor` (`[]`: no account), `recentCrawl`, `discardCrawl`, the group/unread re-export; gains `auditedCrawl` | --admin-login, --login, --out, --sec |
| `src/project/text-file.ts` | `src/project/text-file.ts` | 11 | — | — |

## Ghostreach's own files

Files under `src/` that are not copies; every other file there is a row above. A new file of Ghostreach's own (the PDF,
the review's folder, the queue) adds its line here. `src/project/review.ts` (1.5, REV-06) is one review, from the site to
`<data>/<host>-<date>/`. `src/pdf/pdf.ts` (2.3, GR-006) prints its `AUDIT.html` to the PDF, US Letter.

- `src/leaf/words.ts`
- `src/cli/main.ts`
- `src/project/review.ts`
- `src/pdf/pdf.ts`

## Traced, not copied: left unused by the cut

In 1.1's closure, not copied at 1.2: once the cut points were severed, nothing copied reached them.

- `src/crawl/readers/role-path.ts`: where a signed-in page is saved; only the cut snapshot path called it.
- `src/crawl/readers/credentials.ts`: the saved page's credential marking (`savedPageWithoutCredentials`); left only a re-export
  of `markCredentialsIn`, which `page-step.ts` and `second-look.ts` now import from `credentials-entry.ts`.
- `src/group/near-copies.ts`: page types alike (G-237), read only by the grouping's report (`defectsOf`).
- `src/group/reasons.ts`: why pages are one page type, read only by the grouping's report types.

## Exports dropped at 1.2

Exported in the parent for its own tests, used only inside their file here; `knip` refuses an export nothing imports. 1.4
puts back the `export` of each name a carried test imports. 54 names. 1.4 put back 26 (J-017): `classesRan`, `joinedLookup`, `guardRequests`,
`reachOf`, `refusal`, `resolveAll`, `sectionOf`, `spreadIndex`, `thrownFrom`, `FrameFacts`, `frameRecord`, `withoutSessionIds`,
`linkAddress`, `MAX_REDIRECTS`, `relaxedAsker`, `relaxedRefusal`, `DESTINATION_PARAMS`, `deadAddresses`, `menuItemOf`,
`CREDENTIAL_MARKER`, `joinOf`, `maskedHeadings`, `pathSuffixes`, `slugWords`, `SITE_TEXT_MAX`, `isTracking`; the other 28 stay
unexported (no carried test reads them, `knip` green):

- `src/audit/audit-checked.ts`: `classesRan`
- `src/crawl/addresses.ts`: `joinedLookup`
- `src/crawl/destination.ts`: `guardRequests`, `reachOf`, `refusal`, `resolveAll`
- `src/crawl/frontier.ts`: `inMenu`, `sectionOf`, `spreadIndex`
- `src/crawl/load-watch.ts`: `thrownFrom`
- `src/crawl/loop.ts`: `reportOptions`
- `src/crawl/read-pages.ts`: `stopReasonOf`
- `src/crawl/readers/frames.ts`: `FrameFacts`, `frameRecord`
- `src/crawl/readers/links.ts`: `RawAnchor`, `withoutSessionIds`
- `src/crawl/readers/seen.ts`: `linkAddress`
- `src/crawl/redirects.ts`: `MAX_REDIRECTS`
- `src/crawl/relaxed-chain.ts`: `relaxedAsker`, `relaxedRefusal`
- `src/crawl/site-probe.ts`: `CONTROL`, `failedAs`, `readCertificate`
- `src/crawl/trackers.ts`: `DESTINATION_PARAMS`
- `src/findings/findings.ts`: `deadAddresses`, `externalSaid`
- `src/findings/link-findings.ts`: `brokenDowngrades`, `errorLinks`, `linkingTo`
- `src/findings/load-findings.ts`: `VERSION`
- `src/findings/stale-menu.ts`: `menuItemOf`
- `src/leaf/heuristics/*.ts`: `CRAWL_HEURISTICS`, `GROUPING_HEURISTICS`, `JAVA_SUITE_HEURISTICS`, `SIMILARITY_HEURISTICS`, `SUITE_HEURISTICS`
- `src/leaf/pages/credential-text.ts`: `CREDENTIAL_MARKER`, `givesCredential`
- `src/leaf/pages/person-text.ts`: `GREETING`
- `src/leaf/pages/saved-secrets.ts`: `isTokenParameter`, `maskTokenParameters`
- `src/leaf/pages/similarity.ts`: `Join`, `JoinRule`, `joinOf`, `maskedHeadings`, `pathSuffixes`, `slugWords`
- `src/leaf/pages/site-text.ts`: `SITE_TEXT_MAX`
- `src/leaf/pages/url.ts`: `INDEX_FILE`, `addressSearch`, `hashRouteOf`, `isTracking`
- `src/leaf/report.ts` (`report-page.ts`): `GuardLimits`, `LoginField`

## Exports dropped at 1.5

Exported because the five entries were knip's roots; with `src/cli/main.ts` the one root (1.5), each was read only inside its
file: `src/audit/audit.ts`: `auditHeading`, `auditReadBy`, `auditSeverities`, `auditNothing`, `auditFindings`. Read by nothing
at all, cut: the rows of `src/crawl/crawler.ts`, `report-held.ts` and `report-read.ts` name them.

## Named losses: what a prospect reads differently

- SITE-35's why (`src/findings/load-findings.ts`), when no failed host's name was looked up (each was an address given as
  numbers): "The names were not looked up (--offline, or a crawl from before the lookup), so ..." loses its parenthesis, which
  names a stripped flag (1.3, J-016). Deleted, not reworded, as `LOOK_INTRO`'s sentence was. The fixture never reaches it.

- `LOOK_INTRO` (`src/audit/links-to-look.ts`) loses its last sentence, "A link leaves this list only when the team lists it,
  with the status it answers, in the suite's expected-links block." It names a suite (GR-004) and a block Ghostreach has
  no way to fill. Deleted, not reworded (the ruling grade, J-013). It is the one allowed difference, beside the title line
  and the footer, between the parent's `AUDIT.html` for the fixture and this program's (1.6's golden, `test/support/audit-golden.ts`).

## Where the copy differs from the parent's behaviour

- `incompleteChain` (`src/crawl/relaxed-chain.ts`, G-609) at `a4c8045` anchors the error's phrase at the end of its first line.
  Node 24, the stack's runtime, adds a hint after it ("; if the root CA is installed locally, try running Node.js with
  --use-system-ca"), so under Node 24 an incomplete certificate chain was not recognised, the relaxed robots.txt read never ran
  and SITE-37 could not fire. Found by the carried `robots-chain-tls.test.ts` (1.4, J-017); the pattern allows that hint and
  nothing else. The resync (1.7) keeps it, or takes the parent's own fix if it has one.
- `CrawlSettings.userAgent` folded into the constant `DEFAULT_USER_AGENT` (now in `src/leaf/report.ts`) at 1.4: no carried test
  sets it (the ruling grade's condition on J-016's choice, J-017). The crawl, the second look and the relaxed client name the
  same agent as before.

## The flags stripped

The parent's audit and crawl options, all stripped at 1.3 (P-15, GR-003; J-016): each fixed at what a bare `suite audit <site>`
uses, the full audit, or absent. The parent's `Values` collapsed to `{ site: string }` (`src/cli/main.ts`, `parse`), which
takes the site and `--help` and refuses every other option (`test/unit/no-flags.test.ts`). Once a row says `stripped`, no file
under `src/` may name the flag, in code or comment (`test/unit/cut.test.ts`). "Fixed at" is what the review does now.

| Flag | What it set | Status | Fixed at |
| --- | --- | --- | --- |
| `--short` | the short audit, `FREE_SCAN_LIMIT`, `shortView`, `shortSaid`, `H.SHORT_FINDINGS`, `options.stopWhen` (`found-enough`) | stripped | absent: the full audit, every finding |
| `--fail-on` | `FAIL_ON`, `failsAudit`, exit 3 | stripped | absent: no exit code says a finding |
| `--md` | the Markdown audit (`audit-md.ts`, never copied); the `Say` pair of writers | stripped | absent: AUDIT.html alone |
| `--vulnsec` | the public lists and SITE-36 (never copied); the catalogue's SITE-36 row and `Check.option` | stripped | absent, not off (RF-05); `load.software` is still recorded, as the parent's bare crawl does |
| `--demo` | the parent's demo build | stripped | absent: nothing of it was copied |
| `--offline` | `options.offline`: no host but the site asked; `other-hosts.ts`, `pageHosts`, `external.offline`, the sitemap's and images' offline halves | stripped | off: other sites' links, the www twin and failed hosts asked |
| `--sec` | `options.sec`: the page's guards and forms (`GuardForm`, a control's `limits`, `pattern`, `autocomplete`, `inputMode`, `requiredAria`) | stripped | off: never read, a page's own guard keys dropped |
| `--max-pages` | `options.maxPages` | stripped | `H.MAX_PAGES` |
| `--delay` | `options.delayMs` | stripped | `H.DELAY_MS`, or robots.txt's Crawl-delay when longer |
| `--settle` | `options.settleMs` | stripped | `H.SETTLE_MS` |
| `--user-agent` | `options.userAgent`; the footer naming another one | stripped | `DEFAULT_USER_AGENT`; `AUDIT_FOOTER` always |
| `--include` | `options.include`, `inScope`, `out-of-scope` | stripped | absent: every same-site path |
| `--exclude` | `options.exclude`, `inScope`, `out-of-scope` | stripped | absent: every same-site path |
| `--all-languages` | `options.allLanguages` | stripped | off: the start page's language only |
| `--long` | no page limit, `saturationPages` 0 | stripped | the page limit and `H.SATURATION_PAGES` |
| `--quick` | `QUICK_MAX_PAGES`, `secondLook` off | stripped | the second look always on |
| `--login` | `options.session` as user; `CrawlSession`, the session in the context and the second look, `session-lost`, `signIns` | stripped | off: logged out, as a first-time visitor |
| `--admin-login` | `options.session` as admin; the admin area followed when signed in | stripped | off: no admin area followed |
| `--out` | where the report goes | stripped | the review's folder (1.5); `crawlToFile` takes `out` |
| `--fresh` | `options.previous`: a recrawl beside the last; the checklist's previous pages | stripped | absent: never a recrawl |

Kept on purpose, though only a signed-in crawl writes them: the findings' reading of a role's page (`roleOf`, `withoutRole` in
`src/findings/` and `report-scrub.ts`). They read the report's format, and `src/findings/` is the resync's surface (1.7); with no
session no page carries a role, so each is the identity. Listed under 1.3's Questions (J-016).

## Cut at 1.3

- `src/crawl/other-hosts.ts` (a part of the parent's `state.ts`, J-014): the other hosts an offline crawl's pages asked;
  nothing else wrote or read it. Its row is gone from "The files".

What else each file lost at 1.3, beside the flags' own words (`tsc --noUnusedLocals` and `knip` clean after):

- `src/crawl/options.ts`: every option but the start address and the seams a test fills (`externalControl`,
  `maxConsecutiveErrors`, `robotsRetryWaitMs`, `readDeadlineMs`, `navigationTimeoutMs`, `browser`, `log`, `lookup`, `hostLookup`,
  `resolve`); `onRobots` (only the cut login crawl read it).
- `src/crawl/loop.ts`: `CrawlSettings.include`, `exclude`, `inScope`; the scope test; the session's role and sign-in page.
- `src/crawl/checklist.ts`: the previous crawl's queue and its constructor options; it wraps the frontier alone.
- `src/crawl/read-pages.ts`: the `finish` parameter (only `stopWhen` read it).
- `src/crawl/refusals.ts`: the `out-of-scope` row and the signed-in admin exception to `sign-in`.
- `src/crawl/context.ts`: `CrawlSession` and the session's storage state.
- `src/crawl/page-step.ts`: `CrawlRun.inScope`, `allLanguages`, `role`, `signInPage`; the lost-session stop.
- `src/crawl/state.ts`: `#offline`, `offline`, `pageHosts`, `noteOtherHost`; `configure` sets the browser guard only.
- `src/crawl/redirects.ts`: the offline refusal of the start page's move (`fatal`, `movedOfflineMessage`).
- `src/crawl/destination.ts`: `stayOn`.
- `src/crawl/site-probe.ts`: the offline halves of `askImages`, `askExternal`, `probeSite`, `askSitemap`; `sitemapNamed`, `elsewhereThan`.
- `src/leaf/report.ts`: `options.include`, `exclude`, `allLanguages`, `offline`, `sec` (`maxPages` is a number, never null);
  `StopReason`'s `found-enough` and `session-lost`; `NotCrawledReason`'s `out-of-scope`; a page's `forms`; `signIns`, `asPublic`;
  the site probe's `pageHosts`, `pageHostsLeft`, `images.otherHosts`, `sitemap.notAsked`, `external.offline`.
- `src/leaf/report-page.ts`: a control's `limits`, `pattern`, `patternLong`, `autocomplete`, `inputMode`, `requiredAria`; `GuardLimits`, `GuardForm`.
- `src/leaf/pages/twin-name.ts`: `twinAskable`'s `offline` parameter. `src/leaf/pages/url.ts`: `underPath`.
- `src/leaf/heuristics/`: `SHORT_FINDINGS` (java-suite), `OTHER_HOSTS_MAX` (suite).
- `src/audit/audit.ts`: `FREE_SCAN_LIMIT`, `shortView`, `shortSaid`, `unconfirmedSaid`, `FAIL_ON`, `failsAudit`, `auditFooter`, `Say`;
  `auditReadBy`'s signed-in sentences; the `short` parameters.
- `src/audit/audit-checked.ts`: the `requested` parameters; the signed-in scope sentence.
- `src/audit/links-to-look.ts`: `counting` (only `shortView` read it). `src/findings/finding-order.ts`: `issuesIn`'s `export`.
- `src/findings/check-catalogue.ts`: SITE-36's row, `Check.option`, `ONLY.listed`; the offline half of the external-links check.
- `src/project/crawl.ts`: `CrawlLimits` and `CrawlRequest.limits`.

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

1.4 done (J-017): 54 files under `test/unit/` (501 tests with Ghostreach's own four, about 6 s); five dropped whole, one carried
as cases of `words.test.ts`, the rest re-pointed at Ghostreach's paths, trimmed where a case tested something cut. `test/unit/cut.test.ts`
holds it: each test named above is a file under `test/unit/` or has its line below. Copied beside them, each from `a4c8045`:
`test/golden/{fixture,frames,library}-site.crawl.json` (the parent's crawls of its made-up fixture sites: the catalogue's, the
audit's and the format's saved crawls), `test/data/address-reach.json` (the destination guard's vectors), and the helpers
`test/support/{audit-crawls,banned-words,made-up-keys,review-reports,secret-shapes-before-gate}.ts` and `test/unit/taint.ts`
(trimmed to `ownVoice`). Not copied: `test/unit/hostile.ts` (only the dropped cases read it), `test/support/prospect-words.ts`
(its pattern inlined), `test/unit/cypress-fixture.ts` and `test/unit/source-scan.ts` (the suite side; `ts5`). None needs a real
browser or the network: each fakes the browser or serves on 127.0.0.1 (`robots-chain-tls.test.ts` runs `openssl` for its keys and
skips without it), so all run in the `unit` project, and `integration` runs the same files; no `*.int.test.ts` was carried. The
parent's crawl specs (`test/crawl/*.spec.ts`, Playwright Test) are not 1.4's: 1.5 brings `playwright.config.ts`, its own
`test/crawl/ghostreach.spec.ts` and the fixture server, which the medium gate (`scripts/gate.sh --medium`) then runs, a
Chromium installed first.

## The parent's unit tests: dropped or trimmed at 1.4

One line each, in name order: what went and why (cut at 1.2, stripped at 1.3, or never copied).

- `after-crawl.test.ts`: trimmed: the offline halves of its five cases (`--offline`, 1.3); the online halves kept, a fake browser added, since the second look now always runs, and its settings' `userAgent` gone (a constant now, J-017).
- `audit-checked.test.ts` (in part, as the roadmap names it): every case of AUDIT.html carried; not AUDIT.md's (`auditMarkdown`, `--md`), its half of each case comparing the two files, the two signed-in scope cases (`signIns`, `--login`), nor "a check that needs an option" (`Check.option`, the `requested` parameters, SITE-36, `--vulnsec`, `--sec`; 1.3).
- `audit-items.test.ts`: trimmed: "the grouping's report keeps only the words" (`defectsOf`, the grouping's report, cut at 1.2).
- `audit.test.ts` (in part, as the roadmap names it): `auditHtml`, `AUDIT_FOOTER`, the order and the banned words carried; not the Markdown audit (`auditMarkdown`, `--md`), KNOWN-ISSUES.md (`knownIssues`), the short audit (`shortView`, `shortSaid`, `--short`), `--fail-on` (`failsAudit`), nor `savedCrawl` (the parent's command line); SITE-36 out of the security-observation list (1.3); the fixture crawl read from test/golden/ (`cypress-fixture.ts`, the suite side, not copied); three fixture goldens, not four (api-site's is the API document's, the suite side).
- `check-catalogue.test.ts`: trimmed: SITE-36's class and option (`Check.option`, `--vulnsec`, never copied), the `external.offline` and offline `twinAskable` cases (`--offline`, 1.3); `literals` (test/support/banned-words.ts) reads with a lexer, not `ts5`, checked equal to TypeScript 5's parser over every file of src/ (115 files).
- `check-rules.test.ts`: dropped whole: it reads each rule's function span with the TypeScript 5 parser (`ts5`, through the parent's scripts/kernel-scan.mjs), which Ghostreach does not have; making it without would be a function-span reader written for two catalogue fields (`rule`, `file`) only an agent reads, whose `file` still names the parent's paths (src/group/).
- `crawl-format.test.ts`: trimmed: "names every field of the report's types" and "has a line in its history" (docs/CRAWL-FORMAT.md, not copied); the older versions' reports (real sites' crawls, test/data and test/bench, never copied): it reads the three fixture goldens.
- `crawl-state.test.ts`: re-pointed: the report's options lose `include` and `exclude` (`--include`, `--exclude`, 1.3).
- `credential-marks.test.ts`: trimmed: the entry's `labels` (readers/labels, cut at 1.2) and "a saved page" (`savedPageWithoutCredentials`, readers/credentials.ts, never copied: no page is saved); `markCredentialsIn` from credentials-entry.ts.
- `credential-visit.test.ts`: trimmed: "the saved page has the marker" and "what the crawler typed to sign in" (the saved page, `readers/snapshot`, and the typed account, never copied).
- `discovery.test.ts`: trimmed: patience 0 never saturated (`--long`, cut at 1.3); "the crawl summary" (`budgetLines`, cut at 1.2; its `--exclude` and `--max-pages` hints, 1.3).
- `external-unconfirmed.test.ts`: trimmed: "never in the short audit's top" (`shortView`, `--short`, 1.3) and the `external.offline` line (`--offline`, 1.3).
- `findings-in-full.test.ts`: trimmed: "the broken links' list" (`defectsOf`, `brokenLinksOf`, the grouping's report, cut at 1.2).
- `findings.test.ts` (in part, as the roadmap names it): the `siteFindings` cases carried (SITE-01 to SITE-06, SITE-03's signed-in redirect among them: the findings' role reading is kept, J-016); not the KNOWN-ISSUES.md cases (`knownIssues`, `apiNotTested`), the site's words quoted in a bug file (`planBugs`), `tagsAsCode` (the suite side), nor SITE-01's `defectsOf` line (the grouping's report, cut at 1.2).
- `fingerprint.test.ts`: trimmed: `shapeSimilarity` cases (cut at 1.2).
- `hubspot-tracking.test.ts`: re-pointed: "a check that did not run" reads an unreachable probe in place of an offline one (`--offline`, 1.3).
- `load-other-site.test.ts`: trimmed: the short audit's top line (`shortView`, `--short`, 1.3); the order kept.
- `menu-before-stop.test.ts`: re-pointed: `Checklist` takes the frontier alone (its recrawl options, `--fresh`, 1.3).
- `near-copies.test.ts`: dropped whole: its subject, src/group/near-copies.ts, was not copied ("Traced, not copied").
- `offline-crawl.test.ts`: trimmed to its case that holds without `--offline` (another host's request let go, nothing recorded); the offline case (`pageHosts`, `options.offline`) dropped (1.3).
- `offline-probes.test.ts`: trimmed to its four cases that hold without `--offline` (images asked whatever their host; a Sitemap: line asked, the site's own on either scheme; with none, /sitemap.xml); its eight offline cases (`otherHosts`, `sitemap.notAsked`, the hostile Sitemap line kept as its address, an image on the site's host on another scheme) dropped (1.3).
- `person-text.test.ts`: dropped whole: compares the saved page's greeting rule (readers/snapshot-person.ts, never copied) with the report's.
- `reasons-wording.test.ts`: dropped whole: its subject, src/group/reasons.ts, was not copied ("Traced, not copied").
- `robots-chain-tls.test.ts`: carried whole; it failed under Node 24, whose TLS error adds a hint after the phrase `incompleteChain` anchors on, so the relaxed robots.txt read (G-609, SITE-37) never ran: the parent's pattern at a4c8045, fixed in src/crawl/relaxed-chain.ts (the hint allowed, nothing else), a case each way added to robots-chain.test.ts.
- `router.test.ts`: trimmed: another host's request noted offline (`pageHosts`, `--offline`, 1.3).
- `run-readers.test.ts`: trimmed: `ReadContext.readerFailed` and its case "tells the context nothing" (read only by the role questions, cut at 1.2).
- `secret-shapes-differential.test.ts`: trimmed: every comparison of findings (`findSecrets`, cut at 1.2) and "read by that shape alone"; the masked text still held to the frozen scanner on every case, the oversize path's taking read from the frozen copy.
- `sections-unread.test.ts`: dropped whole: every case reads `budgetLines`, the parent's crawl summary (cut at 1.2).
- `similarity.test.ts`: trimmed: the signed-in role mark's lines (`asRole`, cut at 1.2).
- `site-text.test.ts`: trimmed: `withSiteTextNote` (cut at 1.2, with `SITE_TEXT_NOTE`).
- `suite-words.test.ts` (in part, as the roadmap names it): its subject carried as cases of `words.test.ts` over AUDIT.html, the three fixture goldens rendered, read with the parent's own list (prospect-words.ts's pattern, inlined: the helper is not copied) and "scan"; not its suite documents, journeys, KNOWN-ISSUES.md, bug files or menus (the suite side).
- `unread-reasons.test.ts`: trimmed: "a menu page left unread is said in the summary" (`budgetLines`, cut at 1.2).

## The fixture 1.5 needs

The parent's fixture site, copied as a test helper: `test/fixture-site/server.ts` (191 lines; `startFixtureSite`, the made-up
"Fixture Dex", every request logged) and its six pages, `test/fixture-site/pages/{home,list,pokemon,type,about,not-found}.html`
(126 lines), to the same paths here, unchanged (1.5); with the parent's `playwright.config.ts`, its runner imported from
`playwright/test` (no `@playwright/test`), and `test/crawl/ghostreach.spec.ts`, which the medium gate runs. The parent's findings
for the fixture are `test/golden/fixture-site.findings.json`, written by the parent's own code at `a4c8045` (its `siteFindings`
over its own `fixture-site.crawl.json`), never this program's: `scripts/parent-findings.mjs` (its header has the two commands);
the spec holds this program's `findings.json`, the fixture's port made `http://fixture.test`, to it byte for byte. Not `serve.ts` (`npm run serve:fixture`), which also starts the sign-in site
(`login.ts`, `identity.ts`): a review reads the public site.

## The audit golden (1.6)

The parent's `AUDIT.html` for its fixture crawl is `test/golden/fixture-site.AUDIT.html`, written by the parent's own code at
`a4c8045` (its `auditHtml` with a bare audit's defaults, over its own `fixture-site.crawl.json`, dated 2026-11-14) through
`scripts/parent-findings.mjs <dir> audit`, from an archive in a scratch folder, never in its tree; the parent's archive carries no
`node_modules`, so the script's hook resolves a package (the audit's imports reach `playwright`) to this repository's copy.
`UPDATE_GOLDEN=1 npx vitest run --project unit test/unit/audit-golden.test.ts` records it again that way (the parent at
`../suite-builder`, or `SUITE_BUILDER`). The allowed differences are named once, in `test/support/audit-golden.ts` (`ALLOWED`): the
title line, the footer, and `LOOK_INTRO`'s last sentence (the named loss above; SITE-35's parenthesis the fixture never reaches).
Two tests hold the page to it: `test/unit/audit-golden.test.ts` over the parent's crawl, and `test/crawl/ghostreach.spec.ts` over a
live crawl of the fixture by `ghostreach <site>`, normalised as the parent normalises its fixture crawl (the origin, port included,
written `http://fixture.test` in the crawl; the page rendered from it on the golden day). The page is not normalised: the audit asks
the host's shape (SITE-31 is not asked of an address in numbers), so `127.0.0.1` replaced in the page would differ. The live crawl
file differs from the parent's golden crawl only in fields a cut or the bare defaults explain (each page's `roleForms`, cut at 1.2;
`options.include` and `options.exclude`, stripped at 1.3; `options.delayMs` 1000 and each page's `settled` and `late`, the bare
audit's pace, settle and second look where the parent's crawl spec ran with none); every other field, and the order of every key,
is the parent's (a structural diff, J-019).

## The test side, in one place

What 1.4 to 1.6 copied from the pin outside `src/`, each said in full in its item's section above (tune-up pass 1, after the
debriefs of 1.4 and 1.7): the carried `test/unit/*.test.ts` (1.4's list) and `test/unit/taint.ts`; `test/support/{audit-crawls,
banned-words,made-up-keys,review-reports,secret-shapes-before-gate}.ts`; `test/golden/{fixture,frames,library}-site.crawl.json`
(the parent's `portable` crawls, origin rewritten: compare a crawl, never a page, 1.6); `test/data/address-reach.json`;
`test/fixture-site/server.ts` and `test/fixture-site/pages/*.html`; `playwright.config.ts`. Written by the parent's code, not
copied: `test/golden/fixture-site.findings.json` and `test/golden/fixture-site.AUDIT.html` (`scripts/parent-findings.mjs`).
Ghostreach's own: `test/unit/{cut,no-flags,main,audit-golden,pdf}.test.ts`, `test/unit/words.test.ts` (under a parent's name: the
resync block's `own`), `test/support/{audit-golden,pin,pdf-text,pdf-syntax}.ts` and `test/crawl/ghostreach.spec.ts`.

## The resync recipe

A later parent commit comes in only by this recipe (GR-002; TODO 1.7, 5.5), mechanically. `scripts/resync_moves.py` lists
the moves for a range and changes nothing (a dry run); `test/test_resync_moves.py` holds it:

    git clone --filter=blob:none <parent's address> <scratch>/sb-head      # never the parent's own checkout
    python3 -I scripts/resync_moves.py <scratch>/sb-head <pin> <target>    # --list names every file skipped

Over the parent's diff from the pin to the target, each changed file is one move, by its parent path:

1. `skip`: not copied (the suite side, a cut point, outside the closure, or outside `src/` and the carried tests).
2. `apply`: a 1:1 copy (its row loses nothing and strips no flag), or a carried test copied whole: the parent's patch at the
   Ghostreach path, its imports rewritten for the folder (`.js`).
3. `trimmed`: a copy that lost something at 1.2 to 1.4: each hunk said to apply to the local file, to be imports only, or to
   touch code the cut removed (read by hand: the row's losses and flags stay lost).
4. `split`: a `(part)` row: the local file each hunk lands in, the one holding most of its lines.
5. `whole`: a copy git reads as binary (the bundled `reading-script.ts`): the parent's file at the target.
6. `new` and `gone`: the target's closure (`scripts/cut_closure.py`, the block above) reaches a file not copied, which is copied
   with a row unless it is the suite side; or no longer reaches a listed one, which goes with its rows.
7. `flag`: an option the parent added that a crawl or the audit reads (`shapesCrawl`, or an audit option, in its
   `src/cli/parse.ts`), or a `--word` on a copied file's new line: fixed at its bare default, a row in the flags table (P-15).
   `strip`: a new line naming a stripped flag, applied without it.

Then, for any move or none: the pin bumped in this file's `Parent commit:` line, the one place it is written (`test/support/pin.ts`
reads it for `test/unit/cut.test.ts` and `test/unit/audit-golden.test.ts`; `scripts/parent-findings.mjs` says `<pin>`); GR-002's
text names the pin and is Ghost's, so its change is listed as owed, never made, and `test/unit/cut.test.ts`, which holds this
file's pin to GR-002's, stays red until Ghost makes it;
1.5 and 1.6 rerun, three runs: `scripts/parent-findings.mjs` from the new pin's archive (the findings, and `audit` for the page),
or `UPDATE_GOLDEN=1 npx vitest run --project unit test/unit/audit-golden.test.ts` for the page (it archives the parent at `PIN`),
each golden re-recorded only from the parent's code; then the unit project and `npx playwright test`. A sentence `ALLOWED`
(`test/support/audit-golden.ts`) quotes, changed by the parent, is changed there by hand. `incompleteChain`'s Node 24 hint ("Where the copy differs") is kept
unless the parent's patch fixes it its own way.

```resync
own test/unit/words.test.ts
into test/unit/suite-words.test.ts test/unit/words.test.ts
```

The block: `own` is Ghostreach's own file under a parent file's name (skipped), `into` a parent file carried as cases of another.

The dry run (1.7, J-020), the parent's HEAD `e7dd523` (2026-11-14), four commits past the pin, none touching `src/`:

    resync a4c8045..e7dd523: 5 files changed in the parent
    trimmed test/unit/audit.test.ts: trimmed at 1.4 (its line in CUT.md); each hunk to the cases kept
        hunk 1: applies to test/unit/audit.test.ts (2 lines found)
    skip 0 files of src/ not copied (suite side, cut, or outside the closure)
    skip 4 files outside src/ and the carried tests
    moves 1

The one move: the banned-words case's `ruleFiles` finds a finding's source file under Stryker's instrumentation too; carried, it reads
`src/findings/`. The rest is the parent's mutation ledger.

A rehearsal (not a resync: the copy already holds its target), the 100 parent commits up to the pin from `681a783`, the last
range to change copied files (G-778 to G-780, in-page anchors):

    resync 681a783..a4c8045: 410 files changed in the parent
    trimmed src/crawl/readers/index.ts -> src/crawl/readers/index.ts: each hunk to what the copy kept; its row's losses and flags kept
        hunk 1: imports: the parent's change, its paths rewritten for src/crawl/readers/index.ts (.js)
        hunk 2: imports: the parent's change, its paths rewritten for src/crawl/readers/index.ts (.js)
        hunk 3: applies to src/crawl/readers/index.ts (7 lines found)
    apply src/crawl/readers/links.ts -> src/crawl/readers/links.ts: the parent's patch, 1:1
    whole src/crawl/reading-script.ts: the parent's file at a4c8045 to src/crawl/reading-script.ts
    split src/crawl/report.ts -> src/leaf/report.ts, src/leaf/report-page.ts
        hunk 1: lands in src/leaf/report.ts (4 lines found)
        hunk 2: lands in src/leaf/report-page.ts (18 lines found)
    skip 114 files of src/ not copied (suite side, cut, or outside the closure)
    skip 292 files outside src/ and the carried tests
    moves 4

Each read against the copy by hand: the anchors reader's hunk is in `readers/index.ts`, `anchorsOf` in `readers/links.ts`, the
bundle in `reading-script.ts` (its sources `anchors-page.ts` and `links-page.ts` are outside the closure, bundled), and
`PageAnchor` in `report-page.ts` with the page's `anchors` field in `report.ts`'s half; no flag, no new file.

## The rulings on 1.1's questions

1.1's four questions were answered by the ruling grade under Ghost's delegation (J-008); recorded in J-013, and Ghost may
reverse any of them.

1. `src/model/links-to-look.ts` is carried, re-homed to `src/audit/links-to-look.ts`, `LOOK_INTRO`'s last sentence deleted
   ("Named losses"). Carrying a file of the parent's `src/model/` against GR-004's letter (MOD-05) stays flagged for Ghost
   in `docs/HANDOFF.md`.
2. The leaf takes the report's types and the page-address helpers, each pure (no Playwright or runtime import in the leaf);
   a helper that needs one stays in `crawl`. `docs/modules.json` is unchanged.
3. `@types/node` comes in on the session branch as a `proposed` decision (GR-011), Ghost's approval asked before `main`.
4. `readers/declared` and `readers/labels` are cut, with their report fields (`declared`, `labels`).
