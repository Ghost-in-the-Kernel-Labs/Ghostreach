/**
 * The crawl report (the Observation IR) assembled from what a crawl knows (state.ts, CrawlState.report, which delegates here).
 * Moved out of state.ts by what it does, for the 400-line target (C-022, C-023, J-014): the body is the parent's, its private
 * fields passed in as `known`; the report's fields keep the parent's order.
 */
import { REPORT_VERSION, type CrawledPage, type CrawlReport, type LinkEdge, type LoginForm, type ProviderSignIn, type StopReason } from '../leaf/report.js';
import type { Discovery } from './discovery.js';
import type { NotCrawled } from './not-crawled.js';
import type { RobotsAnswer } from './state.js';

/** What CrawlState knows, as the report reads it. */
export interface KnownToReport {
  origin: string;
  robots: Readonly<RobotsAnswer>;
  notFound: CrawlReport['notFound'];
  site: Readonly<CrawlReport['site']>;
  addresses: CrawlReport['addresses'];
  language: CrawlReport['language'];
  otherLanguages: string[];
  consent: CrawlReport['consent'];
  stopReason: StopReason;
  failed: string | undefined;
  discovery: Discovery;
  pages: CrawledPage[];
  edges: LinkEdge[];
  notCrawled: NotCrawled;
  loginForms: LoginForm[];
  providerSignIns: ProviderSignIn[];
}

/** The crawl report of what the crawl knows: `options`, how it was asked to look. */
export function crawlReport(startUrl: string, options: CrawlReport['options'], known: KnownToReport): CrawlReport {
  const { origin, robots, language, consent, stopReason, failed, site, discovery, notFound, addresses } = known;
  return {
    tool: 'forecursor',
    reportVersion: REPORT_VERSION,
    startUrl,
    origin,
    options,
    adsBlocked: true,
    robots: {
      url: `${origin}/robots.txt`,
      status: robots.status,
      source: robots.policy.source,
      crawlDelaySeconds: robots.policy.crawlDelaySeconds,
      ...(robots.error ? { error: robots.error } : {}),
      ...(robots.certificateChain ? { certificateChain: robots.certificateChain } : {}),
    },
    ...(notFound ? { notFound } : {}),
    ...(site ? { site: { ...site } } : {}),
    ...(addresses ? { addresses } : {}),
    ...(language ? { language: { ...language, others: known.otherLanguages } } : {}),
    ...(consent ? { consent } : {}),
    stopReason,
    ...(failed ? { failed } : {}),
    ...(discovery.newAt.length ? { discovery: { newAt: discovery.newAt } } : {}),
    pages: known.pages,
    edges: known.edges,
    notCrawled: known.notCrawled.list,
    ...(known.notCrawled.left ? { notCrawledLeft: known.notCrawled.left } : {}),
    ...(known.loginForms.length ? { loginForms: known.loginForms } : {}),
    ...(known.providerSignIns.length ? { providerSignIns: known.providerSignIns } : {}),
  };
}
