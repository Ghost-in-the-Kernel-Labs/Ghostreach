# Workpath: the code (where a file goes, the lead finder, the local page, a fixture, the kernel contract)

Read this when your task changes code under `src/` or a TypeScript test. Rows: a task, the files to open first and nothing
else yet, the contract to read, the tests to run before and after. A new row goes here, never in `CLAUDE.md`.

| Task | Start here | Contract | Tests |
| --- | --- | --- | --- |
| The kernel contract: invariants, the leaf module, entry points, a new module (a proposal for Ghost) | `docs/CONTRACT.md`, `docs/modules.json` | C-012 | `test/test_contract.py`, `test/test_modules.py` |
| A new file under `src/` or `test/` of Ghostreach's own, not a copy of the parent's | `docs/CUT.md` (its sections "Ghostreach's own files" and "The test side, in one place"), `docs/modules.json` | C-012 | `test/unit/cut.test.ts` (it refuses a file under `src/` that neither list names) |
| The lead finder: a source, a lane, the one fetch, a key | `docs/SOURCES.md`, `src/project/fetch.ts`, the lane's file (`src/project/company.ts` or `src/project/discover.ts`) | GR-005, REV-09; its files (the three, `src/project/keys.ts` and `src/project/leads.ts`) sit in `src/project/` until Ghost rules on a `leads` module (HANDOFF's For Ghost I) | `test/unit/sources.test.ts`, `test/unit/hosts.test.ts`, and the lane's own test |
| The local page: a route, a form, its guards (`Host`, `Origin`), its escaping | `src/project/serve.ts`, `src/project/page.ts`, `src/project/page-leads.ts` | P-16 (`docs/ROADMAP.md` §2) | `test/unit/serve.test.ts`, `test/unit/serve-faults.test.ts` (hostile or broken data, J-045); a test that needs the real Chromium runs only in the integration project (`REAL_BROWSER`, `vitest.config.ts`) |
| A TypeScript test's fixture or helper | `test/support/` (the TypeScript tests' own); `test/fixtures/` is the Python checks' planted breaks alone, outside the TypeScript project (`tsconfig.json`'s `exclude`) | | the test that reads it |
