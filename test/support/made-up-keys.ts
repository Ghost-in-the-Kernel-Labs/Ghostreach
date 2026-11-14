/**
 * A made-up key of each shape in src/pages/secret-shapes.ts (G-410), joined at run time from pieces, so a scan of this
 * repository's files never stops on its own fixtures. None is a real key; each is named by the shape that must find it.
 */
const x = (n: number, c: string) => c.repeat(n);

export const MADE_UP_KEYS: Record<string, string> = {
  'Anthropic key': ['sk', 'ant', 'api03', `${x(30, 'A')}9b_${x(20, 'c')}`].join('-'),
  'OpenAI key': ['sk', 'proj', `${x(24, 'Q')}7${x(20, 'r')}`].join('-'),
  'AWS access key': `${'AK'}${'IA'}${'Z7Q2'.repeat(4)}`,
  'Google key': `${'AI'}${'za'}${'Sy'}${x(28, 'D')}4_k-m`,
  'GitHub token': `${'gh'}${'p_'}${x(30, 'F')}123456`,
  'npm token': `${'np'}${'m_'}${x(32, 'n')}0123`,
  'Slack token': [`xo${'xb'}`, '123456789012', 'abcdefghijKL'].join('-'),
  'Stripe key': [`s${'k'}`, `li${'ve'}`, `${x(20, 'S')}42`].join('_'),
  'Atlassian token': `${'ATA'}${'TT3'}${x(40, 'Z')}=ABC12`,
  'HuggingFace token': `${'h'}${'f_'}${x(34, 'H')}`,
  'GitLab token': `${'gl'}${'pat-'}${x(24, 'L')}_9`,
  'private key': `-----${'BEGIN'} RSA PRIVATE KEY-----\nMIIEow${x(40, 'B')}\n${x(20, 'C')}==\n-----${'END'} RSA PRIVATE KEY-----`,
  JWT: [`ey${'J'}hbGciOiJIUzI1NiJ9`, `ey${'J'}zdWIiOiIxMjM0NTY3ODkwIn0`, 'dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'].join('.'),
};
