// SmartRecruiters' Posting API, one company's active postings: GET https://api.smartrecruiters.com/v1/companies/{company}/postings.
// synthetic, from https://developers.smartrecruiters.com/customer-api/posting-api/endpoints/postings/ (its example response: limit,
// offset, totalFound, content[] with id, uuid, name, jobAdId, defaultJobAd, company {identifier, name}, releasedDate, location,
// ref; the other objects left out, the lane does not read them). Not recorded from a live company; every value made up but
// "test job", the example's own posting name, kept as a near miss. `ref` is the posting's API address: the lane does not link it.

export const DOC = 'https://developers.smartrecruiters.com/customer-api/posting-api/endpoints/postings/';
export const TYPE = 'application/json; charset=utf-8';

const posting = (id: string, name: string): Record<string, unknown> => ({
  id,
  uuid: `34225731-e7cf-4584-b0b7-${id.padStart(12, '0')}`,
  name,
  jobAdId: `106f35bc-a0e6-4e55-96f9-${id.padStart(12, '0')}`,
  defaultJobAd: true,
  company: { identifier: 'acmerobotics', name: 'Acme Robotics' },
  releasedDate: '2026-11-03T15:28:46.493Z',
  location: { country: 'US', region: 'FL', city: 'Orlando', remote: false },
  ref: `https://api.smartrecruiters.com/v1/companies/acmerobotics/postings/${id}`,
});

/** A company with a QA role and the doc's own "test job". */
export const BOARD = JSON.stringify({
  limit: 100,
  offset: 0,
  totalFound: 2,
  content: [posting('744000001', 'Quality Assurance Specialist'), posting('744000002', 'test job')],
});

/** What a company with no active posting answers: the same list, empty. */
export const EMPTY = JSON.stringify({ limit: 100, offset: 0, totalFound: 0, content: [] });
