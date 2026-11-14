// Arbeitnow's job board API, its first page: GET https://www.arbeitnow.com/api/job-board-api.
// synthetic, from https://documenter.getpostman.com/view/18545278/UVJbJdKh (the Postman documentation
// https://www.arbeitnow.com/blog/job-board-api links to), its saved response: `data` (slug, company_name, title, description,
// remote, url, tags, job_types, location, created_at, a Unix time in seconds), `links` and `meta` (per_page 100). Not recorded from
// the live API (TODO 4.7: no network in the unit loop); every value made up.

export const DOC = 'https://documenter.getpostman.com/view/18545278/UVJbJdKh';
export const TYPE = 'application/json';

const job = (slug: string, company_name: string, title: string, remote: boolean, location: string, created_at: number): Record<string, unknown> => ({
  slug,
  company_name,
  title,
  description: '<p>Made up.</p>',
  remote,
  url: `https://arbeitnow.com/view/${slug}`,
  tags: ['Software Development'],
  job_types: ['full time'],
  location,
  created_at,
});

/** The first page: a remote QA role, one in Berlin, and one not QA. */
export const PAGE = JSON.stringify({
  data: [
    // 2026-11-13T10:00:00Z: newer than Jooble's posting for the same company, written another way.
    job('qa-engineer-mwd-acme-robotics-1001', 'ACME Robotics', 'QA Engineer (m/w/d)', true, 'Berlin', 1794564000),
    job('manual-tester-berlin-testing-1002', 'Berlin Testing GmbH', 'Manual Tester', false, 'Berlin', 1794560400),
    job('stagiaire-audit-1003', 'Audit Partners', 'Stagiaire Audit des systèmes', true, 'Lille', 1794556800),
  ],
  links: { first: 'https://arbeitnow.com/api/job-board-api?page=1', last: null, prev: null, next: 'https://arbeitnow.com/api/job-board-api?page=2' },
  meta: { current_page: 1, from: 1, path: 'https://arbeitnow.com/api/job-board-api', per_page: 100, to: 3, terms: 'Made up.', info: 'Made up.' },
});
