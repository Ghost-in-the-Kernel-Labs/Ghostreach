/**
 * SITE-21: the errors the site's own scripts throw (G-201, G-657, G-734), counted as Ghost ruled on 2026-11-11 (G-742 (3), G-743 (1)):
 * each different message once, a message thrown again said "repeated N times" apart, and a recoverable hydration error (React
 * rendered the page again in the browser: #418, #423, #425) minor. stord.com's audit led with "at least 74 errors" for two React
 * hydration messages one page threw 74 times; quavo.com's "at least 216" was one message on one page.
 */
import type { CrawledPage, Sample } from '../leaf/report.js';
import { componentFinding, type Counting } from './by-component.js';
import { errorItem } from './softer-items.js';
import type { SiteFinding } from './types.js';

/** A script error as said: one thrown with no message (the browser reports "undefined", as on atos.net) is said so. */
const said = (first: string) => (first === '' || first === 'undefined' ? 'an error with no message' : first);

/**
 * React's recoverable hydration errors: the server's HTML did not match what the browser rendered, and React rendered the page
 * again in the browser. Minified (production) as "Minified React error #418;", or in full from a development build.
 */
const HYDRATION = /Minified React error #(418|423|425)\b|Hydration failed because|error while hydrating|Text content does not match server-rendered HTML/;
const isHydration = (message: string) => HYDRATION.test(message);

const COUNTING: Counting = { distinct: { verb: 'threw', noun: ['error', 'errors'] } };

/** A page that answered with content (not an error, not a redirect): only its errors are a visitor's (Q8 of the corpus run). */
const answered = (p: CrawledPage) => p.status !== null && p.status < 300;

const onPages = (m: number) => `on ${m} ${m === 1 ? 'page' : 'pages'}`;

/** SITE-21, minor when every message is a recoverable hydration error, else major. */
// Decision: G-201, G-743
export function scriptErrorFinding(pages: CrawledPage[], readable: (url: string) => boolean = () => false): SiteFinding[] {
  const read = pages.filter(answered);
  const messages = read.flatMap((p) => p.load?.scriptErrors?.first ?? []);
  if (!messages.length) return [];
  const sampleOf = (p: CrawledPage) => p.load?.scriptErrors as Sample | undefined;
  if (messages.every(isHydration)) {
    return componentFinding(read, sampleOf, said, ['recoverable hydration error'], {
      code: 'SITE-21', severity: 'minor',
      title: (count, _n, m) => `The site's own scripts throw ${count} ${onPages(m)}`,
      why: "React found that the page the server sent did not match what the browser rendered (it was hydrating the page), and rendered the page again in the browser. The page works, but it is drawn twice: it shows later, may flash, and can lose what a visitor had started to type. Visitors never report it; it is seen only in the browser's console.",
      fix: "Find what differs between the server's render and the browser's: a date or time, a random value, code that reads the browser (window, localStorage) while rendering, or markup a browser corrects (a div inside a p). React's development build names the element that differs.",
    }, COUNTING, errorItem(readable));
  }
  const found = componentFinding(read, sampleOf, said, ['error'], {
    code: 'SITE-21', severity: 'major',
    title: (count, _n, m) => `The site's own scripts throw ${count} ${onPages(m)}`,
    why: 'An error nothing catches stops the script that threw it: whatever it was doing (a form\'s checks, a cart, tracking) is left undone. Visitors never report it; it is seen only in the browser\'s console.',
    fix: "Open the page with the browser's developer tools, read the console, and fix each error where its stack points.",
  }, COUNTING, errorItem(readable));
  // A hydration error beside others is said as what it is; the finding's weight is the others'.
  const marked = (says: string) => {
    const at = says.search(/, on \d+ pages: /);
    return at < 0 ? `${says} (a recoverable hydration error)` : `${says.slice(0, at)} (a recoverable hydration error)${says.slice(at)}`;
  };
  return found.map((f) => ({ ...f, where: f.where.map((w) => (isHydration(w.says) ? { ...w, says: marked(w.says) } : w)) }));
}
