// Greenhouse's job board, one company's open jobs: GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs.
// synthetic, from https://developers.greenhouse.io/job-board.html (served from docs.greenhouse.io/job-board.html, the URL
// docs/SOURCES.md cites), its "List Jobs" example: `jobs` (id, internal_job_id, title, updated_at, requisition_id, location.name,
// absolute_url, language, metadata) and `meta.total`. Not recorded from a live board (TODO 4.6: no network in the unit loop, and
// none reached from the session that wrote it); every value made up. `absolute_url` is a Greenhouse page, or the company's own
// careers page (the doc's `http://your.co/careers?gh_jid=...`), so both shapes appear here, with addresses the lane must not keep.

export const DOC = 'https://developers.greenhouse.io/job-board.html';
export const TYPE = 'application/json; charset=utf-8';

const job = (id: number, title: string, absolute_url: string): Record<string, unknown> => ({
  id,
  internal_job_id: id + 1000,
  title,
  updated_at: '2026-11-02T10:55:28-05:00',
  requisition_id: String(id % 100),
  location: { name: 'NYC' },
  absolute_url,
  language: 'en',
  metadata: null,
});

/** A board with QA roles, near misses, and addresses kept and not. */
export const BOARD = JSON.stringify({
  jobs: [
    job(4001001, 'Senior QA Engineer', 'https://boards.greenhouse.io/acmerobotics/jobs/4001001'),
    job(4001002, 'Software Engineer in Test', 'https://www.acme-robotics.com/careers?gh_jid=4001002'),
    job(4001003, 'QA Lead', 'http://www.acme-robotics.com/careers?gh_jid=4001003'),
    job(4001004, 'Test Automation Engineer <img src=x onerror=alert(1)>', 'https://evil.example/careers?gh_jid=4001004'),
    job(4001005, 'Test Kitchen Chef', 'https://boards.greenhouse.io/acmerobotics/jobs/4001005'),
    job(4001006, 'Contest Manager', 'https://boards.greenhouse.io/acmerobotics/jobs/4001006'),
    job(4001007, 'Product Engineer', 'https://boards.greenhouse.io/acmerobotics/jobs/4001007'),
  ],
  meta: { total: 7 },
});

/** A board with open jobs and none of them QA. */
export const NO_QA = JSON.stringify({ jobs: [job(4002001, 'Mobile Engineer - iOS', 'https://boards.greenhouse.io/acmerobotics/jobs/4002001')], meta: { total: 1 } });
