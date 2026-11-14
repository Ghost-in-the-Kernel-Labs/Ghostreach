// The crawl specs (Playwright Test), run by the medium gate (stacks/typescript/gate.sh): the parent's config at a4c8045, its
// runner imported from `playwright/test` (the one runtime dependency carries it; no `@playwright/test`).
import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: 'test/crawl',
  timeout: 60_000,
  // Each test starts its own fixture server on a free port, so tests can run in parallel.
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { trace: 'off' },
});
