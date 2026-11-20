// Remotive's remote jobs, its Quality Assurance category: GET https://remotive.com/api/remote-jobs?category=qa&limit=100.
// synthetic, from https://github.com/remotive-com/remote-jobs-api (the README docs/SOURCES.md cites), its example response:
// `0-legal-notice`, `job-count` and `jobs` (id, url, title, company_name, company_logo, category, job_type, publication_date,
// candidate_required_location, salary, description); the category's slug `qa` ("Quality Assurance") from the categories list
// the README points to. Not recorded from the live API (TODO 4.7: no network in the unit loop); every value made up.

export const DOC = 'https://github.com/remotive-com/remote-jobs-api';
export const TYPE = 'application/json';

const job = (id: number, title: string, company_name: string, publication_date: string): Record<string, unknown> => ({
  id,
  url: `https://remotive.com/remote-jobs/qa/made-up-${id}`,
  title,
  company_name,
  company_logo: `https://remotive.com/job/${id}/logo`,
  category: 'QA',
  job_type: 'full_time',
  publication_date,
  candidate_required_location: 'Worldwide',
  salary: '',
  description: '<p>Made up.</p>',
});

/** The category's postings: Globex again (newer, as "Globex Corporation"), and Hooli again (older). */
export const JOBS = JSON.stringify({
  '0-legal-notice': 'Remotive API Legal Notice',
  'job-count': 2,
  jobs: [job(9001, 'QA Lead', 'Globex Corporation', '2026-11-13T08:00:00'), job(9002, 'Quality Assurance Specialist', 'Hooli', '2026-11-01T08:00:00')],
});
