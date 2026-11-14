/**
 * The tests' PDF reader (TODO 2.3): each page's size and text, out of a PDF the review's Chromium printed, with Node's zlib and
 * nothing installed (no PDF library: RF-03). Enough to say what a page reads, not a PDF parser.
 *
 * What it reads: a PDF 1.4 file of plain numbered objects (Skia's, as Chromium writes it), its pages in the order of the page tree,
 * each page's MediaBox (inherited from the tree too) and its content streams, plain or FlateDecode; the text shown by `Tj`, `TJ`,
 * `'` and `"` in a font whose `/ToUnicode` CMap names each code (`bfchar` and `bfrange`, of the width its `codespacerange` says),
 * Type 3, simple and Type 0 (CID) fonts alike. Chromium draws no glyph for a space, and places glyph by glyph with `Td`, so a space
 * is put back where a glyph starts more than a fifth of the font size past where the last one ended (its width from the font's
 * `/Widths` or `/W`), and a line break where the baseline moves or the pen goes back.
 *
 * Its limits: no object streams or cross-reference streams (PDF 1.5's compression; Chromium writes neither), no encryption, no
 * filter but FlateDecode, no text inside a form XObject (`Do`), a code with no ToUnicode entry dropped, and positions read in text
 * space assuming the text matrix does not scale (Chromium's `Tm` is `1 0 0 -1 x y`). Spaces and line breaks are inferred, so a test
 * matches a heading's words in order, not its exact spacing, when it can (`squeezed`).
 */
import { inflateSync } from 'node:zlib';

type Obj = number | string | boolean | null | Ref | Name | Obj[] | Dict | Bytes;
interface Ref { ref: number }
interface Name { name: string }
interface Bytes { bytes: string }
interface Dict { dict: Map<string, Obj> }

/** One page of a PDF: its size in points and its text, one line of the page per line of text. */
export interface PdfPage {
  width: number;
  height: number;
  text: string;
}

const isRef = (o: Obj | undefined): o is Ref => typeof o === 'object' && o !== null && 'ref' in o;
const isDict = (o: Obj | undefined): o is Dict => typeof o === 'object' && o !== null && 'dict' in o;
const isName = (o: Obj | undefined): o is Name => typeof o === 'object' && o !== null && 'name' in o;
const isBytes = (o: Obj | undefined): o is Bytes => typeof o === 'object' && o !== null && 'bytes' in o;

const DELIMS = '()<>[]{}/%';
const isSpace = (c: string) => c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f' || c === '\0';

/** A reader of PDF syntax over a latin1 string (one char per byte): objects, and in a content stream, operators. */
class Lexer {
  readonly s: string;
  i: number;
  constructor(s: string, i = 0) {
    this.s = s;
    this.i = i;
  }

  private skip(): void {
    while (this.i < this.s.length) {
      if (isSpace(this.s[this.i])) this.i++;
      else if (this.s[this.i] === '%') while (this.i < this.s.length && this.s[this.i] !== '\n' && this.s[this.i] !== '\r') this.i++;
      else return;
    }
  }

  private word(): string {
    const start = this.i;
    while (this.i < this.s.length && !isSpace(this.s[this.i]) && !DELIMS.includes(this.s[this.i])) this.i++;
    return this.s.slice(start, this.i);
  }

  private literal(): string {
    let depth = 1;
    let out = '';
    this.i++;
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === '\\') {
        const e = this.s[this.i++];
        const simple: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
        if (e in simple) out += simple[e];
        else if (/[0-7]/.test(e)) {
          let oct = e;
          while (oct.length < 3 && /[0-7]/.test(this.s[this.i])) oct += this.s[this.i++];
          out += String.fromCharCode(parseInt(oct, 8) & 0xff);
        } else if (e !== '\n' && e !== '\r') out += e;
      } else if (c === '(') {
        depth++;
        out += c;
      } else if (c === ')') {
        if (--depth === 0) return out;
        out += c;
      } else out += c;
    }
    return out;
  }

  /** The next token: an object, or (in a content stream) an operator as `{ op }`; undefined at the end. */
  next(): Obj | { op: string } | undefined {
    this.skip();
    if (this.i >= this.s.length) return undefined;
    const c = this.s[this.i];
    if (c === '/') {
      this.i++;
      return { name: this.word().replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))) };
    }
    if (c === '(') return { bytes: this.literal() };
    if (c === '<' && this.s[this.i + 1] === '<') {
      this.i += 2;
      const dict = new Map<string, Obj>();
      for (;;) {
        this.skip();
        if (this.s.startsWith('>>', this.i)) {
          this.i += 2;
          return { dict };
        }
        const key = this.next();
        if (!isName(key as Obj)) throw new Error(`a dictionary key that is not a name at ${this.i}`);
        dict.set((key as Name).name, this.value());
      }
    }
    if (c === '<') {
      const end = this.s.indexOf('>', this.i);
      const hex = this.s.slice(this.i + 1, end).replace(/\s/g, '');
      this.i = end + 1;
      const even = hex.length % 2 ? `${hex}0` : hex;
      return { bytes: even.replace(/../g, (h) => String.fromCharCode(parseInt(h, 16))) };
    }
    if (c === '[') {
      this.i++;
      const items: Obj[] = [];
      for (;;) {
        this.skip();
        if (this.s[this.i] === ']') {
          this.i++;
          return items;
        }
        items.push(this.value());
      }
    }
    if (c === ']' || c === '>' || c === ')' || c === '{' || c === '}') {
      this.i++;
      return { op: c };
    }
    const w = this.word();
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) {
      // `n g R` is a reference: look ahead without consuming when it is not.
      const back = this.i;
      const m = /^\s+(\d+)\s+R(?![^\s()<>[\]{}/%])/.exec(this.s.slice(this.i, this.i + 24));
      if (/^\d+$/.test(w) && m) {
        this.i += m[0].length;
        return { ref: Number(w) };
      }
      this.i = back;
      return Number(w);
    }
    if (w === 'true' || w === 'false') return w === 'true';
    if (w === 'null') return null;
    return { op: w };
  }

  /** The next token, which must be an object. */
  value(): Obj {
    const t = this.next();
    if (t === undefined || (typeof t === 'object' && t !== null && 'op' in t)) throw new Error(`an object expected at ${this.i}`);
    return t;
  }
}

/** The file's objects by number, a stream's decoded bytes beside its dictionary. */
function objects(file: Buffer): Map<number, { value: Obj; stream?: Buffer }> {
  const s = file.toString('latin1');
  const out = new Map<number, { value: Obj; stream?: Buffer }>();
  const head = /(\d+)\s+\d+\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = head.exec(s))) {
    const lexer = new Lexer(s, m.index + m[0].length);
    const value = lexer.value();
    const after = /^\s*stream\r?\n/.exec(s.slice(lexer.i, lexer.i + 16));
    if (!after || !isDict(value)) {
      out.set(Number(m[1]), { value });
      continue;
    }
    const start = lexer.i + after[0].length;
    const length = value.dict.get('Length');
    // An indirect length is read once its object is in (Chromium writes it direct); else the stream ends at `endstream`.
    const len = typeof length === 'number' ? length : s.indexOf('endstream', start) - start;
    const raw = file.subarray(start, start + len);
    const filter = value.dict.get('Filter');
    const filters = (Array.isArray(filter) ? filter : filter === undefined ? [] : [filter]).map((f) => (isName(f) ? f.name : ''));
    const stream = filters.length === 0 ? raw : filters.every((f) => f === 'FlateDecode') ? filters.reduce((b) => inflateSync(b), raw) : undefined;
    out.set(Number(m[1]), { value, stream });
    head.lastIndex = start + len;
  }
  return out;
}

/** A font as the text needs it: how many bytes a code takes, each code's text, and its width per unit of font size. */
interface Font {
  bytes: number;
  unicode: Map<number, string>;
  width: (code: number) => number;
}

const utf16 = (b: string): string => {
  let out = '';
  for (let i = 0; i + 1 < b.length; i += 2) out += String.fromCharCode((b.charCodeAt(i) << 8) | b.charCodeAt(i + 1));
  return out;
};
const code = (b: string): number => [...b].reduce((n, c) => n * 256 + c.charCodeAt(0), 0);

/** A ToUnicode CMap: the code width and each code's text. */
function toUnicode(cmap: string): { bytes: number; unicode: Map<number, string> } {
  const unicode = new Map<number, string>();
  const lexer = new Lexer(cmap);
  const stack: Obj[] = [];
  let bytes = 1;
  let mode = '';
  for (let t = lexer.next(); t !== undefined; t = lexer.next()) {
    if (typeof t === 'object' && t !== null && 'op' in t) {
      if (/^begin(codespacerange|bfchar|bfrange)$/.test(t.op)) {
        mode = t.op;
        stack.length = 0;
      } else if (t.op === 'endcodespacerange') {
        if (isBytes(stack[0])) bytes = stack[0].bytes.length;
      } else if (t.op === 'endbfchar') {
        for (let i = 0; i + 1 < stack.length; i += 2) {
          const [src, dst] = [stack[i], stack[i + 1]];
          if (isBytes(src) && isBytes(dst)) unicode.set(code(src.bytes), utf16(dst.bytes));
        }
      } else if (t.op === 'endbfrange') {
        for (let i = 0; i + 2 < stack.length; i += 3) {
          const [lo, hi, dst] = [stack[i], stack[i + 1], stack[i + 2]];
          if (!isBytes(lo) || !isBytes(hi)) continue;
          for (let c = code(lo.bytes); c <= code(hi.bytes); c++) {
            const k = c - code(lo.bytes);
            if (Array.isArray(dst)) {
              const d = dst[k];
              if (isBytes(d)) unicode.set(c, utf16(d.bytes));
            } else if (isBytes(dst)) {
              const base = utf16(dst.bytes);
              unicode.set(c, base.slice(0, -1) + String.fromCharCode(base.charCodeAt(base.length - 1) + k));
            }
          }
        }
      }
      if (!mode.startsWith('begin') || t.op.startsWith('end')) mode = '';
      continue;
    }
    stack.push(t);
  }
  return { bytes, unicode };
}

/**
 * Each page's size and text, in page order.
 */
export function pdfPages(file: Buffer): PdfPage[] {
  const objs = objects(file);
  const get = (o: Obj | undefined): Obj | undefined => {
    for (let n = 0; isRef(o) && n < 32; n++) o = objs.get(o.ref)?.value;
    return o;
  };
  const dictOf = (o: Obj | undefined): Map<string, Obj> => {
    const d = get(o);
    return isDict(d) ? d.dict : new Map();
  };
  const streamOf = (o: Obj | undefined): Buffer | undefined => (isRef(o) ? objs.get(o.ref)?.stream : undefined);
  const nums = (o: Obj | undefined): number[] => {
    const a = get(o);
    return Array.isArray(a) ? a.map((x) => get(x)).map((x) => (typeof x === 'number' ? x : 0)) : [];
  };

  const fonts = new Map<number, Font>();
  const font = (o: Obj | undefined): Font | undefined => {
    if (!isRef(o)) return undefined;
    const known = fonts.get(o.ref);
    if (known) return known;
    const d = dictOf(o);
    const cmap = streamOf(d.get('ToUnicode'));
    const { bytes, unicode } = cmap ? toUnicode(cmap.toString('latin1')) : { bytes: 1, unicode: new Map<number, string>() };
    const subtype = get(d.get('Subtype'));
    let width: (code: number) => number = () => 0;
    if (isName(subtype) && subtype.name === 'Type0') {
      const descendants = get(d.get('DescendantFonts'));
      const cid = dictOf(Array.isArray(descendants) ? descendants[0] : undefined);
      const dw = get(cid.get('DW'));
      const widths = new Map<number, number>();
      const w = get(cid.get('W'));
      if (Array.isArray(w)) {
        for (let i = 0; i < w.length; ) {
          const first = get(w[i]) as number;
          const next = get(w[i + 1]);
          if (Array.isArray(next)) {
            next.forEach((x, k) => widths.set(first + k, get(x) as number));
            i += 2;
          } else {
            for (let c = first; c <= (next as number); c++) widths.set(c, get(w[i + 2]) as number);
            i += 3;
          }
        }
      }
      width = (c) => (widths.get(c) ?? (typeof dw === 'number' ? dw : 1000)) / 1000;
    } else {
      const first = get(d.get('FirstChar'));
      const widths = nums(d.get('Widths'));
      const matrix = nums(d.get('FontMatrix'));
      const scale = isName(subtype) && subtype.name === 'Type3' && matrix.length ? Math.abs(matrix[0]) : 1 / 1000;
      width = (c) => (widths[c - (typeof first === 'number' ? first : 0)] ?? 0) * scale;
    }
    const made = { bytes, unicode, width };
    fonts.set(o.ref, made);
    return made;
  };

  // The pages, in the tree's order, each with what it inherits.
  const pages: { page: Map<string, Obj>; inherited: Map<string, Obj> }[] = [];
  const walk = (node: Obj | undefined, inherited: Map<string, Obj>, depth: number) => {
    const d = dictOf(node);
    const here = new Map(inherited);
    for (const key of ['Resources', 'MediaBox']) if (d.has(key)) here.set(key, d.get(key) as Obj);
    const type = get(d.get('Type'));
    if (isName(type) && type.name === 'Pages' && depth < 32) {
      const kids = get(d.get('Kids'));
      for (const kid of Array.isArray(kids) ? kids : []) walk(kid, here, depth + 1);
    } else pages.push({ page: d, inherited: here });
  };
  const catalog = [...objs.values()].find(({ value }) => isDict(value) && isName(value.dict.get('Type')) && (value.dict.get('Type') as Name).name === 'Catalog');
  if (catalog && isDict(catalog.value)) walk(catalog.value.dict.get('Pages'), new Map(), 0);

  return pages.map(({ page, inherited }) => {
    const box = nums(inherited.get('MediaBox'));
    const fontDict = dictOf(dictOf(inherited.get('Resources')).get('Font'));
    const contents = get(page.get('Contents'));
    const streams = (Array.isArray(contents) ? contents : [page.get('Contents')]).map(streamOf).filter((b): b is Buffer => !!b);
    return { width: (box[2] ?? 0) - (box[0] ?? 0), height: (box[3] ?? 0) - (box[1] ?? 0), text: pageText(Buffer.concat(streams.flatMap((b) => [b, Buffer.from('\n')])).toString('latin1'), (n) => font(fontDict.get(n))) };
  });
}

/** The text a content stream shows, spaces and line breaks put back from where each glyph is drawn. */
function pageText(content: string, fontNamed: (name: string) => Font | undefined): string {
  const lexer = new Lexer(content);
  const operands: Obj[] = [];
  let out = '';
  let f: Font | undefined;
  let size = 0;
  let charSpace = 0;
  let wordSpace = 0;
  let leading = 0;
  // The text line matrix [a b c d e f], the pen's distance along the line in text space, and where the last glyph ended (user
  // space before the page's own `cm`), or null before the first.
  let m = [1, 0, 0, 1, 0, 0];
  let pen = 0;
  let last: { x: number; y: number } | null = null;
  const at = () => ({ x: m[4] + pen * m[0], y: m[5] + pen * m[1] });
  const show = (b: string) => {
    if (!f) return;
    const unit = size * Math.hypot(m[0], m[1]);
    for (let i = 0; i + f.bytes <= b.length; i += f.bytes) {
      const c = code(b.slice(i, i + f.bytes));
      const text = f.unicode.get(c) ?? '';
      const here = at();
      if (last && text) {
        if (Math.abs(here.y - last.y) > unit / 2 || here.x < last.x - unit) out += '\n';
        else if (here.x - last.x > unit / 5 && !/\s$/.test(out)) out += ' ';
      }
      out += text;
      pen += f.width(c) * size + charSpace + (f.bytes === 1 && c === 32 ? wordSpace : 0);
      if (text) last = at();
    }
  };
  const nextLine = (tx: number, ty: number) => {
    m = [m[0], m[1], m[2], m[3], tx * m[0] + ty * m[2] + m[4], tx * m[1] + ty * m[3] + m[5]];
    pen = 0;
  };
  for (let t = lexer.next(); t !== undefined; t = lexer.next()) {
    if (!(typeof t === 'object' && t !== null && 'op' in t)) {
      operands.push(t);
      continue;
    }
    const n = (k: number) => (typeof operands[k] === 'number' ? (operands[k] as number) : 0);
    switch (t.op) {
      case 'BT':
        m = [1, 0, 0, 1, 0, 0];
        pen = 0;
        break;
      case 'Tf':
        f = isName(operands[0]) ? fontNamed(operands[0].name) : undefined;
        size = Math.abs(n(1));
        break;
      case 'Tc':
        charSpace = n(0);
        break;
      case 'Tw':
        wordSpace = n(0);
        break;
      case 'TL':
        leading = n(0);
        break;
      case 'Td':
        nextLine(n(0), n(1));
        break;
      case 'TD':
        leading = -n(1);
        nextLine(n(0), n(1));
        break;
      case 'Tm':
        m = [0, 1, 2, 3, 4, 5].map(n);
        pen = 0;
        break;
      case 'T*':
        nextLine(0, -leading);
        break;
      case 'Tj':
        if (isBytes(operands[0])) show(operands[0].bytes);
        break;
      case "'":
        nextLine(0, -leading);
        if (isBytes(operands[0])) show(operands[0].bytes);
        break;
      case '"':
        wordSpace = n(0);
        charSpace = n(1);
        nextLine(0, -leading);
        if (isBytes(operands[2])) show(operands[2].bytes);
        break;
      case 'TJ':
        for (const item of Array.isArray(operands[0]) ? operands[0] : []) {
          if (isBytes(item)) show(item.bytes);
          else if (typeof item === 'number') pen -= (item / 1000) * size;
        }
        break;
    }
    operands.length = 0;
  }
  return out;
}

/** A text with every run of white space made one space, for matching a heading whose line breaks the page chose. */
export const squeezed = (text: string): string => text.replace(/\s+/g, ' ').trim();
