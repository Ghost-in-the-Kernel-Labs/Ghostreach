/**
 * robots.txt parsing and matching, following RFC 9309 (the Robots Exclusion Protocol):
 *
 * - Rules come in groups, each introduced by one or more `User-agent:` lines.
 * - The crawler obeys the group whose user-agent token matches its product token
 *   (case-insensitive); if none match, the `*` group; if there is no `*` group, everything is allowed.
 *   Several groups naming the same agent are merged.
 * - Within the group, the rule with the longest matching path wins. On a tie, Allow wins.
 * - `*` matches any run of characters and `$` at the end anchors the match to the end of the path.
 * - An empty `Disallow:` allows everything.
 *
 * `Crawl-delay` is not in the RFC, but many sites use it; the crawler honors it when it is longer
 * than its own delay.
 */
import { H } from '../leaf/heuristics/suite.js';

interface RobotsRule {
  allow: boolean;
  path: string;
}

export interface RobotsPolicy {
  /** How the file was obtained, for the report. */
  source: 'parsed' | 'none' | 'unreachable';
  rules: RobotsRule[];
  crawlDelaySeconds: number | null;
  /** Its Sitemap lines (any group, or none: they belong to the file), for the audit's look at the sitemap (G-202). */
  sitemaps?: string[];
}

export const ALLOW_ALL: RobotsPolicy = { source: 'none', rules: [], crawlDelaySeconds: null };
/** RFC 9309 section 2.3.1.4: if robots.txt is unreachable (a server error), assume everything is disallowed. */
export const DISALLOW_ALL: RobotsPolicy = {
  source: 'unreachable',
  rules: [{ allow: false, path: '/' }],
  crawlDelaySeconds: null,
};

interface Group {
  agents: string[];
  rules: RobotsRule[];
  crawlDelay: number | null;
}

/**
 * Parse robots.txt and return the rules that apply to the crawler: every group naming one of `productTokens` (e.g.
 * "forecursor"), or, when none does, the `*` group.
 */
export function parseRobots(text: string, productTokens: string | readonly string[]): RobotsPolicy {
  const groups: Group[] = [];
  let current: Group | null = null;
  // A user-agent line right after another user-agent line joins the same group.
  let lastWasAgent = false;
  const sitemaps: string[] = [];

  // A byte-order mark is no part of the first line's key (Fable's review, B9: it hid the first group's rules).
  // Only its first ROBOTS_MAX_CHARS: RFC 9309's 500 KiB, past which a file is a mistake or an attack (Fable's review, C3).
  for (const rawLine of text.slice(0, H.ROBOTS_MAX_CHARS).replace(/^\uFEFF/, '').split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === 'sitemap') {
      if (/^https?:\/\//i.test(value)) sitemaps.push(value);
      continue;
    }
    if (!current) continue; // rules before any user-agent line belong to no group

    if (key === 'allow' || key === 'disallow') {
      // "Disallow:" with no path means "nothing is disallowed", so it adds no rule.
      if (value) current.rules.push({ allow: key === 'allow', path: value });
    } else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }

  const tokens = (typeof productTokens === 'string' ? [productTokens] : productTokens).map((t) => t.toLowerCase());
  let chosen = groups.filter((g) => g.agents.some((agent) => tokens.includes(agent)));
  if (chosen.length === 0) chosen = groups.filter((g) => g.agents.includes('*'));

  const delays = chosen.map((g) => g.crawlDelay).filter((d): d is number => d !== null);
  return {
    source: 'parsed',
    rules: chosen.flatMap((g) => g.rules),
    crawlDelaySeconds: delays.length ? Math.max(...delays) : null,
    ...(sitemaps.length ? { sitemaps } : {}),
  };
}

/** Turn a robots.txt path pattern into a regular expression anchored at the start. */
/**
 * Whether a robots.txt pattern (`*` any run of characters, a final `$` the end) matches a path from its
 * start. A plain wildcard match, never a regular expression: a site's `Disallow: /*a*a*a*...b` made one
 * backtrack for minutes (Fable's review of 2026-10-11, B9); this one keeps the last star and moves on, so
 * it takes at most the pattern's length times the path's.
 */
function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  let p = 0;
  let t = 0;
  let star = -1;
  let from = 0;
  while (t < path.length) {
    if (p < body.length && body[p] === '*') {
      star = p++;
      from = t;
    } else if (p < body.length && body[p] === path[t]) {
      p++;
      t++;
    } else if (p === body.length && !anchored) {
      return true; // the pattern matched a start of the path
    } else if (star >= 0) {
      p = star + 1;
      t = ++from;
    } else {
      return false;
    }
  }
  while (p < body.length && body[p] === '*') p++;
  return p === body.length;
}

/**
 * Percent-encoding is compared in a normal form, so /caf%C3%A9 and /café match each other.
 * Characters that fail to decode are left as they are.
 */
function normalizePath(p: string): string {
  try {
    return encodeURI(decodeURI(p));
  } catch {
    return p;
  }
}

/** True when `path` (path plus query string) may be crawled under `policy`. */
// Decision: G-021
export function isAllowed(policy: RobotsPolicy, path: string): boolean {
  if (path === '/robots.txt') return true; // always allowed, per the RFC
  const target = normalizePath(path);
  let best: RobotsRule | null = null;
  let bestLength = -1;
  for (const rule of policy.rules) {
    if (!patternMatches(normalizePath(rule.path), target)) continue;
    const length = rule.path.length;
    if (length > bestLength || (length === bestLength && rule.allow && !best!.allow)) {
      best = rule;
      bestLength = length;
    }
  }
  return best ? best.allow : true;
}
