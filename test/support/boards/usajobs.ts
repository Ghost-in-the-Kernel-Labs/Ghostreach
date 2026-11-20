// USAJOBS' search: GET https://data.usajobs.gov/api/search?PositionTitle=...&ResultsPerPage=100, the key as Authorization-Key and
// the registered email as User-Agent. synthetic, from https://developer.usajobs.gov/api-reference/get-api-search (its parameters
// PositionTitle, LocationName, RemoteIndicator, ResultsPerPage up to 500, and its response: SearchResult.SearchResultCount,
// SearchResultCountAll, SearchResultItems[] of MatchedObjectId and MatchedObjectDescriptor: PositionID, PositionTitle, PositionURI,
// ApplyURI, PositionLocationDisplay, OrganizationName, DepartmentName, PublicationStartDate). Not recorded from the live API
// (TODO 4.7: no network in the unit loop, and no key in the session); every value made up.

export const DOC = 'https://developer.usajobs.gov/api-reference/get-api-search';
export const TYPE = 'application/json; charset=utf-8';

const item = (id: number, PositionTitle: string, OrganizationName: string, PublicationStartDate: string): Record<string, unknown> => ({
  MatchedObjectId: String(id),
  MatchedObjectDescriptor: {
    PositionID: `MADE-UP-${id}`,
    PositionTitle,
    // The port as USAJOBS writes it: https's own, so the address is kept.
    PositionURI: `https://www.usajobs.gov:443/job/${id}`,
    ApplyURI: [`https://www.usajobs.gov:443/job/${id}/apply`],
    PositionLocationDisplay: 'Anywhere in the U.S. (remote job)',
    OrganizationName,
    DepartmentName: 'Department of Made Up Things',
    PublicationStartDate,
  },
});

/** One title's search. */
export const SEARCH = JSON.stringify({
  LanguageCode: 'EN',
  SearchParameters: {},
  SearchResult: {
    SearchResultCount: 2,
    SearchResultCountAll: 2,
    SearchResultItems: [
      item(800001, 'IT Specialist (Test Automation)', 'Made Up Systems Agency', '2026-11-11T00:00:00.0000'),
      item(800002, 'Supply Technician', 'Made Up Logistics Agency', '2026-11-11T00:00:00.0000'),
    ],
    UserArea: { NumberOfPages: '1', IsRadialSearch: false },
  },
});
