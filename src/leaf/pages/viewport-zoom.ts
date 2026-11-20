/**
 * Whether a viewport setting stops a visitor zooming (SITE-11): user-scalable=no (or 0), or a maximum scale of 1. The finding's
 * rule (src/group/markup-findings.ts) and the audit test's, run in the page (src/pages/reader-page.ts, G-749 slice 5): one text.
 * In the page: BUNDLED into READER_SCRIPT (scripts/controls-script.mjs), so it may import other in-page code and be split into files.
 */
export const blocksZoom = (viewport: string): boolean => /user-scalable\s*=\s*(no|0)/i.test(viewport) || /maximum-scale\s*=\s*1(\.0*)?(?![\d.])/i.test(viewport);
