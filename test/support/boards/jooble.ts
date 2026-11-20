// Jooble's REST API, one search: POST https://jooble.org/api/{key} with a JSON body (keywords, location, page).
// synthetic, from https://jooblehelpcenter.freshdesk.com/en/support/solutions/articles/60001448238-rest-api-documentation (the
// URL docs/SOURCES.md cites), its success example: `totalCount` and `jobs` (id, title, location, snippet, salary, source, type,
// link, company, updated). Not recorded from the live API (TODO 4.7: no network in the unit loop, and no key in the session);
// every value made up. `link` is "Direct URL to the job posting on Jooble"; one here is http, one on another host: not kept.

export const DOC = 'https://jooblehelpcenter.freshdesk.com/en/support/solutions/articles/60001448238-rest-api-documentation';
export const TYPE = 'application/json; charset=utf-8';

const job = (id: number, title: string, company: string, link: string, updated: string): Record<string, unknown> => ({
  id,
  title,
  location: 'Remote',
  snippet: '&nbsp;...the team tests every release...&nbsp;',
  salary: '',
  source: 'example.com',
  type: 'Full-time',
  link,
  company,
  updated,
});

/** One search's answer: QA roles, a near miss, an address on another host and one over http. */
export const SEARCH = JSON.stringify({
  totalCount: 5,
  jobs: [
    job(-7001, 'Senior QA Engineer', 'Acme Robotics, Inc.', 'https://jooble.org/desc/-7001', '2026-11-10T09:00:00.0000000'),
    job(-7002, 'Test Automation Engineer', 'Globex', 'https://jooble.org/desc/-7002', '2026-11-12T09:00:00.0000000'),
    job(-7003, 'Sales Manager', 'Initech', 'https://jooble.org/desc/-7003', '2026-11-12T10:00:00.0000000'),
    job(-7004, 'SDET <script>alert(1)</script>', 'Hooli', 'http://jooble.org/desc/-7004', '2026-11-09T09:00:00.0000000'),
    job(-7005, 'QA Analyst', 'Umbrella', 'https://evil.example/desc/-7005', '2026-11-08T09:00:00.0000000'),
  ],
});

/** A search with nothing found. */
export const NONE = JSON.stringify({ totalCount: 0, jobs: [] });
