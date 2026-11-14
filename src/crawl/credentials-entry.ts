/**
 * The words of a crawl report's page entry with each sentence that gives a credential replaced by the marker
 * (TODO 71, TODO 89). Pure, so a report read from a file is cleaned by it too (report-read.ts): a crawl taken before the
 * marker existed, or by another build, gives no credential to a name, a comment, a test or a document the suite writes.
 * Marking twice is marking once.
 */
import { markCredentials } from '../leaf/pages/credential-text.js';
import type { BrowserControl, CrawledPage, PageControl, Sample, SoftwareWords } from '../leaf/report.js';

const mark = (texts: string[]): string[] => texts.map(markCredentials);
const markControl = (c: PageControl): PageControl => ({ ...c, words: c.words.map(markCredentials), ...(c.options ? { options: c.options.map(markCredentials) } : {}), ...(c.form ? { form: markCredentials(c.form) } : {}) });
const markSample = (sample: Sample | undefined): Sample | undefined => sample && { ...sample, first: sample.first.map(markCredentials) };
const markSeen = (s: BrowserControl): BrowserControl => ({ ...s, name: markCredentials(s.name) });

/** The words of a page's report entry, with each sentence that gives a credential replaced by the marker. Run when the page is read. */
export function markCredentialsIn(entry: CrawledPage): void {
  if (entry.title) entry.title = markCredentials(entry.title);
  if (entry.headings) entry.headings = mark(entry.headings);
  if (entry.skippedHeadings) entry.skippedHeadings = mark(entry.skippedHeadings);
  if (entry.structure) entry.structure = { ...entry.structure, h1: entry.structure.h1.map(markCredentials) };
  if (entry.controls) entry.controls = entry.controls.map(markControl);
  if (entry.seen) entry.seen = entry.seen.map(markSeen);
  if (entry.secondLook) entry.secondLook = { headings: entry.secondLook.headings.map(markCredentials) };
  if (entry.late) entry.late = { ...entry.late, seen: entry.late.seen.map(markSeen), ...(entry.late.controls ? { controls: entry.late.controls.map(markControl) } : {}) };
  if (entry.frames) {
    entry.frames = entry.frames.map((f) => ({
      ...f,
      title: f.title === null ? null : markCredentials(f.title),
      ...(f.headings ? { headings: f.headings.map(markCredentials) } : {}),
      ...(f.links ? { links: f.links.map((l) => ({ ...l, text: markCredentials(l.text) })) } : {}),
      ...(f.controls ? { controls: f.controls.map(markControl) } : {}),
    }));
  }
  const { markup, load } = entry;
  if (markup) {
    if (markup.description) markup.description = markCredentials(markup.description);
    for (const key of ['unnamed', 'unlabelled', 'placeholderOnly', 'noAlt', 'noSrc', 'deadAnchors', 'placeholder'] as const) if (markup[key]) markup[key] = markSample(markup[key]);
  }
  if (load) for (const key of ['failed', 'failedElsewhere', 'failedOtherSite', 'scriptErrors', 'scriptErrorsOtherSite', 'scriptErrorsUnknownSource', 'insecure'] as const) if (load[key]) load[key] = markSample(load[key]);
  if (load?.software) markSoftware(load.software);
}

/** The words a page gave away of its software (G-701): a generator or a script's banner is the site's text like any other. */
function markSoftware(software: SoftwareWords): void {
  if (software.generator) software.generator = markCredentials(software.generator);
  if (software.banners) software.banners = mark(software.banners);
}
