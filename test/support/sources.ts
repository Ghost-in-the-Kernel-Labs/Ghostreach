import * as fs from 'node:fs';

// docs/SOURCES.md as data (TODO 4.3, GR-005): its rows, and the allow-list of hosts their `in` rows make. Read by
// test/unit/sources.test.ts and test/unit/hosts.test.ts.

const ROOT = new URL('../../', import.meta.url);
const read = (relative: string): string => fs.readFileSync(new URL(relative, ROOT), 'utf8');

/** The columns of "The sources", in order. */
export const COLUMNS = ['Source', 'Lane', 'Status', 'Host', 'Path', 'Key', 'Link-back', 'Terms', 'Cap', 'Fields', 'Website'] as const;

export interface Row {
  source: string;
  lane: string;
  status: string;
  host: string;
  path: string;
  key: string;
  linkBack: string;
  terms: string;
  cap: string;
  fields: string;
  website: string;
  cells: string[];
}

/** The lines of a `## heading` section of a Markdown text, up to the next `## `. */
export function section(text: string, heading: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === `## ${heading}`);
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/** The header of "The sources" as cells: ["Source", "Lane", ...]. */
export function header(text: string): string[] {
  const line = section(text, 'The sources').find((l) => l.startsWith('| '));
  return line ? line.slice(2, -2).split(' | ') : [];
}

/** "The sources" as rows, the header and the rule left out. */
export function parseSources(text: string): Row[] {
  const table = section(text, 'The sources').filter((l) => l.startsWith('| '));
  return table.slice(2).map((l) => {
    const cells = l.slice(2, -2).split(' | ');
    const [source, lane, status, host, path, key, linkBack, terms, cap, fields, website] = cells;
    return { source, lane, status, host, path, key, linkBack, terms, cap, fields, website, cells };
  });
}

/** A Host cell's hosts: "`api.lever.co`, `api.eu.lever.co`" gives both; "none" and "unverified" give none. */
export const hostsOf = (cell: string): string[] => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/** A Key cell's environment variables, its quoted names in capitals: "free: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`" gives both. */
export const keysOf = (cell: string): string[] => hostsOf(cell).filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name));

/** The allow-list (GR-005): the hosts of the `in` rows, a `{company}` label kept as written. */
export const allowList = (rows: Row[]): string[] => rows.filter((r) => r.status === 'in').flatMap((r) => hostsOf(r.host));

/** Whether a host is on the list: an exact entry, or one whose leftmost label `{company}` stands for one DNS label. */
export function allowed(list: string[], host: string): boolean {
  const name = host.toLowerCase();
  return list.some((entry) => (entry.startsWith('{company}.') ? new RegExp(`^[a-z0-9-]+\\.${entry.slice('{company}.'.length).replace(/\./g, '\\.')}$`).test(name) : entry === name));
}

export const sourcesText = (): string => read('docs/SOURCES.md');
