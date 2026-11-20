/**
 * What the audit finds in each page's markup and redirects (docs/AUDIT-RESEARCH.md, batch 1;
 * G-194): screen readers, phones, search engines and text left from building the site. Each is a
 * SiteFinding as G-132's are, with why and the fix said to the site's owner; siteFindings
 * (findings.ts) adds them after its own.
 */
import { H } from '../leaf/heuristics/suite.js';
import { roleOf, withoutRole } from '../leaf/pages/url.js';
import { siteText } from '../leaf/pages/site-text.js';
import type { CrawledPage, CrawlReport, PageMarkup, Sample } from '../leaf/report.js';
import { droppedQuery } from './query-dropped.js';
import type { ItemEvidence, MarkupRead } from './item-evidence.js';
import type { SiteFinding } from './types.js';
import { keyOf } from './address-key.js';
import { componentFinding, type ComponentTitle } from './by-component.js';
import { answered, pageItem, sampleItem } from './markup-items.js';
import { wordedHeadings } from '../leaf/pages/worded-headings.js';
import { blocksZoom } from '../leaf/pages/viewport-zoom.js';
import { canonicalItem, pageReadItem } from './softer-items.js';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const onPages = (n: number) => `on ${plural(n, 'page')}`;


/**
 * A page's redirects as a visitor pays for them: each the server's, and a move by the page's own script
 * to another page; a script that only tidies its own address (a query dropped, the same path) is none.
 */
export function redirectHops(p: CrawledPage): CrawledPage['redirects'] {
  const after = (i: number) => p.redirects[i + 1]?.url ?? p.finalUrl;
  return (p.redirects ?? []).filter((r, i) => r.status !== 0 || new URL(r.url).pathname !== new URL(after(i)).pathname);
}

/**
 * The pages a visitor reads, which the findings read: answered, not another page again, on the site; a role's page only where no
 * visitor's has its path. Not `typedPages` (pages.ts), the pages that become page types: those keep a page an app drew under an
 * error status and leave sign-in addresses out; these keep sign-in pages and leave every error status and off-site page out.
 */
export function visitorPages(report: CrawlReport): CrawledPage[] {
  const read = report.pages.filter((p) => p.fingerprint && !p.duplicateOf && !p.offSite && p.status !== null && p.status < 400);
  const visitor = new Set(read.filter((p) => roleOf(p.url) === null).map((p) => p.finalUrl));
  return read.filter((p) => roleOf(p.url) === null || !visitor.has(withoutRole(p.finalUrl)));
}

/** The samples an audit test re-checks (G-749 slice 4): each line of their findings keeps its item. */
const RECHECKED = new Set<keyof PageMarkup>(['unnamed', 'unlabelled', 'placeholderOnly', 'noAlt', 'noSrc', 'placeholder']);

/** The addresses of the pages an audit test can read (G-749 slice 4): those that answered 2xx. */
const readableIn = (pages: CrawledPage[]) => {
  const ok = new Set(pages.filter(answered).map((p) => p.finalUrl));
  return (url: string) => ok.has(url);
};

/** One finding for a sample kind of the pages' markup (G-664: by component). */
function sampleFinding(pages: CrawledPage[], kind: keyof PageMarkup, noun: [string, string?], f: Omit<SiteFinding, 'where' | 'title' | 'listed'> & { title: ComponentTitle }): SiteFinding[] {
  return componentFinding(pages, (p) => p.markup?.[kind] as Sample | undefined, siteText, noun, f, undefined, RECHECKED.has(kind) ? sampleItem(kind as MarkupRead, readableIn(pages)) : undefined);
}

/** A page finding's lines, each with the page's own item (G-749 slice 4), keyed by its path. */
const withPageItems = (fs: SiteFinding[], pages: CrawledPage[], read: MarkupRead, origin: string): SiteFinding[] =>
  fs.map((f) => ({ ...f, where: f.where.map((w, i) => ({ ...w, ...pageItem(pages[i], read, keyOf(pages[i].finalUrl, origin), read === 'h1' ? wordedHeadings(pages[i].structure?.h1 ?? []).length : 0) })) }));

/** Every markup finding the crawl shows, the major first. */
// Decision: G-194
export function markupFindings(report: CrawlReport): SiteFinding[] {
  const pages = visitorPages(report);
  const marked = pages.filter((p) => p.markup);
  return [
    ...sampleFinding(marked, 'unnamed', ['link or button', 'links and buttons'], {
      code: 'SITE-07', severity: 'major',
      title: (count, n, m) => `${count} ${onPages(m)} ${n === 1 ? 'has' : 'have'} nothing for a screen reader to say`,
      // G-698: an automated read shows a likely barrier, against the standard; whether a site meets a law is not its to say.
      why: 'A blind visitor hears only "link" or "button", with no idea where it goes or what it does. Accessibility audits flag it under WCAG 4.1.2 (Name, Role, Value), the standard that laws such as the ADA and the European Accessibility Act are commonly measured by; an automated read shows a likely barrier, not a legal finding, so a person confirms each one.',
      fix: 'Give each one words: visible text, an aria-label, or an alt on the image inside it (an icon link to a cart: aria-label="Cart").',
    }),
    ...sampleFinding(marked, 'unlabelled', ['form field'], {
      code: 'SITE-08', severity: 'major',
      title: (count, n, m) => `${count} ${onPages(m)} ${n === 1 ? 'has' : 'have'} no label`,
      why: 'A screen reader announces a field with no label as "edit text", so a blind visitor cannot tell what to type. Accessibility audits fail it.',
      fix: 'Give each field a <label for="its id"> (each id used once on the page), or an aria-label.',
    }),
    // G-665: a field named only by its placeholder is read out, so it is not "edit text": minor, said as what it lacks.
    ...sampleFinding(marked, 'placeholderOnly', ['form field'], {
      code: 'SITE-41', severity: 'minor',
      title: (count, n, m) => `${count} ${onPages(m)} ${n === 1 ? 'has' : 'have'} no visible label, only a placeholder`,
      why: 'A screen reader reads the placeholder out, so the field is named; but the placeholder vanishes once typing starts, so a visitor who looks back cannot see what the field was for, and placeholder text is often too faint to read. Accessibility audits flag it.',
      fix: 'Give each field a visible <label for="its id">; keep the placeholder, if at all, as an example of what to type.',
    }),
    ...sampleFinding(marked, 'noSrc', ['image'], {
      code: 'SITE-09', severity: 'major',
      title: (count, n, m) => `${count} ${onPages(m)} ${n === 1 ? 'has' : 'have'} no address: drawn as a broken box`,
      why: 'A visitor sees a broken-image box or a gap where a product, a logo or a picture should be.',
      fix: 'Give each image the address of its file (src), or remove it; an empty src is often a template whose data never arrived.',
    }),
    ...sampleFinding(marked, 'placeholder', ['place'], {
      code: 'SITE-10', severity: 'major',
      title: (count, _n, m) => `Text left from building the site shows ${onPages(m)} (${count})`,
      why: 'Lorem ipsum, TODO notes or test entries on a live site show a visitor a page that is not finished, and can look like a security test left behind.',
      fix: 'Replace or remove the text; test entries belong in a test copy of the site, not the live one.',
    }),
    ...phoneFinding(marked, report.origin),
    ...canonicalFinding(report),
    ...sampleFinding(marked, 'noAlt', ['image'], {
      code: 'SITE-13', severity: 'minor',
      title: (count, n, m) => `${count} ${onPages(m)} ${n === 1 ? 'has' : 'have'} no alt text`,
      why: 'A screen reader reads the file name instead, or nothing; search engines lose the words that say what the image shows.',
      fix: 'Add alt="what the image shows"; for an image that is decoration only, alt="".',
    }),
    ...withPageItems(simple(marked.filter((p) => !p.markup?.lang), 'SITE-14', 'minor', (m) => `${plural(m, 'page')} ${m === 1 ? 'does' : 'do'} not say ${m === 1 ? 'its' : 'their'} language`, () => 'no lang on <html>',
      'A screen reader guesses the language and may read the page in the wrong accent; browsers may offer to translate it wrongly.', 'Add lang to the html element: <html lang="en">.'), marked.filter((p) => !p.markup?.lang), 'lang', report.origin),
    ...headingFinding(pages, report.origin),
    ...deadAnchorFinding(marked),
    ...descriptionFinding(marked, report.origin),
    ...chainFinding(report),
    ...copyrightFinding(marked, report.origin),
  ];
}

/**
 * A skip link's usual targets: the first link of a page, hidden until a keyboard reaches it, that jumps past the menu to the
 * content. The crawl records the link's address only, so it is told by where it points (G-743 (4), B7: WordPress's
 * "screen-reader-text skip-link" to #content).
 */
const SKIP_TARGET = /^<a href="#(content|main|main-content|maincontent|primary|site-content|page-content|skip|skip-link|skip-to-content)">$/i;

/** SITE-16: links to a #part no element has; a skip link said as one. */
function deadAnchorFinding(marked: CrawledPage[]): SiteFinding[] {
  const skip = marked.some((p) => p.markup?.deadAnchors?.first.some((a) => SKIP_TARGET.test(a)));
  return componentFinding(marked, (p) => p.markup?.deadAnchors, (x) => (SKIP_TARGET.test(x) ? `${siteText(x)} (a skip link)` : siteText(x)), ['link'], {
    code: 'SITE-16', severity: 'minor',
    title: (count, n, m) => `${count} ${onPages(m)} ${n === 1 ? 'points' : 'point'} to a part of the page that is not there`,
    why: `A visitor clicks and nothing happens: the link names a #part no element on the page has.${skip ? ' A skip link is the one a keyboard or screen-reader visitor uses to pass the menu: leading nowhere, it leaves them at the menu on every page.' : ''}`,
    fix: `Give the part it means the id the link names, or point the link at the right one.${skip ? ' For a skip link, give the main content the id it names (id="content").' : ''}`,
  }, undefined, sampleItem('deadAnchors', readableIn(marked)));
}

/** A finding that lists pages, when there are any. */
function simple(pages: CrawledPage[], code: SiteFinding['code'], severity: SiteFinding['severity'], title: (m: number) => string, says: (p: CrawledPage) => string, why: string, fix: string): SiteFinding[] {
  return pages.length ? [{ code, severity, title: title(pages.length), where: pages.map((p) => ({ url: p.finalUrl, says: says(p) })), why, fix }] : [];
}

/** SITE-11: no viewport tag (a desktop page on a phone), or one that stops a visitor zooming. */
function phoneFinding(pages: CrawledPage[], origin: string): SiteFinding[] {
  const bad = pages.filter((p) => p.markup?.viewport === null || blocksZoom(p.markup?.viewport ?? ''));
  const none = bad.filter((p) => p.markup?.viewport === null).length;
  return simple(bad, 'SITE-11', 'major',
    (m) => [none ? `${plural(none, 'page')} ${none === 1 ? 'has' : 'have'} no viewport setting` : '', m - none ? `${plural(m - none, 'page')} stop${m - none === 1 ? 's' : ''} a visitor zooming` : ''].filter(Boolean).join('; '),
    (p) => (p.markup?.viewport === null ? 'no <meta name="viewport">: a phone shows the desktop page, shrunk' : `viewport ${siteText(p.markup?.viewport ?? '')} stops zooming`),
    'On a phone a page with no viewport setting is drawn at desktop width and shrunk to fit, and Google ranks it as not mobile-friendly. A page that stops zooming fails people who need larger text (WCAG 1.4.4).',
    'Use <meta name="viewport" content="width=device-width, initial-scale=1">, without user-scalable=no or maximum-scale=1.')
    .map((f) => ({ ...f, where: f.where.map((w, i) => ({ ...w, ...pageReadItem(bad[i], 'viewport', keyOf(bad[i].finalUrl, origin), null, bad[i].markup?.viewport ?? undefined) })) }));
}

/** SITE-12: a canonical link that sends search engines to an error, a redirect, or another site. */
function canonicalFinding(report: CrawlReport): SiteFinding[] {
  const byUrl = new Map(report.pages.map((p) => [p.url, p]));
  const bad = report.pages.flatMap((p) => {
    if (!p.canonical || p.offSite || p.status === null || p.status >= 400) return [];
    const item = canonicalItem(p, keyOf(p.finalUrl, report.origin));
    if (new URL(p.canonical).origin !== report.origin) return [{ url: p.finalUrl, says: `canonical names another site: ${p.canonical}`, ...item }];
    const target = byUrl.get(p.canonical);
    if (target?.status && target.status >= 400) return [{ url: p.finalUrl, says: `canonical ${new URL(p.canonical).pathname} answers ${target.status}`, ...item }];
    if (target?.redirects?.length && target.finalUrl !== p.finalUrl) return [{ url: p.finalUrl, says: `canonical ${new URL(p.canonical).pathname} redirects to ${new URL(target.finalUrl).pathname}`, ...item }];
    return [];
  });
  return bad.length ? [{
    code: 'SITE-12', severity: 'major',
    title: `${plural(bad.length, 'page')} tell${bad.length === 1 ? 's' : ''} search engines the real page is somewhere it is not`,
    where: bad,
    why: 'A canonical link tells Google which address is the real page; one naming an error, a redirect or another site can drop the page from search results altogether.',
    fix: "Point each page's canonical link at its own final address (or at the page it truly copies).",
  }] : [];
}

/**
 * SITE-15: pages with no main heading (h1) a visitor sees, or several. Every h1 the crawl kept counts, wherever it stands: on
 * quavo.com's posts, which have no main region (`main: false`), a related-posts carousel's cards are h1s a visitor sees and a
 * screen reader lists as main headings, and the post's own title is none, so the page's subject is said by none of them.
 */
// Decision: G-194, G-737
function headingFinding(pages: CrawledPage[], origin: string): SiteFinding[] {
  // An h1 with no words (a spacer, an empty block) is no heading to a reader: only those with words count (G-666). Two with the
  // same words are one heading (G-742 (1)): a responsive or animated copy the crawl cannot prove hidden says the same subject twice
  // (harriscomputer.com, 11 of its 15 pages). The rule is wordedHeadings, which an audit test runs in the page too (G-749).
  const worded = (p: CrawledPage) => wordedHeadings(p.structure?.h1 ?? []);
  const bad = pages.filter((p) => p.structure && worded(p).length !== 1);
  const none = bad.filter((p) => worded(p).length === 0).length;
  return withPageItems(simple(bad, 'SITE-15', 'minor',
    (m) => [none ? `${plural(none, 'page')} ${none === 1 ? 'has' : 'have'} no main heading` : '', m - none ? `${plural(m - none, 'page')} ${m - none === 1 ? 'has' : 'have'} several main headings (h1)` : ''].filter(Boolean).join('; '),
    (p) => (worded(p).length ? `${worded(p).length} h1: ${worded(p).slice(0, 3).map((h) => siteText(h)).join(', ')}` : 'no h1 with words shown'),
    'Screen reader users jump to the h1 to learn what a page is, and search engines read it as the page\'s subject; none, or several competing, says neither.',
    'Give each page one h1 naming what it shows; the site\'s name in the header is not it.'), bad, 'h1', origin);
}

/** SITE-17: pages with no description for search results, or one shared by pages that differ. */
function descriptionFinding(pages: CrawledPage[], origin: string): SiteFinding[] {
  const by = new Map<string, CrawledPage[]>();
  for (const p of pages) {
    const d = p.markup?.description?.trim() ?? '';
    by.set(d, [...(by.get(d) ?? []), p]);
  }
  const none = by.get('') ?? [];
  const shared = [...by].filter(([d, ps]) => d && ps.length > 1 && new Set(ps.map((p) => p.title)).size > 1).flatMap(([d, ps]) => ps.map((p) => ({ p, d })));
  const where = [
    ...none.map((p) => ({ url: p.finalUrl, says: 'no meta description', ...pageReadItem(p, 'undescribed', keyOf(p.finalUrl, origin)) })),
    ...shared.map(({ p, d }) => ({ url: p.finalUrl, says: `shares ${siteText(d, { max: 60 })}`, ...pageReadItem(p, 'description', keyOf(p.finalUrl, origin), d) })),
  ];
  return where.length ? [{
    code: 'SITE-17', severity: 'minor',
    title: [none.length ? `${plural(none.length, 'page')} ${none.length === 1 ? 'has' : 'have'} no description for search results` : '', shared.length ? `${plural(shared.length, 'page')} share${shared.length === 1 ? 's' : ''} a description with pages that differ` : ''].filter(Boolean).join('; '),
    where,
    why: 'Search results show the description under the title; without one, the search engine picks a line of the page, often the menu or a cookie notice.',
    fix: 'Give each page a <meta name="description"> of a sentence or two saying what it offers.',
  }] : [];
}

/** A chain's hop that only drops a query parameter, said in the fix (G-743 (4), I8): the parameter is the site builder's. */
function dropping(chains: CrawledPage[]): string {
  const names = [...new Set(chains.flatMap((p) => p.redirects.flatMap((r, i) => droppedQuery(r.url, p.redirects[i + 1]?.url ?? p.finalUrl))))];
  return names.length ? ` A hop that only drops a query parameter (${names.join(', ')}) is one a link without it skips: a site builder often adds it to every link (a language switcher), and its setting can stop that.` : '';
}

/** SITE-18: the site's own links that go through H.REDIRECT_CHAIN_HOPS redirects or more. */
function chainFinding(report: CrawlReport): SiteFinding[] {
  const chains = report.pages.filter((p) => !p.offSite && redirectHops(p).length >= H.REDIRECT_CHAIN_HOPS);
  return simple(chains, 'SITE-18', 'minor', (m) => `${plural(m, 'address', 'addresses')} go${m === 1 ? 'es' : ''} through a chain of redirects`,
    // Path and query: a chain that differs only in its query (?hsLang=en dropped) would read as a page sent to itself (G-666).
    (p) => `${[...p.redirects.map((r) => r.url), p.finalUrl].map((u) => { const a = new URL(u); return a.pathname + a.search; }).join(' → ')} (${p.redirects.map((r) => r.status).join(', ')})`,
    'Each redirect is another round trip before the page starts to load, and search engines may give up on a long chain.',
    `Redirect each old address straight to the final one, and link to the final address.${dropping(chains)}`).map((f) => ({ ...f, listed: ['address', 'addresses'] as [string, string], where: f.where.map((w, i) => ({ ...w, ...chainItem(chains[i], report.origin) })) }));
}

/** The item of a chain (G-749): its first address and how many hops; none when a hop is a script's move, which a re-check over HTTP cannot count. */
// Decision: G-749
function chainItem(p: CrawledPage, origin: string): { item?: ItemEvidence } {
  const hops = redirectHops(p);
  return hops.every((r) => r.status >= 300 && r.status < 400) ? { item: { at: 'redirects', key: keyOf(p.url, origin), url: withoutRole(p.url), hops: hops.length } } : {};
}

/** SITE-19: a copyright notice H.COPYRIGHT_STALE_YEARS years or more behind the year it was read. */
function copyrightFinding(pages: CrawledPage[], origin: string): SiteFinding[] {
  const old = pages.filter((p) => p.markup?.copyright && p.markup.copyright.seen - p.markup.copyright.year >= H.COPYRIGHT_STALE_YEARS);
  const years = [...new Set(old.map((p) => p.markup?.copyright?.year))].sort().join(', ');
  return simple(old, 'SITE-19', 'minor', (m) => `The copyright notice says ${years} ${onPages(m)}`, (p) => `© ${p.markup?.copyright?.year}`,
    'An old year tells a visitor the site may not be looked after, and its prices or details may be out of date.',
    'Update the year, or write it from the current date in the page template.')
    .map((f) => ({ ...f, where: f.where.map((w, i) => ({ ...w, ...pageReadItem(old[i], 'copyright', keyOf(old[i].finalUrl, origin), null, String(old[i].markup?.copyright?.year)) })) }));
}
