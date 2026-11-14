/**
 * Whether the site's other name (www or not) is asked for (G-202, G-204, G-333): of a domain name only, never an address or
 * localhost. ONE condition, read by the probe that asks (site-probe.ts) and by the audit's catalogue, which says
 * whether the check ran (src/group/check-catalogue.ts); in src/pages/ because the group layer may read the crawl only through its report (SRC-08), and that folder is what every layer knows.
 */
export const twinAskable = (host: string): boolean => /[a-z]/i.test(host) && host.includes('.') && !/^\d+(\.\d+){3}$/.test(host);
