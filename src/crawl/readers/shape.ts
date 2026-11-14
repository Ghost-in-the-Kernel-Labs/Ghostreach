/** Reader: the page's shape (its element paths), the fingerprint pages are grouped by. */
import type { Page } from 'playwright';
import { collectShapePaths, DEFAULT_SHAPE_OPTIONS, fingerprintFromPaths, type Fingerprint } from '../../leaf/pages/fingerprint.js';

export async function readShape(page: Page): Promise<Fingerprint> {
  return fingerprintFromPaths(await page.evaluate(collectShapePaths, DEFAULT_SHAPE_OPTIONS));
}
