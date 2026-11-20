/**
 * Any value written into the local page, as text or inside an attribute: every character markup could read escaped (P-16). The
 * one helper every value goes through, a number or a state the program wrote as much as a name from outside, since a data file
 * may hold anything (J-045).
 */
export const esc = (value: unknown): string => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** What a raw network code means, said plainly (launch fixes 4). */
const PLAIN_CODES: readonly [RegExp, string][] = [
  [/ENOTFOUND|EAI_AGAIN|getaddrinfo|NAME_NOT_RESOLVED/, 'no site has that name'],
  [/ECONNREFUSED|CONNECTION_REFUSED/, 'nothing answered at that address'],
  [/ETIMEDOUT|TIMED_OUT/, 'it did not answer in time'],
  [/ECONNRESET|CONNECTION_RESET|CONNECTION_CLOSED/, 'the connection was cut'],
  [/CERT|SSL|TLS/, 'its security certificate was not accepted'],
];
/** A raw code, or what carries one (`net::ERR_...`, `getaddrinfo`): never shown. */
const RAW_CODE = /\b(?:net::)?ERR_[A-Z_]+\b|\bE[A-Z]{4,}\b|\bgetaddrinfo\b/;

/**
 * A failure's line as the salesperson reads it (launch fixes 4): the sentence kept, a part in brackets that carries a raw code
 * (`ECONNREFUSED`, `getaddrinfo ENOTFOUND`, `net::ERR_...`) said plainly or dropped, and any raw code left outside brackets cut
 * off with what follows it.
 */
export function plainError(line: string): string {
  const plain = (raw: string): string => PLAIN_CODES.find(([code]) => code.test(raw))?.[1] ?? '';
  const bracketed = line.replace(/ ?\(([^()]*)\)/g, (whole, inner: string) => {
    if (!RAW_CODE.test(inner)) return whole;
    const said = plain(inner);
    return said ? ` (${said})` : '';
  });
  const at = bracketed.search(RAW_CODE);
  if (at < 0) return bracketed;
  const said = plain(bracketed.slice(at));
  return `${bracketed.slice(0, at).replace(/[\s:,;-]+$/, '')}${said ? `: ${said}` : ''}.`;
}
