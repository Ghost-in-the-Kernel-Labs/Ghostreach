// Ashby's public job posting API, one job board: GET https://api.ashbyhq.com/posting-api/job-board/{board}.
// synthetic, from https://developers.ashbyhq.com/docs/public-job-posting-api (its example response and field table: apiVersion,
// jobs[] with title, location, department, team, isListed, isRemote, workplaceType, publishedAt, employmentType, jobUrl,
// applyUrl; the descriptions, addresses and compensation left out, the lane does not read them). Not recorded from a live
// board; every value made up. `isListed` false: "this listing should only be available via direct link", so not listed.

export const DOC = 'https://developers.ashbyhq.com/docs/public-job-posting-api';
export const TYPE = 'application/json; charset=utf-8';

const job = (title: string, slug: string, isListed: boolean): Record<string, unknown> => ({
  title,
  location: 'Houston, TX',
  department: 'Engineering',
  team: 'Quality',
  isListed,
  isRemote: true,
  workplaceType: 'Remote',
  publishedAt: '2026-11-01T16:21:55.393+00:00',
  employmentType: 'FullTime',
  jobUrl: `https://jobs.ashbyhq.com/acmerobotics/${slug}`,
  applyUrl: `https://jobs.ashbyhq.com/acmerobotics/${slug}/application`,
});

/** A board with a listed QA role, an unlisted one, and a near miss. */
export const BOARD = JSON.stringify({
  apiVersion: '1',
  jobs: [
    job('QA Automation Engineer', 'qa-automation-engineer', true),
    job('Manual Tester', 'manual-tester', false),
    job('Latest Products Lead', 'latest-products-lead', true),
  ],
});
