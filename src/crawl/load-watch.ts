/**
 * What a page's load showed beyond the page itself, for the audit (docs/AUDIT-RESEARCH.md, batch 2;
 * G-201): the scripts, style sheets and data requests that answered an error or nothing, the errors
 * its own scripts threw (apart, another site's and those whose stack names no script: G-657, G-734), the http:// requests an https page made, how long it took to answer and to
 * load, and a few of its own response headers. Watched on the crawl's tab as each page loads; what the
 * crawl never fetches (images, media, fonts, ad hosts: router.ts) is never counted as failed. A data request
 * sent to another site's host (a third party's logging, as the-internet's Optimizely events to a name that no
 * longer resolves) is kept apart, `failedElsewhere`: whether the page needs it the crawl cannot tell (G-377). It
 * records; whether any of it is wrong is the audit's to say (src/group/load-findings.ts). It also keeps the words a page gives away of
 * the software it runs (TODO 62, G-701): versioned script and style addresses, the generator meta tag, and the opening comment of
 * each script it loaded, read from the body the browser already has, never asked again.
 * In the page: SELF-CONTAINED: the function given to page.evaluate() for the load's timing goes whole, so it uses nothing this file imports or declares beside it.
 */
import type { Page, Request, Response } from 'playwright';
import { H } from '../leaf/heuristics/suite.js';
import { isAdHost } from '../leaf/pages/ad-hosts.js';
import { siteOf } from '../leaf/pages/site-of.js';
import type { LoadNote } from './open.js';
import type { PageLoad, Sample, SoftwareWords } from '../leaf/report.js';
import { notFetched } from './router.js';

/** Requests whose failure a visitor feels: the page's scripts, style sheets and the data it asks for. */
const WATCHED = ['script', 'stylesheet', 'fetch', 'xhr'];

/** The response headers the audit reads, lower-cased (the rest are the site's own business). */
const HEADERS = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'server', 'x-powered-by'];

const watched = (r: Request) => WATCHED.includes(r.resourceType()) && !notFetched(r);
/** Where an error was thrown: the first web address in its stack (the script's), or null when the stack names none (G-657). */
// Decision: G-657
export function thrownFrom(stack: string | undefined): string | null {
  return /https?:\/\/[^\s):]+(?::\d+(?=\/))?[^\s):]*/.exec(stack ?? '')?.[0] ?? null;
}
/** A data request (not a script or a style sheet, which the page loads into itself) to another site's host. */
// Decision: G-377
const elsewhere = (r: Request, pageUrl: string) => (r.resourceType() === 'fetch' || r.resourceType() === 'xhr') && siteOf(r.url()) !== siteOf(pageUrl);
/** An address in a few words: its path on the site, its host and path elsewhere. */
const short = (url: string, origin: string) => {
  try {
    const u = new URL(url);
    const said = u.origin === origin ? u.pathname : `${u.host}${u.pathname}`;
    return said.length > 70 ? `${said.slice(0, 69)}…` : said;
  } catch {
    return url.slice(0, 70);
  }
};

/**
 * A script or style address that names a version (TODO 62, G-701): its file name holds a dotted number (`jquery-1.12.4.min.js`), or
 * its query names `ver=` (WordPress's `?ver=5.8`). Said as `short` says an address, longer, with only the `ver=` of the query kept:
 * the rest of a query is the site's business and may carry a token. Null for any other address.
 */
// Decision: G-701
function versionedAddress(url: string, origin: string): string | null {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const file = u.pathname.split('/').pop() ?? '';
    const ver = u.searchParams.get('ver');
    const kept = ver !== null && /^\d+(?:\.\d+){0,3}$/.test(ver) ? ver : null;
    if (!/\d+\.\d+/.test(file) && kept === null) return null;
    const said = `${u.origin === origin ? u.pathname : `${u.host}${u.pathname}`}${kept ? `?ver=${kept}` : ''}`;
    return said.slice(0, 200);
  } catch {
    return null;
  }
}

/** A script's opening comment when its first lines hold a dotted number (`/*! jQuery v1.12.4 | ...`), cut to 300 characters; null for any other script. */
// Decision: G-701
function bannerOf(head: string): string | null {
  const text = head.slice(0, 400).trimStart();
  if (!text.startsWith('/*')) return null;
  const said = text.slice(0, 300);
  return /\d+\.\d+/.test(said) ? said : null;
}

/** Watches the crawl's tab; reset before each page, read after it. */
export class LoadWatch implements LoadNote {
  /** Requests asked for and not yet answered, failed or cancelled: what a load that never finishes is waiting for (G-615). */
  private pending = new Set<Request>();
  private unfinished: PageLoad['unfinished'];
  private failed: string[] = [];
  private failedElsewhere: string[] = [];
  private failedOtherSite: string[] = [];
  private errorsOtherSite: string[] = [];
  private errorsUnknownSource: string[] = [];
  private errors: string[] = [];
  private insecure: string[] = [];
  /** Versioned script and style addresses, and the banners of the scripts read so far (TODO 62, G-701). */
  private files: string[] = [];
  private banners: Promise<string | null>[] = [];
  /**
   * `images`: every image a page asked for (never fetched in the crawl: router.ts), with the first page that asked:
   * the audit asks each once after (G-203). A watch of a fresh tab (deadline.ts) is given the one before's.
   */
  constructor(
    private readonly page: Page,
    private readonly images = new Map<string, string>(),
  ) {
    const origin = () => {
      try {
        return new URL(page.url()).origin;
      } catch {
        return '';
      }
    };
    page.on('requestfailed', (r) => {
      this.pending.delete(r);
      // ERR_ABORTED: cancelled as the crawl moved on, or by the page itself; not the site failing.
      const why = r.failure()?.errorText ?? 'no answer';
      if (watched(r) && !/ERR_ABORTED/.test(why)) this.failedOf(r).push(`${short(r.url(), origin())} (${why.replace(/^net::/, '')})`);
    });
    page.on('response', (r: Response) => {
      if (watched(r.request()) && r.status() >= 400) this.failedOf(r.request()).push(`${short(r.url(), origin())} (${r.status()})`);
    });
    // G-657: an error thrown by another site's script (its stack's first address on another site) is kept apart; G-734: so is one
    // whose stack names no address (a browser's own "A network error occurred.", a thrown value that is not an Error): whose it is,
    // the crawl cannot tell, so it is never put in the site's own.
    page.on('pageerror', (e) => {
      const from = thrownFrom(e.stack);
      const list = from === null ? this.errorsUnknownSource : siteOf(from) !== siteOf(page.url()) ? this.errorsOtherSite : this.errors;
      list.push(e.message.split('\n')[0].slice(0, 120));
    });
    page.on('requestfinished', (r) => {
      this.pending.delete(r);
      this.software(r, origin());
    });
    page.on('request', (r) => {
      this.pending.add(r);
      if (r.url().startsWith('http://') && page.url().startsWith('https://')) this.insecure.push(r.url().slice(0, 100));
      if (r.resourceType() === 'image' && /^https?:/.test(r.url()) && !isAdHost(r.url()) && !this.images.has(r.url())) this.images.set(r.url(), page.url());
    });
    page.on('console', (m) => {
      if (m.type() === 'error' && /Mixed Content/i.test(m.text())) this.insecure.push((/'(http:[^']+)'/.exec(m.text())?.[1] ?? m.text()).slice(0, 100));
    });
  }

  /** The list a failed request goes in: the page's own; a data request to another site's host apart (G-377); a script or style sheet there apart too (G-657). */
  private failedOf(r: Request): string[] {
    if (elsewhere(r, this.page.url())) return this.failedElsewhere;
    return siteOf(r.url()) !== siteOf(this.page.url()) ? this.failedOtherSite : this.failed;
  }

  /**
   * A script or style sheet the page loaded, finished: its address kept when it names a version, and a script's opening comment
   * read from the body the browser already holds (finished, so nothing is waited for and nothing is asked again).
   */
  // Decision: G-701
  private software(r: Request, origin: string): void {
    const type = r.resourceType();
    if ((type !== 'script' && type !== 'stylesheet') || notFetched(r)) return;
    const named = versionedAddress(r.url(), origin);
    if (named && !this.files.includes(named) && this.files.length < H.SOFTWARE_WORDS_MAX) this.files.push(named);
    if (type !== 'script' || this.banners.length >= H.SOFTWARE_WORDS_MAX) return;
    this.banners.push(this.bannerOfScript(r));
  }

  /**
   * A finished script's banner, read from the browser only when the script is small (its declared length and the bytes it arrived
   * as at most H.BANNER_SCRIPT_BYTES_MAX): a bundle of megabytes is the site's own code, not a library, and is not read whole for
   * a comment (the security review of b8499ec4). Null for any other.
   */
  // Decision: G-701
  private async bannerOfScript(r: Request): Promise<string | null> {
    try {
      const res = await r.response();
      if (res?.status() !== 200) return null;
      const declared = Number(res.headers()['content-length']);
      const { responseBodySize } = await r.sizes();
      if ((Number.isFinite(declared) && declared > H.BANNER_SCRIPT_BYTES_MAX) || responseBodySize > H.BANNER_SCRIPT_BYTES_MAX) return null;
      return bannerOf((await res.body()).subarray(0, 400).toString('utf8'));
    } catch {
      return null;
    }
  }

  /** The images the pages asked for, each with the first page that did. */
  imagesSeen(): Map<string, string> {
    return this.images;
  }

  /**
   * The page's load event had not fired within the cap (open.ts): recorded with the hosts, by name only, of the requests still
   * pending, up to H.MARKUP_SAMPLE of them, the page's own host first. Never a path or a query string: a site writes those.
   * A request cancelled by the crawl's router (images, media, ad hosts) is not pending, it failed (G-615).
   */
  // Decision: G-615
  loadNotFinished(afterMs: number): void {
    let own = '';
    try {
      own = new URL(this.page.url()).hostname.toLowerCase();
    } catch {
      // The page is not at an address (about:blank): every host is another.
    }
    const named = new Map<string, boolean>();
    for (const r of this.pending) {
      try {
        const host = new URL(r.url()).hostname.toLowerCase();
        if (host && /^https?:/.test(r.url())) named.set(host, host === own);
      } catch {
        // Not an address: not a host to name.
      }
    }
    const hosts = [...named].map(([host, isOwn]) => ({ host, own: isOwn })).sort((a, b) => Number(b.own) - Number(a.own) || a.host.localeCompare(b.host)).slice(0, H.MARKUP_SAMPLE);
    this.unfinished = { afterMs, ...(hosts.length ? { hosts } : {}) };
  }

  reset(): void {
    this.pending = new Set();
    this.unfinished = undefined;
    this.failed = [];
    this.failedElsewhere = [];
    this.failedOtherSite = [];
    this.errorsOtherSite = [];
    this.errorsUnknownSource = [];
    this.errors = [];
    this.insecure = [];
    this.files = [];
    this.banners = [];
  }

  /** What the page's load showed: its samples, its timing, and its headers; null when nothing to say. */
  async read(response: { headers(): Record<string, string> } | null): Promise<PageLoad | null> {
    const sample = (items: string[]): Sample | undefined => (items.length ? { count: items.length, first: [...new Set(items)].slice(0, H.MARKUP_SAMPLE) } : undefined);
    const timing = await this.page
      .evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        // The generator meta tag (TODO 62, G-701): what the page says made it, cut short.
        const generator = document.querySelector('meta[name="generator" i]')?.getAttribute('content')?.trim().slice(0, 120) || undefined;
        return { generator, ...(nav ? { firstByteMs: Math.round(nav.responseStart - nav.startTime), loadMs: Math.round(nav.loadEventEnd - nav.startTime) } : {}) };
      })
      .catch(() => null);
    // The banners waited for at most H.BANNER_WAIT_MS: one the browser has not given by then is left unsaid, never waited on.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<null>((done) => (timer = setTimeout(() => done(null), H.BANNER_WAIT_MS)));
    const read = await Promise.all(this.banners.map((b) => Promise.race([b, late])));
    clearTimeout(timer);
    const banners = [...new Set(read.filter((b): b is string => b !== null))];
    const software: SoftwareWords = {
      ...(this.files.length ? { files: [...this.files] } : {}),
      ...(timing?.generator ? { generator: timing.generator } : {}),
      ...(banners.length ? { banners } : {}),
    };
    const all = response?.headers() ?? {};
    const headers = Object.fromEntries(HEADERS.filter((h) => all[h] !== undefined).map((h) => [h, all[h].slice(0, 200)]));
    // A time is kept from H.TIMING_FLOOR_MS on, to the nearest 100 ms: a quick page's would only be noise.
    const kept = (ms: number | undefined) => (ms !== undefined && ms >= H.TIMING_FLOOR_MS ? Math.round(ms / 100) * 100 : undefined);
    const firstByteMs = kept(timing?.firstByteMs);
    // A load that never finished has no time: a load event that fired after the cap, while the page was read, is not a measure of the page.
    const loadMs = this.unfinished ? undefined : kept(timing?.loadMs);
    const load: PageLoad = {
      ...(firstByteMs ? { firstByteMs } : {}),
      ...(loadMs ? { loadMs } : {}),
      ...(this.unfinished ? { unfinished: this.unfinished } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
      ...(Object.keys(software).length ? { software } : {}),
    };
    const samples = { failed: sample(this.failed), failedElsewhere: sample(this.failedElsewhere), failedOtherSite: sample(this.failedOtherSite), scriptErrors: sample(this.errors), scriptErrorsOtherSite: sample(this.errorsOtherSite), scriptErrorsUnknownSource: sample(this.errorsUnknownSource), insecure: sample(this.insecure) };
    for (const [k, v] of Object.entries(samples)) if (v) (load as Record<string, unknown>)[k] = v;
    return Object.keys(load).length ? load : null;
  }
}
