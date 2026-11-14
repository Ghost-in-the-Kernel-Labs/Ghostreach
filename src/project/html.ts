/**
 * Any value written into the local page, as text or inside an attribute: every character markup could read escaped (P-16). The
 * one helper every value goes through, a number or a state the program wrote as much as a name from outside, since a data file
 * may hold anything (J-045).
 */
export const esc = (value: unknown): string => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
