/**
 * What the browser listed and the readers missed is matched by role and name, not words alone (ChatGPT's
 * third audit, 3): a link "Search" no longer stands for a search box the readers never recorded.
 */
import { describe, expect, it } from 'vitest';
import { notRecorded, recordedWords } from '../../src/leaf/pages/recorded.js';

const recorded = recordedWords([{ words: ['Email'] }], ['Search', 'Sign up'], [{ links: [{ href: '/m', text: 'Map' }], controls: [{ words: ['Zoom'] }] }]);

describe('notRecorded', () => {
  it('says a field missed when only a link of its name was recorded', () => {
    expect(notRecorded([{ role: 'searchbox', name: 'Search' }, { role: 'textbox', name: 'Map' }], recorded).map((s) => s.name)).toEqual(['Search', 'Map']);
  });

  it('says a link missed when only a control of its name was recorded', () => {
    expect(notRecorded([{ role: 'link', name: 'Email', url: '/email' }, { role: 'link', name: 'Zoom', url: '/zoom' }], recorded).map((s) => s.name)).toEqual(['Email', 'Zoom']);
  });

  it('takes a link or a control as a button, tab or menu item: a link often carries those roles', () => {
    expect(notRecorded([{ role: 'button', name: 'Sign up' }, { role: 'menuitem', name: 'Search' }, { role: 'tab', name: 'Email' }, { role: 'button', name: 'Zoom' }], recorded)).toEqual([]);
  });

  it('matches each as before within its kind: case, spacing and a shortened label aside', () => {
    expect(notRecorded([{ role: 'link', name: '  SEARCH ' }, { role: 'textbox', name: 'Email address' }, { role: 'link', name: 'Map', url: '/m' }], recorded)).toEqual([]);
  });

  it('takes a link as recorded only where a recorded link of its name leads (ChatGPT\'s fourth audit, 1)', () => {
    const page = 'https://acme.test/account/';
    const two = recordedWords([], [{ text: 'Help', to: 'https://acme.test/account/help' }], [{ url: 'https://acme.test/frame/', links: [{ href: 'faq', text: 'FAQ' }] }], page);
    const listed = [
      { role: 'link', name: 'Help', url: 'help' },
      { role: 'link', name: 'Help', url: '/support' },
      { role: 'link', name: 'Help', url: '/account/help#top' },
      { role: 'link', name: 'FAQ', url: 'https://acme.test/frame/faq' },
      { role: 'link', name: 'FAQ', url: '/faq' },
    ];
    // Same text, another place: missed. The same place, written relatively or with a #: recorded. A frame's link, read against the frame's address.
    expect(notRecorded(listed, two).map((s) => `${s.name} ${s.url}`)).toEqual(['Help /support', 'FAQ /faq']);
    // A recorded link whose address the reader did not know stands for any of its name: never said missed on a guess.
    expect(notRecorded(listed, recordedWords([], ['Help', 'FAQ'], [], page))).toEqual([]);
  });
});
