/**
 * The thresholds of one layer of the pipeline: grouping (src/group/group.ts, src/crawl/frontier.ts). Each with its value, where it is used and
 * the test that pins it; the catalog (catalog.ts) joins the six layers for HEURISTICS.md and its test, and a
 * layer's code imports only its own `H` from here (F3, TODO item 54).
 */
import { valuesOf, type Heuristic } from './types.js';

const GROUPING_HEURISTICS = {
  MENU_SHARE: {
    value: 0.8, unit: 'share of pages', kind: 'tool', where: 'src/crawl/frontier.ts',
    pinnedBy: 'test/unit/menu-placement.test.ts',
  },
  MENU_MIN_PAGES: {
    value: 3, unit: 'pages', kind: 'tool', where: 'src/crawl/frontier.ts',
    pinnedBy: 'test/unit/menu-placement.test.ts',
  },
  LINK_TEXT_MAX: {
    value: 80, unit: 'characters', kind: 'tool', where: 'src/crawl/readers/links.ts',
    pinnedBy: 'test/crawl/crawler.spec.ts',
  },
} as const satisfies Record<string, Heuristic>;

/** The values, by name: H.MENU_SHARE. */
export const H = valuesOf(GROUPING_HEURISTICS);
