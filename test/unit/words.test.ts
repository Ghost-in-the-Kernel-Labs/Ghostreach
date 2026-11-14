import { describe, expect, it } from 'vitest';
import { BANNED_PHRASES, REVIEW_WORDS, bannedIn } from '../../src/leaf/words.js';

describe('the words a prospect may read (P-08)', () => {
  it('passes a sentence written in the review vocabulary', () => {
    expect(bannedIn('The review lists 3 major findings and 2 minor findings. Nothing to report on the sitemap.')).toEqual([]);
  });
  it('names every banned phrase a sentence carries, in catalogue order', () => {
    expect(bannedIn('We ran a scan and found defects; here is what is wrong.')).toEqual(['what is wrong', 'defects', 'scan']);
  });
  it('matches a phrase whole, so a word inside another word is not a hit', () => {
    expect(bannedIn('The scanner vocabulary is kept out; a scandal is a different word.')).toEqual([]);
    expect(bannedIn('Problematic markup')).toEqual([]);
  });
  it('matches without regard to case', () => {
    expect(bannedIn('DEFECT on the home page')).toEqual(['defect']);
  });
  it('keeps the review vocabulary and the banned list disjoint', () => {
    for (const word of REVIEW_WORDS) expect(bannedIn(word)).toEqual([]);
    expect(new Set(BANNED_PHRASES).size).toBe(BANNED_PHRASES.length);
  });
});

describe('a phrase split across white space', () => {
  it('is still the phrase', () => {
    expect(bannedIn('what   is\twrong here')).toEqual(['what is wrong']);
  });
  it('is not the phrase when its words are run together', () => {
    expect(bannedIn('whatiswrong')).toEqual([]);
  });
});
