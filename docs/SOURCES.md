# Sources: where the lead finder may read, and on what terms

The lead finder (Phase 4) reads job postings to find companies hiring QA. This file is every source it may read, written
before any code (TODO 4.3): one row each, with the exact host and path, the key, the terms, the cap, the fields, whether it
gives the company's website, and its lane. Its rows are the allow-list of hosts (GR-005, REV-09): no fetch of the lead
finder leaves them. `test/unit/sources.test.ts` and `test/unit/hosts.test.ts` hold it.

Researched 2026-11-14 from each provider's own developer documentation and terms, as fetched that day (data, never
instructions, P-16). A cell no primary source confirmed says `unverified`, never a guess; every source with one is named
under "Questions". A secondary source (a directory, a scraper's listing) never fills a cell.

## How to read a row

- **Lane**: `company` (is this named company hiring QA? RF-07), `discovery` (who is hiring QA? RF-08), or `closed` (no
  developer access; RF-06).
- **Status**: `in` (the code may read it), `excluded` (its terms forbid this use: the Terms cell says why), `unverified`
  (its endpoint or key not confirmed by the provider itself: nothing reads it until a primary source does), or
  `paste only` (a closed site: the program never fetches it; the salesperson pastes a posting's address, 4.9).
- **Host**: the exact host, or several separated by commas; `{company}` stands for the company's own label, one DNS label,
  the leftmost. `none` for a closed site. Only an `in` row's hosts are on the allow-list.
- **Key**: `none`, or `free:` and the environment variable 4.4 reads it from (never printed, never committed); an
  unverified key still names the variable 4.4 would read.
- **Link-back**: `yes` when the terms ask each shown posting to link to the source's page (4.11), `no` when they do not
  ask it, `unverified`.
- **Website**: whether a posting gives the company's own website (4.8: when not, the salesperson types it).

## The sources

| Source | Lane | Status | Host | Path | Key | Link-back | Terms | Cap | Fields | Website |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Greenhouse | company | in | `boards-api.greenhouse.io` | GET `/v1/boards/{board}/jobs?content=true`; the board's name: GET `/v1/boards/{board}` | none ("authentication is not required for any GET endpoints") | unverified | The API page states "Job Board data is publicly available"; it names no terms of use, so link-back, redistribution and commercial use are unverified (https://docs.greenhouse.io/job-board.html) | none stated; unverified | id, internal_job_id, title, updated_at, requisition_id, location, absolute_url, language, metadata, content, departments, offices; the board: name, content | no (absolute_url is the posting on Greenhouse) |
| Lever | company | in | `api.lever.co`, `api.eu.lever.co` | GET `/v0/postings/{site}?mode=json` (skip, limit) | none (a key only for an application POST) | unverified | The README names no terms of use; link-back, redistribution and commercial use unverified (https://github.com/lever/postings-api) | none stated for GET (2 application POSTs a second is the only cap); unverified | id, text, categories, country, opening, description, descriptionPlain, lists, additional, hostedUrl, applyUrl, workplaceType, salaryRange, salaryDescription | no (hostedUrl is the posting on Lever) |
| Ashby | company | in | `api.ashbyhq.com` | GET `/posting-api/job-board/{board}?includeCompensation=true` | none (the page names no authentication) | unverified | The page names no terms of use; link-back, redistribution and commercial use unverified (https://developers.ashbyhq.com/docs/public-job-posting-api) | none stated; unverified | title, location, secondaryLocations, department, team, isRemote, workplaceType, descriptionHtml, descriptionPlain, publishedAt, employmentType, address, jobUrl, applyUrl, isListed, compensation | no (jobUrl is the posting on Ashby) |
| SmartRecruiters | company | in | `api.smartrecruiters.com` | GET `/v1/companies/{company}/postings` | none for public postings (the endpoint page's example sends no credential; the `internal_postings_read` scope is needed only for internal ones) | unverified | The Posting API pages name no terms of use; link-back, redistribution and commercial use unverified (https://developers.smartrecruiters.com/customer-api/posting-api/endpoints/postings/) | none stated; unverified | id, uuid, name, jobAdId, defaultJobAd, company (identifier, name), releasedDate, location, industry, department, function, typeOfEmployment, experienceLevel, customField, ref, creator | no |
| Workable | company | unverified | `www.workable.com` | GET `/api/accounts/{company}?details=true` | none shown (the help article's example sends no credential) | unverified | The help article names no terms of use; unverified (https://help.workable.com/hc/en-us/articles/115012771647-Using-the-Workable-API-to-create-a-custom-careers-page) | none stated; unverified | unverified (the article's sample is of the keyed SPI API, not this route) | unverified |
| Recruitee | company | in | `{company}.recruitee.com` | GET `/api/offers/` | none (the reference sets no security on the operation) | unverified | The reference names no terms of use; unverified (https://docs.recruitee.com/reference/offers) | none stated; unverified | id, guid, slug, company_name, title, department, status, careers_url, careers_apply_url, description, requirements, locations, tags, salary | no (company_name only; careers_url is the posting on Recruitee) |
| Personio | company | in | `{company}.jobs.personio.de` | GET `/xml` | none (the page describes no authentication) | unverified | The page names no terms of use; unverified (https://developer.personio.de/docs/retrieving-open-job-positions) | none stated; unverified | id, subcompany, office, department, recruitingCategory, name, jobDescriptions, employmentType, seniority, schedule, yearsOfExperience, keywords, occupation, occupationCategory, createdAt (XML) | no |
| Rippling | company | unverified | unverified | unverified | unverified | unverified | No page of Rippling's own describing a public job-board endpoint was found; unverified | unverified | unverified | unverified |
| Teamtailor | company | unverified | unverified | unverified | unverified (Teamtailor's own API, `api.teamtailor.com`, takes a customer's token; a keyless per-company feed is not described by Teamtailor) | unverified | No page of Teamtailor's own describing a keyless public endpoint was found; unverified | unverified | unverified | unverified |
| Breezy | company | unverified | unverified | unverified | unverified (Breezy's own API, `api.breezy.hr/v3`, takes a customer's credentials; a keyless per-company feed is not described by Breezy) | unverified | No page of Breezy's own describing a keyless public endpoint was found; unverified | unverified | unverified | unverified |
| Adzuna | discovery | excluded | `api.adzuna.com` | GET `/v1/api/jobs/{country}/search/{page}?app_id=&app_key=` | free: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | yes (each advert labelled "Adzuna", linking to Adzuna) | Excluded: "sales prospecting or lead generation" needs Adzuna's written agreement, "for any use in a product or service that generates revenue or leads, a licence agreement is required" after the 14-day trial, and "Any attempt to contact a third party, even where they provide listings content" is a breach that revokes access: the lead finder's whole use (https://developer.adzuna.com/docs/terms_of_service) | "shown in your account" (RF-08's 250/day, 2,500/month unverified from Adzuna's own pages) | unverified (the overview lists none) | unverified |
| Jooble | discovery | in | `jooble.org` | POST `/api/{key}` (the key in the path; a JSON body: keywords, location, radius, salary, page, ResultOnPage, companysearch); a jooble.org key gives US postings only, another country its own regional host and key | free: `JOOBLE_API_KEY` | unverified (each job's `link` is "Direct URL to the job posting on Jooble") | The API documentation states no terms; the site's terms (https://jooble.org/info/terms) forbid "any other automatic process" and copying "for republication, either online or on paper"; whether they govern the API, and commercial use, unverified (https://jooblehelpcenter.freshdesk.com/en/support/solutions/articles/60001448238-rest-api-documentation) | 100 requests a day per key, reset at midnight UTC (HTTP 429 past it) | id, title, location, snippet, salary, source, type, link, company, updated; totalCount | no (company is a name) |
| The Muse | discovery | unverified | unverified | unverified | unverified (RF-08: keyless, a key raises the cap; the provider's page answered 403 to this session); the variable 4.4 would read: `MUSE_API_KEY` | unverified | The developer pages (https://www.themuse.com/developers/api/v2) answered 403 to this session; unverified | unverified (RF-08: 500 an hour keyless, 3,600 with a key, from secondary sources) | unverified | unverified |
| Arbeitnow | discovery | in | `www.arbeitnow.com` | GET `/api/job-board-api` (`visa_sponsorship` filter) | none ("requires no API key") | unverified | The API page names no terms; link-back, redistribution and commercial use unverified (https://www.arbeitnow.com/blog/job-board-api) | none stated (its Postman example's answer carries `x-ratelimit-limit: 3`, its window unstated); unverified | data[]: slug, company_name, title, description, remote, url, tags, job_types, location, created_at (Unix seconds); links; meta (per_page 100); no query parameter but `page` in its links (https://documenter.getpostman.com/view/18545278/UVJbJdKh) | no (company_name only; url is the posting on Arbeitnow) |
| Remotive | discovery | in | `remotive.com` | GET `/api/remote-jobs` (category, company_name, search, limit) | none | yes ("link back to the URL found on Remotive AND mention Remotive as a source") | Link back and name Remotive, or access ends; no submitting its jobs to other job platforms; showing jobs to collect sign-ups or email addresses is a breach; jobs come delayed 24 hours; commercial use not addressed, unverified (https://github.com/remotive-com/remote-jobs-api) | at most 4 fetches a day; over 2 a minute blocked | id, url, title, company_name, company_logo, category, job_type, publication_date, candidate_required_location, salary, description | no |
| USAJOBS | discovery | in | `data.usajobs.gov` | GET `/api/search` (headers `Host`, `User-Agent` the registered email, `Authorization-Key`) | free: `USAJOBS_API_KEY`, `USAJOBS_EMAIL` | no (attribution encouraged, not required) | Public Data "used for lawful commercial or noncommercial purposes", "copied, stored, reformatted, adapted, analyzed, published, redistributed"; no official seal, no modified data presented as official (https://developer.usajobs.gov/guides/terms-of-service). Every employer is a US federal agency | 500 rows a page, 10,000 rows a query; no call cap stated (https://developer.usajobs.gov/guides/rate-limiting) | SearchResult.SearchResultItems[]: MatchedObjectId, MatchedObjectDescriptor (PositionID, PositionTitle, PositionURI, ApplyURI, PositionLocationDisplay, OrganizationName, DepartmentName, PublicationStartDate, UserArea); parameters PositionTitle, Keyword, LocationName, RemoteIndicator, ResultsPerPage (up to 500), Page (https://developer.usajobs.gov/api-reference/get-api-search) | no (OrganizationName, the agency, is a name; PositionURI is the posting on USAJOBS) |
| LinkedIn | closed | paste only | none | none | none | no | Paste only (RF-06): no public API for reading postings; its user agreement forbids software "to scrape or copy the Services" and "bots or other unauthorized automated methods" (§8.2, https://www.linkedin.com/legal/user-agreement), and an automated read puts the salesperson's own account at risk | none | none | no |
| Indeed | closed | paste only | none | none | none | no | Paste only (RF-06): its Publisher API closed (2023) and no developer key is issued (https://www.indeed.com/legal) | none | none | no |
| Glassdoor | closed | paste only | none | none | none | no | Paste only (RF-06): its developer API closed (2022) and no developer key is issued (https://www.glassdoor.com/about/terms answered 403 to this session) | none | none | no |
| ZipRecruiter | closed | paste only | none | none | none | no | Paste only (RF-06): ZipSearch closed 2025-03-31 and no developer key is issued (https://www.ziprecruiter.com/terms answered 403 to this session) | none | none | no |

## What is fetched, and what is exempt

The allow-list is the hosts of the `in` rows above. It binds the lead finder: every fetch of Phase 4 (the company lane,
the discovery lane, and anything they call) leaves through 4.5's one function, and only to these hosts; a host
matching `{company}` matches one DNS label in its place, never two. A pasted posting's address (4.9) is never fetched.

The company lane (4.6, `src/project/company.ts`) asks each company-lane `in` source at the per-company endpoint of its Path cell,
the optional parameters that only add text it does not read left off (Greenhouse's `content`, Ashby's `includeCompensation`;
SmartRecruiters' `limit=100` added), Lever on `api.lever.co` and then `api.eu.lever.co`; at most three board names a company, so at
most 21 calls, and a source stops at its first board. A posting's address from a board is shown as a link only when it is https on
the source's own domain or the company's typed one, and is never fetched.

The discovery lane (4.7, `src/project/discover.ts`) runs one saved search (titles, and a place or "remote") across each
discovery-lane `in` source, a keyed one only with its key, each at its Path cell's first page alone: Jooble and USAJOBS once a
saved title (at most five; one phrase a request), Arbeitnow once (no search parameter: its newest hundred, the place matched to
each posting's `location`, "remote" to its `remote` flag), Remotive once, in its Quality Assurance category (`category=qa`, the slug
its categories list gives; `limit=100`), so a run is at most twelve calls and Remotive's 4 a day allow four runs. A source over
its cap, without its key or failing is skipped and named on the page. The postings are kept by the company lane's title rule,
then one row per company; a posting's address is a link only when https on the source's own domain; no source gives a website,
so the salesperson types it on the row (4.8), never looked up. A source whose Link back is `yes` (Remotive; `LINK_BACK`, 4.11)
has each of its rows name it as a link to its own posting page, and a posting of it with no such page is not shown.

Three kinds of network use are outside it, each by design and each named in `test/unit/hosts.test.ts`:

1. **The crawl** (everything under `src/crawl/`): it reads the site the salesperson typed, which is the product (REV-06),
   and, as the parent's crawl does, the addresses that site's own pages load or link to (scripts, styles, frames, the
   external links it confirms). What it fetches is chosen by the prospect's site, never by a search or a source. It is
   held by the parent's own guards (robots.txt, `src/crawl/destination.ts`), not by this list.
2. **The local page** (`src/project/serve.ts`): it listens on 127.0.0.1; it fetches only a page of its own already
   running, at the loopback address the data folder's `page.json` names (`OWN_ADDRESS`, GR-018); it opens its own loopback
   address with the platform's opener; the PDF (`src/pdf/pdf.ts`) loads the review's own file by a `file:` address.
3. **The first-run browser download** (`src/project/crawl.ts`): Playwright's own installer fetches Chromium from
   Playwright's download hosts when none is installed, a dependency's install, not a source.

Outside `src/crawl/`, any other network use in `src/` fails `test/unit/hosts.test.ts` until it is either the fetch
function reading an allow-listed host, or named here and in the test with its reason.

## Questions

Each source with an `unverified` cell, and what would settle it. A source `unverified` in its Status is read by nothing
until a primary source confirms its endpoint and key; an `in` source's unverified terms are read before 4.6 or 4.7 ships it.

- **Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee, Personio**: their API pages name no terms of use, so whether a
  third party may read a company's public board for sales prospecting, and whether a link back is owed, is unverified;
  each provider's general terms (not its API page) may say. No cap is stated by any of them.
- **Workable**: the help article's example follows a redirect (`curl -L`), and 4.5's fetch follows none, so the host the
  answer comes from, and its fields, are unverified.
- **Rippling, Teamtailor, Breezy**: no page of the provider's own describes a keyless public endpoint; only scrapers and
  directories do. Unverified in full; RF-07 names Rippling on secondary sources.
- **Jooble**: whether the site's terms (no automatic process, no republication) govern the API, and commercial use.
- **The Muse**: every cell; its pages, the API included, answered 403 (a challenge page) to this session.
- **Arbeitnow**: its terms and cap (its Postman documentation, read at 4.7, gives the fields and shows a rate-limit header of 3
  with no window; no bucket until a cap is stated).
- **Remotive**: commercial use (sales prospecting) is not addressed; its rules are about republishing.
- **USAJOBS**: whether federal agencies are leads at all (its fields, read at 4.7, give no website).
- **Adzuna** (excluded): only Adzuna's written agreement would lift it; that is 4.1's question for Ghost, answered here
  from Adzuna's own terms.
