/**
 * Which site a host is: its last two labels, so www.shop.test, cdn.shop.test and api.shop.test are one site's (a guess that
 * errs toward the site's own). One rule for the crawl's load watch and the audit (G-377, G-657). Takes an address, or a
 * sample as the crawl says it ("player.example.net/api.js (403)"); a path alone ("/js/app.js") has no host and gives "".
 */
export function siteOf(address: string): string {
  if (address.startsWith('/')) return '';
  for (const candidate of [address, `https://${address}`]) {
    try {
      return new URL(candidate).hostname.split('.').slice(-2).join('.');
    } catch {
      // not an address as written: try it as host and path
    }
  }
  return address;
}
