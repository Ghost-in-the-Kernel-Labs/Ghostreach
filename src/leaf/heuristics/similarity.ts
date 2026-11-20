/**
 * The thresholds of one layer of the pipeline: telling page types apart (src/pages/similarity.ts). Each with its value, where it is used and
 * the test that pins it; the catalog (catalog.ts) joins the six layers for HEURISTICS.md and its test, and a
 * layer's code imports only its own `H` from here (F3, TODO item 54).
 */
import { valuesOf, type Heuristic } from './types.js';

const SIMILARITY_HEURISTICS = {
  HEADINGS_AGREE: {
    value: 0.5, unit: 'Jaccard', kind: 'tool', where: 'src/pages/similarity.ts',
    pinnedBy: 'test/unit/similarity.test.ts',
  },
  HEADINGS_CONTAINED: {
    value: 0.8, unit: 'overlap', kind: 'tool', where: 'src/pages/similarity.ts',
    pinnedBy: 'test/unit/similarity.test.ts',
  },
  LISTING_SHAPE_AGREE: {
    value: 0.85, unit: 'Jaccard', kind: 'tool', where: 'src/pages/similarity.ts',
    pinnedBy: 'test/unit/group-real.test.ts',
  },
  SHAPES_AGREE: {
    value: 0.7, unit: 'Jaccard', kind: 'tool', where: 'src/pages/similarity.ts',
    pinnedBy: 'test/unit/similarity.test.ts',
  },
  SOME_HEADINGS_SHARED: {
    value: 0.15, unit: 'Jaccard', kind: 'tool', where: 'src/pages/similarity.ts',
    pinnedBy: 'test/unit/similarity.test.ts',
  },
  SOME_SHAPE_SHARED: {
    value: 0.4, unit: 'Jaccard', kind: 'tool', where: 'src/pages/similarity.ts',
    pinnedBy: 'test/unit/similarity.test.ts',
  },
  MIN_HEADINGS_FOR_OVERLAP: {
    value: 4, unit: 'headings', kind: 'tool', where: 'src/pages/similarity.ts',
    pinnedBy: 'test/unit/similarity.test.ts',
  },
  UNIFORM_SHAPE: {
    value: 0.8, unit: 'Jaccard', kind: 'tool', where: 'src/pages/similarity.ts',
    pinnedBy: 'test/unit/similarity.test.ts',
  },
  UNIFORM_SHARE: {
    value: 0.8, unit: 'share of pages', kind: 'tool', where: 'src/pages/similarity.ts',
    pinnedBy: 'test/unit/similarity.test.ts',
  },
} as const satisfies Record<string, Heuristic>;

/** The values, by name: H.MENU_SHARE. */
export const H = valuesOf(SIMILARITY_HEURISTICS);
