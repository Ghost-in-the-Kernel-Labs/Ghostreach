// An address's key and item for the audit (G-749): split out of markup-findings.ts, which every finding module imported for it alone.
import { openPath, roleOf, withoutRole } from '../leaf/pages/url.js';
import type { ItemEvidence } from './item-evidence.js';

/** An item's key for an address of the site (G-749): its path and query, signed in as a role said first; any other address whole. */
export const keyOf = (url: string, origin: string) => {
  const role = roleOf(url);
  const open = withoutRole(url);
  return new URL(open).origin === origin ? `${role === null ? '' : `as ${role} `}${openPath(open)}` : open;
};

/** The item of one address asked (G-749): keyed, as asked without its role, and what it answered first. */
export const addressItem = (url: string, origin: string, status: number | null): ItemEvidence => ({ at: 'address', key: keyOf(url, origin), url: withoutRole(url), status });
