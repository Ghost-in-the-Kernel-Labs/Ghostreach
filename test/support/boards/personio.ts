// Personio's open positions feed, one account: GET https://{company}.jobs.personio.de/xml.
// synthetic, from https://developer.personio.de/docs/retrieving-open-job-positions (its example response: <workzag-jobs>, each
// <position> with id, office, department, recruitingCategory, name, jobDescriptions (each a name and a CDATA value),
// employmentType, seniority, schedule, yearsOfExperience, keywords, occupation, occupationCategory, createdAt). Not recorded from a
// live account; every value made up. The feed gives no posting address: the lane lists the titles without a link. A description
// block's own <name> ("Test lead duties") must not be read as a position's title.

export const DOC = 'https://developer.personio.de/docs/retrieving-open-job-positions';
export const TYPE = 'text/xml; charset=utf-8';

const position = (id: number, name: string): string => `	<position>
		<id>${id}</id>
		<office>Munich</office>
		<department>Engineering</department>
		<recruitingCategory>Various</recruitingCategory>
		<name>${name}</name>
		<jobDescriptions>
			<jobDescription>
				<name>Test lead duties</name>
				<value>
					<![CDATA[
					<ul><li>Plan the release</li></ul>
					]]>
				</value>
			</jobDescription>
		</jobDescriptions>
		<employmentType>permanent</employmentType>
		<seniority>experienced</seniority>
		<schedule>full-time</schedule>
		<yearsOfExperience>2-5</yearsOfExperience>
		<keywords>
			engineering
		</keywords>
		<occupation>software_development</occupation>
		<occupationCategory>it_and_telecommunications</occupationCategory>
		<createdAt>2026-10-31T12:14:07+0100</createdAt>
	</position>
`;

/** An account with a QA role (its name escaped as XML writes it) and a near miss. */
export const BOARD = `<?xml version="1.0" encoding="UTF-8"?>
<workzag-jobs>
${position(4103, 'QA &amp; Release Engineer (m/w/d)')}${position(4104, 'Office- und Feelgood Manager (m/w)')}</workzag-jobs>
`;
