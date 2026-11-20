/**
 * The PDF syntax under the tests' PDF reader (test/support/pdf-text.ts, TODO 2.3): the objects of a PDF 1.4 file of plain
 * numbered objects, each stream's bytes decoded (plain or FlateDecode, by Node's zlib), and in a content stream its operators.
 * Split from pdf-text.ts by what it does (a refactor, nothing changed): its limits are that file's header's.
 */
import { inflateSync } from 'node:zlib';

export type Obj = number | string | boolean | null | Ref | Name | Obj[] | Dict | Bytes;
interface Ref { ref: number }
export interface Name { name: string }
interface Bytes { bytes: string }
interface Dict { dict: Map<string, Obj> }

export const isRef = (o: Obj | undefined): o is Ref => typeof o === 'object' && o !== null && 'ref' in o;
export const isDict = (o: Obj | undefined): o is Dict => typeof o === 'object' && o !== null && 'dict' in o;
export const isName = (o: Obj | undefined): o is Name => typeof o === 'object' && o !== null && 'name' in o;
export const isBytes = (o: Obj | undefined): o is Bytes => typeof o === 'object' && o !== null && 'bytes' in o;

const DELIMS = '()<>[]{}/%';
const isSpace = (c: string) => c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f' || c === '\0';

/** A reader of PDF syntax over a latin1 string (one char per byte): objects, and in a content stream, operators. */
export class Lexer {
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
export function objects(file: Buffer): Map<number, { value: Obj; stream?: Buffer }> {
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
