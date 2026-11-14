/**
 * The thresholds of one layer of the pipeline: what the generator makes of it (src/model/, src/kits/, src/targets/). Each with its value, where it is used and
 * the test that pins it; the catalog (catalog.ts) joins the six layers for HEURISTICS.md and its test, and a
 * layer's code imports only its own `H` from here (F3, TODO item 54).
 */
import { valuesOf, type Heuristic } from './types.js';

const SUITE_HEURISTICS = {
  APP_PAGES_MIN: {
    value: 2, unit: 'pages', kind: 'tool', where: 'src/group/findings.ts',
    pinnedBy: 'test/unit/findings.test.ts',
  },
  MARKUP_SAMPLE: {
    value: 5, unit: 'elements', kind: 'tool', where: 'src/crawl/readers/markup.ts',
    pinnedBy: 'test/crawl/markup.spec.ts',
  },
  SOFTWARE_WORDS_MAX: {
    value: 20, unit: 'addresses or banners', kind: 'tool', where: 'src/crawl/load-watch.ts',
    pinnedBy: 'test/crawl/vulnsec.spec.ts',
  },
  BANNER_SCRIPT_BYTES_MAX: {
    value: 500_000, unit: 'bytes', kind: 'tool', where: 'src/crawl/load-watch.ts',
    pinnedBy: 'test/crawl/vulnsec.spec.ts',
  },
  BANNER_WAIT_MS: {
    value: 2000, unit: 'ms', kind: 'tool', where: 'src/crawl/load-watch.ts',
    pinnedBy: 'test/crawl/vulnsec.spec.ts',
  },
  IMAGES_ASKED: {
    value: 60, unit: 'images', kind: 'tool', where: 'src/crawl/site-probe.ts',
    pinnedBy: 'test/crawl/site-probe.spec.ts',
  },
  OTHER_HOSTS_MAX: {
    value: 100, unit: 'hosts', kind: 'tool', where: 'src/crawl/state.ts',
    pinnedBy: 'test/unit/offline-closed.test.ts',
  },
  EXTERNAL_LINKS_ASKED: {
    value: 100, unit: 'addresses', kind: 'tool', where: 'src/crawl/site-probe.ts',
    pinnedBy: 'test/unit/external-links.test.ts',
  },
  DOWNGRADES_ASKED: {
    value: 60, unit: 'addresses', kind: 'tool', where: 'src/crawl/site-probe.ts',
    pinnedBy: 'test/unit/http-downgrade.test.ts',
  },
  ROBOTS_MAX_CHARS: {
    value: 512_000, unit: 'characters', kind: 'tool', where: 'src/crawl/robots.ts',
    pinnedBy: 'test/unit/robots.test.ts',
  },
  PAGE_BODY_MAX_BYTES: {
    value: 50_000_000, unit: 'bytes', kind: 'tool', where: 'src/crawl/router.ts',
    pinnedBy: 'test/crawl/hostile-crawl.spec.ts',
  },
  LINKS_PER_PAGE_MAX: {
    value: 5000, unit: 'links', kind: 'tool', where: 'src/crawl/page-step.ts',
    pinnedBy: 'test/crawl/bounds.spec.ts',
  },
  NOT_CRAWLED_MAX: {
    value: 50_000, unit: 'addresses', kind: 'tool', where: 'src/crawl/state.ts',
    pinnedBy: 'test/unit/crawl-state.test.ts',
  },
  ROBOTS_RETRIES: {
    value: 2, unit: 'retries', kind: 'tool', where: 'src/crawl/robots-fetch.ts',
    pinnedBy: 'test/crawl/crawl-politeness.spec.ts',
  },
  ROBOTS_RETRY_WAIT_MS: {
    value: 5000, unit: 'ms', kind: 'tool', where: 'src/crawl/robots-fetch.ts',
    pinnedBy: 'test/crawl/crawl-politeness.spec.ts',
  },
  CERT_WARN_DAYS: {
    value: 30, unit: 'days', kind: 'tool', where: 'src/group/probe-findings.ts',
    pinnedBy: 'test/unit/probe-findings.test.ts',
  },
  TIMING_FLOOR_MS: {
    value: 1000, unit: 'ms', kind: 'tool', where: 'src/crawl/load-watch.ts',
    pinnedBy: 'test/crawl/load-watch.spec.ts',
  },
  SLOW_PAGE_MS: {
    value: 5000, unit: 'ms', kind: 'tool', where: 'src/group/load-findings.ts',
    pinnedBy: 'test/unit/load-findings.test.ts',
  },
  SLOW_FIRST_BYTE_MS: {
    value: 2000, unit: 'ms', kind: 'tool', where: 'src/group/load-findings.ts',
    pinnedBy: 'test/unit/load-findings.test.ts',
  },
  REDIRECT_CHAIN_HOPS: {
    value: 2, unit: 'hops', kind: 'tool', where: 'src/group/markup-findings.ts',
    pinnedBy: 'test/unit/markup-findings.test.ts',
  },
  COPYRIGHT_STALE_YEARS: {
    value: 2, unit: 'years', kind: 'tool', where: 'src/group/markup-findings.ts',
    pinnedBy: 'test/unit/markup-findings.test.ts',
  },
} as const satisfies Record<string, Heuristic>;

/** The values, by name: H.MENU_SHARE. */
export const H = valuesOf(SUITE_HEURISTICS);
