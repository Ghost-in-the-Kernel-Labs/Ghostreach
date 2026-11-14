// Recruitee's careers site API, one company's published offers: GET https://{company}.recruitee.com/api/offers/.
// synthetic, from https://docs.recruitee.com/reference/offers (its "Result" example: offers[] with company_name, title, id, guid,
// slug, department, status, careers_url, careers_apply_url; the rest left out, the lane does not read it). Not recorded from a
// live company; every value made up.

export const DOC = 'https://docs.recruitee.com/reference/offers';
export const TYPE = 'application/json; charset=utf-8';

const offer = (id: number, title: string, slug: string): Record<string, unknown> => ({
  company_name: 'Acme Robotics',
  title,
  id,
  guid: `g${id}`,
  slug,
  department: 'Engineering',
  status: 'published',
  careers_url: `https://acmerobotics.recruitee.com/o/${slug}`,
  careers_apply_url: `https://acmerobotics.recruitee.com/o/${slug}/c/new`,
});

/** A company with a test role and a near miss. */
export const BOARD = JSON.stringify({
  offers: [offer(1853589, 'Performance Test Engineer', 'performance-test-engineer'), offer(1853590, 'Protest Coordinator', 'protest-coordinator')],
});
