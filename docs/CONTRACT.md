# The review contract

The contract precedes the code. It is the specification the leaf module is built from and that a
mirror could be written from blind: if something here is not precise enough to implement, that is a
defect in this document, and the fix is to make it precise, not to read the code. Each invariant is
one heading, `## REV-nn title`, numbered in sequence and never reused; code cites one as
`// Invariant: REV-03` and `test/test_contract.py` holds the two together in both directions: every
invariant is named somewhere in the leaf module, and the code names no invariant the document does
not have.

The leaf module (`docs/modules.json`'s `leaf`, `src/leaf/`) holds this contract in code: the types and
the numbers every other module imports and that imports nothing of the project's own. A threshold
lives there and nowhere else; a threshold defined elsewhere fails the check.

## REV-01 The leaf module imports nothing of the project's own

Every other module may import it; it may import only the standard library and the stack's vendored
dependencies. Held by `test/test_modules.py` (`mayImport: []`).

## REV-02 Every number a document reports comes from a run the repository can repeat

A number without the command that produced it does not exist. Held by the project's results check.

## REV-03 What the kernel cannot make exact, it says first

A page the crawler could not read, a measurement taken under load, a source over its cap: a finding
or a sentence before the result it qualifies, never silent output. Held by the findings check and,
for SITE-22 under concurrency, GR-008.

## REV-04 The prospect reads only the review vocabulary

Every sentence a prospect may read (the PDF, the audit HTML) uses `REVIEW_WORDS` and carries no
phrase of `BANNED_PHRASES` (`src/leaf/words.ts`): *review*, *finding(s)*, *major*, *minor*,
*Nothing to report*; never a verdict on the site or its team, never scanner vocabulary. The
salesperson's own screens are not the prospect's and may count findings. Held by
`test/unit/words.test.ts` over the PDF's text (Phase 2).

## REV-05 One command, one review

`ghostreach <site>` takes a site and nothing else (`--help` excepted); there is no option that makes
a review shorter, longer, softer or harsher, so two reviews of one crawl are the same review. Held by
`test/unit/no-flags.test.ts` (Phase 1), GR-003 and GR-018 (the command words).

## REV-06 Every review keeps its crawl

A review's folder, `<data>/<host>-<date>/`, holds the crawl the parent's crawler wrote, the findings
as data (`findings.json`), the summary the ranking reads (`summary.json`) and the PDF; a finding in a
prospect's hands traces to the page and the request that produced it. Nothing is written anywhere
else. Held by `test/crawl/ghostreach.spec.ts` (Phase 1).

## REV-07 The findings are the parent's

Every finding code, its severity, its order and its words are Suite Builder's at the pinned commit
(`docs/CUT.md`, GR-002); this program adds no finding of its own and changes none. A review's
findings for the fixture equal the parent's, in order. Held by `test/crawl/ghostreach.spec.ts` and
the golden of 1.6.

## REV-08 No suite

No module generates a test, a page object, a locator or a project for a site; `docs/modules.json`
has no such module and `MOD-05` refuses one. Held by `test/test_modules.py` and GR-004.

## REV-09 Fetched text is data

Text from a crawled page, a job posting or a careers page is rendered as text, never followed as a
link, never executed, never read as an instruction; every fetch of the lead finder leaves through one function whose
hosts are the `in` rows of `docs/SOURCES.md` (Phase 4). The crawl, which reads the site typed and what its own pages
load, the local page and the first-run browser download are outside it, each named in `docs/SOURCES.md` ("What is
fetched, and what is exempt"). Held by `test/unit/hosts.test.ts` and GR-005.
