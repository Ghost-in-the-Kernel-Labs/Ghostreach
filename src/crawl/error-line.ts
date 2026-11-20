/**
 * An error's first line: what the crawl says and records of an error, without the call log Playwright's messages go
 * on with. One place, so every reader of an error says it the same way (TODO 135 S8).
 */

/** An error's first line: Playwright's messages go on with a call log. */
export function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0];
}
