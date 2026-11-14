/** Small crawl reports for the audit's slice-2 tests (G-749): what an https crawl saw of the site itself. Made-up data only (G-085). */
import type { CrawledPage, CrawlReport } from '../../src/leaf/report.js';
import { ORIGIN, page, report } from './review-reports.js';

/** The site's headers, certificate, sitemap, security.txt and other name as an https crawl saw them: each of SITE-24 to 31 found. */
export function siteCrawl(): CrawlReport {
  return report([
    page('/', 200, { load: { headers: { server: 'nginx/1.18.0', 'x-powered-by': 'AmazonS3' } } } as Partial<CrawledPage>),
    page('/news', 200, { load: { headers: { server: 'nginx/1.18.0' } } } as Partial<CrawledPage>),
  ], {
    site: {
      certificate: { validTo: '2026-11-20', daysLeft: 9, names: ['other.test'], matches: false, trusted: false },
      sitemap: { url: `${ORIGIN}/sitemap.xml`, status: 200, listed: 3, broken: [`${ORIGIN}/gone`], moved: [`${ORIGIN}/moved?x=1`] },
      securityTxt: { url: `${ORIGIN}/.well-known/security.txt`, status: 200, noContact: true },
      twin: { url: 'https://www.shop.test/', status: 200 },
    },
  } as Partial<CrawlReport>);
}
