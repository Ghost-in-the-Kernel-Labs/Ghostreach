/**
 * The thresholds of one layer of the pipeline: crawling: how the crawler waits, how far it goes and when it stops. Each with its value, where it is used and
 * the test that pins it; the catalog (catalog.ts) joins the six layers for HEURISTICS.md and its test, and a
 * layer's code imports only its own `H` from here (F3, TODO item 54).
 */
import { valuesOf, type Heuristic } from './types.js';

const CRAWL_HEURISTICS = {
  MAX_PAGES: {
    value: 300, unit: 'pages', kind: 'tool', where: 'src/crawl/loop.ts',
    pinnedBy: 'test/crawl/crawler.spec.ts',
  },
  SATURATION_PAGES: {
    value: 30, unit: 'pages', kind: 'tool', where: 'src/crawl/crawler.ts',
    pinnedBy: 'test/unit/discovery.test.ts',
  },
  SECOND_LOOK_MAX_PAGES: {
    value: 60, unit: 'pages', kind: 'tool', where: 'src/crawl/second-look.ts',
    pinnedBy: 'test/crawl/second-look.spec.ts',
  },
  LATE_LOOK_MS: {
    value: 2000, unit: 'ms', kind: 'tool', where: 'src/crawl/readers/late.ts',
    pinnedBy: 'test/crawl/late.spec.ts',
  },
  DELAY_MS: {
    value: 1000, unit: 'ms', kind: 'tool', where: 'src/crawl/loop.ts',
    pinnedBy: 'test/crawl/crawl-politeness.spec.ts',
  },
  NAVIGATION_TIMEOUT_MS: {
    value: 30_000, unit: 'ms', kind: 'tool', where: 'src/crawl/loop.ts',
    pinnedBy: 'test/crawl/crawl-responses.spec.ts',
  },
  LOAD_WAIT_MS: {
    value: 5000, unit: 'ms', kind: 'tool', where: 'src/crawl/open.ts',
    pinnedBy: 'test/crawl/load-watch.spec.ts',
  },
  MAX_CONSECUTIVE_ERRORS: {
    value: 3, unit: 'pages', kind: 'tool', where: 'src/crawl/loop.ts',
    pinnedBy: 'test/crawl/crawl-politeness.spec.ts',
  },
  MAX_REDIRECTS: {
    value: 10, unit: 'hops', kind: 'tool', where: 'src/crawl/redirects.ts',
    pinnedBy: 'test/crawl/crawl-responses.spec.ts',
  },
  SETTLE_MS: {
    value: 3000, unit: 'ms', kind: 'tool', where: 'src/crawl/loop.ts',
    pinnedBy: 'test/crawl/hydration.spec.ts',
  },
  READ_DEADLINE_MS: {
    value: 120_000, unit: 'ms', kind: 'tool', where: 'src/crawl/loop.ts',
    pinnedBy: 'test/crawl/hostile-crawl.spec.ts',
  },
  DOM_QUIET_MS: {
    value: 500, unit: 'ms', kind: 'tool', where: 'src/crawl/settle.ts',
    pinnedBy: 'test/crawl/hydration.spec.ts',
  },
  SCROLL_MAX_SCREENS: {
    value: 15, unit: 'screens', kind: 'tool', where: 'src/crawl/settle.ts',
    pinnedBy: 'test/crawl/hydration.spec.ts',
  },
  FRAME_DEPTH: {
    value: 3, unit: 'frames', kind: 'tool', where: 'src/crawl/readers/frames.ts',
    pinnedBy: 'test/crawl/frames.spec.ts',
  },
  SEEN_MAX: {
    value: 300, unit: 'entries', kind: 'tool', where: 'src/crawl/readers/seen.ts',
    pinnedBy: 'test/crawl/unread.spec.ts',
  },
  SCROLL_PAUSE_MS: {
    value: 150, unit: 'ms', kind: 'tool', where: 'src/crawl/settle.ts',
    pinnedBy: 'test/crawl/hydration.spec.ts',
  },
  AFTER_SCROLL_MS: {
    value: 1500, unit: 'ms', kind: 'tool', where: 'src/crawl/settle.ts',
    pinnedBy: 'test/crawl/hydration.spec.ts',
  },
  AFTER_SCROLL_QUIET_MS: {
    value: 300, unit: 'ms', kind: 'tool', where: 'src/crawl/settle.ts',
    pinnedBy: 'test/crawl/hydration.spec.ts',
  },
  SIGN_IN_PAGES_READ: {
    value: 3, unit: 'pages', kind: 'tool', where: 'src/crawl/after-crawl.ts',
    pinnedBy: 'test/crawl/login-site.spec.ts',
  },
  SAMPLES_TO_SETTLE: {
    value: 2, unit: 'pages', kind: 'tool', where: 'src/crawl/loop.ts',
    pinnedBy: 'test/crawl/crawler.spec.ts',
  },
  SECTION_SHARE: {
    value: 0.25, unit: 'share of the page limit', kind: 'tool', where: 'src/crawl/loop.ts',
    pinnedBy: 'test/crawl/crawler.spec.ts',
  },
  SECTION_MIN: {
    value: 5, unit: 'pages', kind: 'tool', where: 'src/crawl/loop.ts',
    pinnedBy: 'test/crawl/crawler.spec.ts',
  },
  MENU_FIRST_PAGES: {
    value: 30, unit: 'pages', kind: 'tool', where: 'src/crawl/loop.ts',
    pinnedBy: 'test/crawl/footer-menu-stop.spec.ts',
  },
  SHAPE_MAX_DEPTH: {
    value: 12, unit: 'elements deep', kind: 'tool', where: 'src/pages/fingerprint.ts',
    pinnedBy: 'test/unit/fingerprint.test.ts',
  },
  SHAPE_MAX_PATHS: {
    value: 600, unit: 'paths', kind: 'tool', where: 'src/pages/fingerprint.ts',
    pinnedBy: 'test/unit/fingerprint.test.ts',
  },
} as const satisfies Record<string, Heuristic>;

/** The values, by name: H.MENU_SHARE. */
export const H = valuesOf(CRAWL_HEURISTICS);
