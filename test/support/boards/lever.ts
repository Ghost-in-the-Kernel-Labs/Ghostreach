// Lever's postings, one site's list in JSON mode: GET https://api.lever.co/v0/postings/{site}?mode=json (the EU instance at
// api.eu.lever.co). synthetic, from https://github.com/lever/postings-api (README, "Get a list of job postings": a jobs list, each
// posting an object with id, text, categories {location, commitment, team, department, allLocations}, country, hostedUrl,
// applyUrl, workplaceType; the description fields left out, the lane does not read them). Not recorded from a live site; every
// value made up. The README shows no example body: the list is an array of those objects, as its "Jobs list as raw JSON" says.

export const DOC = 'https://github.com/lever/postings-api';
export const TYPE = 'application/json; charset=utf-8';

const posting = (id: string, text: string, team: string): Record<string, unknown> => ({
  id,
  text,
  categories: { location: 'Berlin', commitment: 'Full-time', team, department: 'Engineering', allLocations: ['Berlin'] },
  country: 'DE',
  hostedUrl: `https://jobs.eu.lever.co/acmerobotics/${id}`,
  applyUrl: `https://jobs.eu.lever.co/acmerobotics/${id}/apply`,
  workplaceType: 'hybrid',
});

/** A site with an SDET role and a near miss. */
export const BOARD = JSON.stringify([
  posting('5ac21346-8e0c-4494-8e7a-3eb92ff70001', 'SDET II', 'Quality'),
  posting('5ac21346-8e0c-4494-8e7a-3eb92ff70002', 'Attestation Analyst', 'Finance'),
]);
