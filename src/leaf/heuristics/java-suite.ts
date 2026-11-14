/**
 * The thresholds of one layer of the pipeline: the generated suite (written into its Java). Each with its value, where it is used and
 * the test that pins it; the catalog (catalog.ts) joins the six layers for HEURISTICS.md and its test, and a
 * layer's code imports only its own `H` from here (F3, TODO item 54).
 */
import { valuesOf, type Heuristic } from './types.js';

const JAVA_SUITE_HEURISTICS = {
  ADDRESS_TIMEOUT_MS: {
    value: 5000, unit: 'ms', kind: 'tool', where: 'src/crawl/addresses.ts',
    pinnedBy: 'test/unit/addresses.test.ts',
  },
  FAILED_HOSTS_CHECKED: {
    value: 20, unit: 'hosts', kind: 'tool', where: 'src/crawl/failed-hosts.ts',
    pinnedBy: 'test/unit/failed-hosts.test.ts',
  },
  FAILED_HOSTS_LOOKUP_MS: {
    value: 3000, unit: 'ms', kind: 'tool', where: 'src/crawl/failed-hosts.ts',
    pinnedBy: 'test/unit/failed-hosts.test.ts',
  },
  FAILED_HOSTS_TOTAL_MS: {
    value: 8000, unit: 'ms', kind: 'tool', where: 'src/crawl/failed-hosts.ts',
    pinnedBy: 'test/unit/failed-hosts.test.ts',
  },
} as const satisfies Record<string, Heuristic>;

/** The values, by name: H.MENU_SHARE. */
export const H = valuesOf(JAVA_SUITE_HEURISTICS);
