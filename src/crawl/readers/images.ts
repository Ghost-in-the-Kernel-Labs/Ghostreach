/**
 * Reader: the images a page shows a visitor (G-737, docs/VISIBILITY-PLAN.md slice 8), for the site probe to ask only those. The
 * network sees every image request, a script's beacon (`new Image().src`) and a 1x1 frame's tracking pixel too: perfectserve.com's
 * audit of 2026-11-11 called a Cloudflare Turnstile beacon "an empty box visitors see". The crawl fetches no image (router.ts), so an
 * image's own box may be empty: what counts is that it is drawn, not its size, nor where it sits (a carousel's next slide is the
 * page's). An image declared 1px each way (a tracking pixel), and every image in a frame a visitor does not see, is not shown.
 * In the page: SELF-CONTAINED: collectShownImages goes to page.evaluate() whole, as its text after READING_SCRIPT, so it uses nothing this file imports or declares beside it (READING_SCRIPT's globals only).
 */
import type { Frame, Page } from 'playwright';
import { READING_SCRIPT } from '../reading-script.js';

/**
 * Runs in the page or a frame: the addresses of the images it draws, absolute: an `<img>`'s chosen source (`currentSrc`, so a
 * `<picture>` or a srcset gives the one asked for), an `<input type=image>`, an SVG `<image>`, and each url of a drawn element's
 * CSS background. None in a frame whose element is not seen (G-737's frame rule), or whose window is 1px. Self-contained for
 * page.evaluate().
 */
function collectShownImages(): string[] {
  const rule = globalThis as unknown as { __suiteBuilderSeen: (el: Element) => boolean; __suiteBuilderShown: (el: Element) => boolean };
  const frameSeen = window === window.top || (window.frameElement ? rule.__suiteBuilderSeen(window.frameElement) : window.innerWidth > 1 && window.innerHeight > 1);
  if (!frameSeen) return [];
  // Drawn: displayed, not transparent, not visibility: hidden (unseen.ts `shown`, the first part of `seen`).
  const drawn = rule.__suiteBuilderShown;
  const pixel = (el: Element) => {
    const w = Number(el.getAttribute('width'));
    const h = Number(el.getAttribute('height'));
    return el.hasAttribute('width') && el.hasAttribute('height') && w <= 1 && h <= 1;
  };
  const out = new Set<string>();
  const add = (url: string | null | undefined) => {
    if (!url) return;
    try {
      const at = new URL(url, document.baseURI);
      if (at.protocol === 'http:' || at.protocol === 'https:') out.add(at.href);
    } catch {
      // not an address
    }
  };
  for (const img of Array.from(document.querySelectorAll('img, input[type="image" i]'))) {
    if (!drawn(img) || pixel(img)) continue;
    add((img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src);
  }
  for (const img of Array.from(document.querySelectorAll('image'))) {
    const href = img.getAttribute('href') ?? img.getAttribute('xlink:href');
    if (drawn(img)) add(href);
  }
  for (const el of Array.from(document.querySelectorAll('*'))) {
    const bg = getComputedStyle(el).backgroundImage;
    if (!bg || bg === 'none' || !drawn(el)) continue;
    for (const m of bg.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) add(m[2]);
  }
  return [...out];
}

/** The images a page shows, in it and in each of its frames (each frame judged by the rule, READING_SCRIPT evaluated with the call). */
export async function readShownImages(page: Page): Promise<string[]> {
  const of = (f: Page | Frame) => f.evaluate(`(() => { ${READING_SCRIPT}; return (${collectShownImages.toString()})(); })()`).catch(() => []) as Promise<string[]>;
  try {
    const all = await Promise.all([page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())].map(of));
    return [...new Set(all.flat())];
  } catch {
    return []; // a page closed under it: none shown, so none asked
  }
}
