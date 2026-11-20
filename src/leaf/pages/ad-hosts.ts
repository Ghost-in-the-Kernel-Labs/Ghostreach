/**
 * Hosts of ad networks, their subdomains included: every generated suite blocks requests to them
 * (Playwright and Cypress; a Selenium suite can't intercept requests). Their full-page ads take over
 * the click a test makes, and they keep pages loading. Pure ad networks only: a host that also
 * serves something a visitor uses (bing.com is a search engine too) is never on the list.
 */
const AD_HOSTS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  'googletagservices.com',
  'amazon-adsystem.com',
  'adnxs.com',
  'taboola.com',
  'outbrain.com',
  'criteo.com',
  'pubmatic.com',
  'rubiconproject.com',
  'moatads.com',
  'casalemedia.com',
  'smartadserver.com',
  'yieldmo.com',
  'sharethrough.com',
];

/**
 * True for an address on one of these hosts, or a subdomain of one; false for one that is no URL.
 * The crawl refuses their requests as the suites do (G-095), and records a frame from one as an ad.
 */
// Decision: G-049
export function isAdHost(address: string): boolean {
  let host: string;
  try {
    host = new URL(address).hostname;
  } catch {
    return false;
  }
  return AD_HOSTS.some((ad) => host === ad || host.endsWith(`.${ad}`));
}
