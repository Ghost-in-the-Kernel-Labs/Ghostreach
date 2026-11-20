/**
 * The live secret scanner (src/pages/secret-shapes.ts) held to the scanner as it was before its candidate gate
 * (test/support/secret-shapes-before-gate.ts, frozen): the same findings, the same masked text, on a generated corpus of every
 * shape's keys and near misses, each embedded at random places in filler, and on the hostile runs. A scanner that misses a key is
 * the failure that matters: a gate may only skip a pattern that cannot match, and this test is what says it did not skip one that could.
 * Every made-up key is written in pieces, so a scan of this repository's files never stops on its own fixtures.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { findSecrets as findBefore, maskSecrets as maskBefore } from '../support/secret-shapes-before-gate.js';
import { maskSecrets } from '../../src/leaf/pages/secret-shapes.js';
import { MADE_UP_KEYS } from '../support/made-up-keys.js';

const x = (n: number, c = 'a') => c.repeat(n);
const up = (n: number) => x(n, 'Q');
const dig = (n: number) => '7'.repeat(n);

/** Each case: what it is, and a text that holds a key of the shape or just misses one (the bound, the boundary, the wrong case). */
const CASES: [string, string][] = [
  ['Anthropic at its least', `sk-${'ant'}-${x(20)}`], ['Anthropic one short', `sk-${'ant'}-${x(19)}`], ['Anthropic after a word character', `Xsk-${'ant'}-${x(30)}`],
  ['Anthropic upper case', `SK-${'ANT'}-${x(30)}`], ['Anthropic with a dash tail', `sk-${'ant'}-${x(10)}-_-${x(10)}`],
  ['OpenAI project', `sk-proj-${x(20)}`], ['OpenAI project one short', `sk-proj-${x(19)}`], ['OpenAI plain at its least', `sk-${x(32)}`], ['OpenAI plain one short', `sk-${x(31)}`],
  ['OpenAI plain then an underscore', `sk-${x(32)}_`], ['OpenAI svcacct', `sk-svcacct-${x(25)}`], ['OpenAI None', `sk-None-${x(25)}`],
  ['AWS AKIA', `AK${'IA'}${up(16)}`], ['AWS 15', `AK${'IA'}${up(15)}`], ['AWS 17', `AK${'IA'}${up(17)}`], ['AWS ASIA', `AS${'IA'}${dig(16)}`], ['AWS ABIA', `AB${'IA'}${up(16)}`],
  ['AWS ACCA', `AC${'CA'}${up(16)}`], ['AWS lower case', `ak${'ia'}${up(16)}`],
  ['Google AIza', `AI${'za'}${x(35)}`], ['Google AIza 34', `AI${'za'}${x(34)}`], ['Google GOCSPX', `GOCS${'PX'}-${x(20)}`], ['Google GOCSPX 19', `GOCS${'PX'}-${x(19)}`],
  ['Google ya29', `ya${'29'}.${x(20)}`], ['Google ya29 19', `ya${'29'}.${x(19)}`], ['Google ya29 no dot', `ya${'29'}x${x(25)}`],
  ['GitHub ghp', `gh${'p'}_${x(36, 'F')}`], ['GitHub ghp 35', `gh${'p'}_${x(35, 'F')}`], ['GitHub gho', `gh${'o'}_${x(40, 'F')}`], ['GitHub ghu', `gh${'u'}_${x(36, 'F')}`],
  ['GitHub ghs', `gh${'s'}_${x(36, 'F')}`], ['GitHub ghr', `gh${'r'}_${x(36, 'F')}`], ['GitHub ghx', `gh${'x'}_${x(40, 'F')}`], ['GitHub pat', `github_${'pat'}_${x(22)}`], ['GitHub pat 21', `github_${'pat'}_${x(21)}`],
  ['npm', `np${'m_'}${x(36)}`], ['npm 35', `np${'m_'}${x(35)}`], ['npm 37', `np${'m_'}${x(37)}`],
  ['Slack xoxb', `xo${'xb'}-${x(10)}`], ['Slack xoxz', `xo${'xz'}-${x(10)}`], ['Slack xoxe', `xo${'xe'}-1234567890-abc`], ['Slack xoxb 9', `xo${'xb'}-${x(9)}`],
  ['Slack webhook', `hooks.sl${'ack.com'}/services/T${x(9, 'B')}/B${x(9, 'C')}/${x(8, 'd')}`], ['Slack webhook short', `hooks.sl${'ack.com'}/services/T${x(9, 'B')}/B${x(9, 'C')}/${x(7, 'd')}`],
  ['Stripe sk live', `s${'k'}_li${'ve'}_${x(16)}`], ['Stripe sk test', `s${'k'}_te${'st'}_${x(16)}`], ['Stripe rk live', `r${'k'}_li${'ve'}_${x(16)}`], ['Stripe 15', `s${'k'}_li${'ve'}_${x(15)}`],
  ['Stripe whsec', `whs${'ec'}_${x(24)}`], ['Stripe whsec 23', `whs${'ec'}_${x(23)}`], ['Stripe sk dev', `s${'k'}_de${'v'}_${x(30)}`],
  ['Atlassian', `ATA${'TT3'}${x(40)}`], ['Atlassian 39', `ATA${'TT3'}${x(39)}`], ['Atlassian with equals', `ATA${'TT3'}${x(40)}=ABC`],
  ['HuggingFace', `h${'f_'}${x(30)}`], ['HuggingFace 29', `h${'f_'}${x(29)}`], ['HuggingFace after a word', `xh${'f_'}${x(34)}`], ['HuggingFace then underscore', `h${'f_'}${x(34)}_`],
  ['GitLab', `gl${'pat-'}${x(20)}`], ['GitLab 19', `gl${'pat-'}${x(19)}`], ['GitLab dash tail', `gl${'pat-'}${x(10)}-${x(10)}-`],
  ['private key whole', MADE_UP_KEYS['private key']], ['private key cut off', `-----${'BEGIN'} PRIVATE KEY-----\nMIIE${x(30)}\n<p>x</p>`], ['private key encoded', `-----${'BEGIN'}%20RSA%20PRIVATE%20KEY-----${x(30)}`],
  ['private key plus-encoded', `-----${'BEGIN'}+EC+PRIVATE+KEY-----${x(30)}`], ['private key lower case', `-----${'begin'} PRIVATE KEY-----${x(30)}`], ['private key no PRIVATE', `-----${'BEGIN'} PUBLIC KEY-----${x(30)}`],
  ['private key BLOCK', `-----${'BEGIN'} ENCRYPTED PRIVATE KEY BLOCK-----${x(30)}`], ['private key two blocks', `-----${'BEGIN'} PRIVATE KEY-----${x(30)}\n-----${'BEGIN'} PRIVATE KEY-----${x(30)}`],
  ['private key first line alone', `-----${'BEGIN'} PRIVATE KEY-----`],
  ['JWT whole', MADE_UP_KEYS.JWT], ['JWT first part 7', `ey${'J'}${x(7)}.ey${'J'}${x(8)}.sig`], ['JWT empty third', `ey${'J'}${x(8)}.ey${'J'}${x(8)}.`], ['JWT two parts', `ey${'J'}${x(8)}.ey${'J'}${x(8)}`],
  ['JWT after a word', `Xey${'J'}${x(8)}.ey${'J'}${x(8)}.sig`],
  ['bearer', `Bear${'er'} ${x(16)}`], ['bearer 15', `Bear${'er'} ${x(15)}`], ['bearer with equals', `Bear${'er'} ${x(16)}==`], ['bearer tab', `Bear${'er'}\t${x(20)}`],
  ['bearer four spaces', `Bear${'er'}    ${x(20)}`], ['bearer five spaces', `Bear${'er'}     ${x(20)}`], ['bearer lower case', `bear${'er'} ${x(20)}`], ['bearer glued', `Xbear${'er'} ${x(20)}`],
  ['bearer marks', `Bear${'er'} a.b~c+d/e-${x(5)}`], ['bearer no space', `Bear${'er'}${x(20)}`],
  ['named key', `api_key=${x(12)}12345${x(6, 'Z')}`], ['named upper case', `API_KEY=${x(12)}12345${x(6, 'Z')}`], ['named token quoted', `{"accessToken": "${x(12)}12345${x(6, 'Z')}"}`],
  ['named session', `<div data-session="${x(12)}12345${x(6, 'Z')}">`], ['named colon', `Token: ${x(12)}12345${x(6, 'Z')}`], ['named password', `passw${'ord'}=${x(12)}12345${x(6, 'Z')}`],
  ['named pwd', `pwd=${x(12)}12345${x(6, 'Z')}`], ['named authorization', `Authorization: ${x(12)}12345${x(6, 'Z')}`], ['named secrets plural', `secrets=${x(12)}12345${x(6, 'Z')}`],
  ['named credential', `credential="${x(12)}12345${x(6, 'Z')}"`], ['named signature', `signature=${x(12)}12345${x(6, 'Z')}`], ['named csrf', `csrf = ${x(12)}12345${x(6, 'Z')}`],
  ['named xsrf spaces', `xsrf   :   ${x(12)}12345${x(6, 'Z')}`], ['named four spaces', `key:    ${x(12)}12345${x(6, 'Z')}`], ['named no digit', `api_key=${x(30)}`], ['named no letter', `api_key=${dig(30)}`],
  ['named 15 long', `api_key=${x(10)}12345`], ['named 16 long', `api_key=${x(11)}12345`], ['named with padding', `api_key=${x(12)}12345${x(6, 'Z')}==`],
  ['named far word', `${x(41, 'w')}key=${x(12)}12345${x(6, 'Z')}`], ['named 40 word chars', `${x(40, 'w')}key=${x(12)}12345${x(6, 'Z')}`], ['named is the marker', 'token=secret-removed'],
  ['named numbered marker', 'token=secret-removed-2'], ['named keyboard', `key${'board'}=ArrowDownNavigation1`], ['named long run mixed', `session=${x(10)}${dig(10)}.${x(10)}/${x(10)}+`],
  ['named equals alone', `x = ${x(12)}12345${x(6, 'Z')}`], ['named colon alone', `a: ${x(12)}12345${x(6, 'Z')}`],
  ['plain prose', 'The key to the library. Token of thanks. Your password is required. Session ends in 10 minutes.'],
  ['a commit and a colour', 'commit a94a8fe5ccb19ba61c4c0873d391e987982fbbd3 color: #a94a8f'],
  ['the marker', 'secret-removed secret-removed-2 token=secret-removed'], ['nothing', ''],
  ...Object.entries(MADE_UP_KEYS).map(([shape, key]): [string, string] => [`made up: ${shape}`, key]),
];

const FILLERS = [
  ' ', '\n', '<p>some words, then more words</p>', 'a=b&c=d: e; f', ' key = token : secret ', '"', "'", 'Bear', 'sk-', 'sk-ant', 'hf', 'gh', 'eyJ', 'AKI', '-----BEGIN', 'xox', 'ya29', 'AIz', 'npm', 'whsec', 'ATATT', 'glpat',
  'authorization', 'x'.repeat(50), '9'.repeat(30), '-_.', '=', ':',
];

/** A small seeded generator, so a failure is the same failure on the next run. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function filler(rand: () => number, parts: number): string {
  let out = '';
  for (let i = 0; i < parts; i++) out += FILLERS[Math.floor(rand() * FILLERS.length)];
  return out;
}

/**
 * What the live scanner must say the way the frozen one does: the masked text, the numbered marker's too. The parent compared every
 * finding too (`findSecrets`); the live one was cut at 1.2, nothing of the review lists findings, so the masked text is what is held.
 */
function expectSame(text: string, what: string): void {
  expect(maskSecrets(text), `mask: ${what}`).toBe(maskBefore(text));
  let n = 0;
  const numbered = (s: string) => `m${s.length}-${++n}`;
  const live = maskSecrets(text, numbered);
  n = 0;
  expect(live, `mask, each its own marker: ${what}`).toBe(maskBefore(text, numbered));
}

describe('the live scanner says what the scanner before its gate said (differential)', () => {
  it('every case alone, at the start, at the end, and between filler', () => {
    for (const [what, key] of CASES) {
      expectSame(key, what);
      expectSame(`${key} tail`, `${what}, then a tail`);
      expectSame(`head ${key}`, `${what}, after a head`);
      expectSame(`<p>${key}</p>`, `${what}, in a tag`);
      expectSame(`"${key}"`, `${what}, quoted`);
    }
  });

  it('every case at random places in random filler (seeded), single and several together', () => {
    const rand = lcg(20261106);
    let withFindings = 0;
    for (let round = 0; round < 6; round++) {
      for (const [what, key] of CASES) {
        const text = `${filler(rand, 1 + Math.floor(rand() * 8))}${key}${filler(rand, Math.floor(rand() * 8))}`;
        expectSame(text, `${what}, round ${round}`);
        if (findBefore(text).length > 0) withFindings++;
      }
      let several = '';
      for (let i = 0; i < 6; i++) several += filler(rand, 3) + CASES[Math.floor(rand() * CASES.length)][1];
      expectSame(several, `six cases together, round ${round}`);
    }
    // The corpus is not all near misses: a good part of it is keys the scanner must find.
    expect(withFindings).toBeGreaterThan(250);
  });

  it('all the cases in one text, in both orders, each filler between', () => {
    const all = CASES.map((c) => c[1]);
    expectSame(all.join(' '), 'all together');
    expectSame([...all].reverse().join('\n'), 'all together, reversed');
    expectSame(all.join(''), 'all together, glued');
  });

  it('each shape found where only its literal is in the text: the gate keeps what a literal-less text cannot hold', () => {
    // Every key of the made-up list is found, and found by the shape it is for, before and after.
    for (const [shape, key] of Object.entries(MADE_UP_KEYS)) {
      expect(maskSecrets(`a ${key} b`), shape).not.toBe(`a ${key} b`);
      expectSame(`a ${key} b`, shape);
    }
  });

  it('the hostile runs, a tenth the size of the 10 MB ones and the megabyte ones: the same, whole', () => {
    const n = 100_000;
    const hostile: Record<string, string> = {
      'secret word again and again': 'key='.repeat(n / 4), 'private key first line again and again': `-----${'BEGIN'} PRIVATE KEY-----!`.repeat(n / 30),
      'private key then key': `-----${'BEGIN'} PRIVATE KEY-----${x(n, 'A')}`, 'Bearer then spaces': `Bearer${' '.repeat(n)}x`, 'JWT first part again and again': `${'ey'}Jaaaaaaaa.`.repeat(n / 12),
      'HuggingFace run': `${'hf'}_${x(n)}_`, 'GitLab run': `${'glpat'}-${x(n)}!`, 'Anthropic run': `sk-ant-${x(n)}_`, 'OpenAI run': `sk-${x(n)}_`,
      'name and password, no host': `//${x(n / 2, 'u')}:${x(n / 2, 'p')}`, 'named value': `api_key=${'a1'.repeat(n / 2)}`, 'address with no end': `//${'a:'.repeat(n / 2)}`,
      'parameters': '?a&amp;token'.repeat(n / 12), 'encoded value': `?token=${'%41'.repeat(n / 3)}`, 'quoted secret never ends': `api_key="${x(n)}`,
      'GitHub run': `gh${'p'}_${x(n)}`, 'Bearer run': `Bearer ${'a1'.repeat(n / 2)}`, 'clean': 'x '.repeat(n / 2),
    };
    for (const [what, text] of Object.entries(hostile)) expectSame(`<p>before</p>${text}<p>after</p>`, what);
  });

  it('runs past the longest run an engine reads (1 MB and over): the oversize path says the same', () => {
    for (const [what, text] of Object.entries({ HuggingFace: `${'hf'}_${x(1_200_000)}`, 'a named value': `api_key=${'a1'.repeat(600_000)}`, Bearer: `Bearer ${x(1_200_000)}`, clean: 'x '.repeat(600_000) })) {
      expectSame(`aaaaa ${MADE_UP_KEYS['npm token']} ${text} tail`, what);
    }
  });
});

describe('the oversize path (a run the engine cannot read: about 6 MB and over), taken and compared', () => {
  const SEVEN_MB = 7_000_000;
  const EDGES = 'é\u{1F600} \u0000'; // non-ASCII, a surrogate pair, a space and a NUL: none is in a run

  it('a 7 MB run of every character a run holds, between edges that are none of them: the oversize path says what the scanner before the gate said', () => {
    const text = `${EDGES}${'hf'}_${x(SEVEN_MB)}aZ09+/_.=-b${EDGES} tail`;
    // The frozen scanner takes the oversize path here, and the live one says what it says.
    expect(findBefore(text).some((f) => f.shape === 'oversize run')).toBe(true);
    expectSame(text, 'a run of every run character');
  }, 60_000);

  it('a 7 MB vendor run with a NUL and a surrogate pair at its edges', () => {
    const text = `é ${'hf'}_${x(SEVEN_MB)}\u0000\u{1F600} tail`;
    expect(findBefore(text).some((f) => f.shape === 'oversize run')).toBe(true);
    expectSame(text, 'a vendor run');
  }, 60_000);
});

describe('the frozen copy stays frozen', () => {
  it('holds none of the gate (needs, mayMatch, RUN_CHARS) and exports what the differential test uses', async () => {
    const source = readFileSync(join(__dirname, '../support/secret-shapes-before-gate.ts'), 'utf8');
    for (const token of ['needs', 'mayMatch', 'RUN_CHARS', 'NAMED_NEEDS']) expect(source, token).not.toContain(token);
    const exported = [...source.matchAll(/^export (?:async )?(?:function|const|class|interface|type) (\w+)/gm)].map((m) => m[1]).sort();
    expect(exported).toEqual(['MarkerFor', 'findSecrets', 'maskSecrets']);
  });
});

describe('the cost of a 10 MB read is bounded by its candidates, not by its size (the gate)', () => {
  /** How many patterns `read` runs over the text: each matchAll and each replace by a pattern is one pass over the whole of it. */
  function passes(read: () => unknown): number {
    const matchAll = vi.spyOn(String.prototype, 'matchAll');
    const replace = vi.spyOn(String.prototype, 'replace');
    try {
      read();
      return matchAll.mock.calls.length + replace.mock.calls.filter(([pattern]) => pattern instanceof RegExp).length;
    } finally {
      matchAll.mockRestore();
      replace.mockRestore();
    }
  }
  const TEN_MB = 10_000_000;

  it('a text with no literal any shape needs is read by no pattern; the scanner before the gate read it by fifteen', () => {
    const text = 'x '.repeat(TEN_MB / 2);
    expect(passes(() => maskSecrets(text))).toBe(0);
    expect(passes(() => findBefore(text))).toBe(15);
  });

  it('reads 10 MB of each hostile run under a generous CPU bound, and says what it cost', () => {
    const runs: Record<string, string> = { HuggingFace: `${'hf'}_${x(TEN_MB)}`, 'a named value': `api_key=${'a1'.repeat(TEN_MB / 2)}`, 'a bearer token': `Bearer ${'a1'.repeat(TEN_MB / 2)}`, clean: 'x '.repeat(TEN_MB / 2) };
    const cost: string[] = [];
    for (const [what, run] of Object.entries(runs)) {
      const text = `<p>before</p>${run}<p>after</p>`;
      const cpu = process.cpuUsage();
      maskSecrets(text);
      const used = process.cpuUsage(cpu);
      const ms = Math.round((used.user + used.system) / 1000);
      cost.push(`${what}: ${ms} ms CPU`);
      // About 0.3 s of CPU on a quiet machine (0.5 s before the gate): the bound is for a read that goes per character, not a timing.
      expect(ms, what).toBeLessThan(5000);
    }
    console.log(`10 MB mask, ${cost.join('; ')}`);
  });
});
