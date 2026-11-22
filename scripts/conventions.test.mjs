import { describe, expect, it } from 'vitest';
import {
  avoidTerms,
  coreProblems,
  glossaryProblems,
  ticketRefProblems,
  userFacingStrings,
} from './conventions.mjs';

const glossary = `**Operator**:
Runs it.
_Avoid_: User, presenter

**Talent**:
Reads it.
_Avoid_: Speaker, presenter

**Notification**:
A live note.
_Avoid_: Alert, message, cue.
`;

describe('avoidTerms', () => {
  it('reads each _Avoid_ word with the term to use, merging shared words', () => {
    const terms = avoidTerms(glossary);
    expect(terms.find((t) => t.word === 'message')).toEqual({
      word: 'message',
      use: 'Notification',
    });
    expect(terms.find((t) => t.word === 'presenter')?.use).toBe('Operator or Talent');
    expect(terms.find((t) => t.word === 'cue')).toBeDefined();
  });
});

describe('userFacingStrings', () => {
  it('takes HTML text nodes but not style or attributes', () => {
    const html = '<style>a { display: none }</style><label for="x">Send a message</label>';
    expect(userFacingStrings(html, 'a.html')).toEqual(['Send a message']);
  });

  it('takes prose string literals in TypeScript but not identifiers or css values', () => {
    const ts = `el.style.display = 'none'; label = 'Type a message'; kind = 'ring';`;
    expect(userFacingStrings(ts, 'a.ts')).toEqual(['Type a message']);
  });
});

describe('glossaryProblems', () => {
  const terms = avoidTerms(glossary);
  it('flags an Avoid term in user-facing text and names the term to use', () => {
    const problems = glossaryProblems(['Message the presenter'], terms, [], 'ui.ts');
    expect(problems.join('\n')).toContain('use "Notification"');
    expect(problems.join('\n')).toContain('use "Operator or Talent"');
  });

  it('lets an allowed phrase cover a legitimate use, and nothing else in that string', () => {
    expect(glossaryProblems(['Quick message'], terms, ['Quick message'], 'ui.ts')).toEqual([]);
    expect(
      glossaryProblems(['Quick message to the presenter'], terms, ['Quick message'], 'ui.ts'),
    ).not.toEqual([]);
  });

  it('matches whole words only', () => {
    expect(glossaryProblems(['Messaging'], terms, [], 'ui.ts')).toEqual([]);
  });
});

describe('ticketRefProblems', () => {
  it('flags ticket numbers with line numbers', () => {
    expect(ticketRefProblems('a\n// for ticket 17\nb', 'x.ts')).toEqual([
      'x.ts:2: refers to a ticket number; say what the code does instead.',
    ]);
    expect(ticketRefProblems('// the ticket system', 'x.ts')).toEqual([]);
  });
});

describe('coreProblems', () => {
  it('flags Electron, the DOM, and upward imports', () => {
    expect(coreProblems("import { app } from 'electron';", 'c.ts')).toHaveLength(1);
    expect(coreProblems('const t = document.title;', 'c.ts')).toHaveLength(1);
    expect(coreProblems("import { x } from '../operator/y';", 'c.ts')).toHaveLength(1);
  });
  it('allows ordinary core code and comments that mention the DOM', () => {
    expect(
      coreProblems("import { x } from './types';\n// no document. or window. here", 'c.ts'),
    ).toEqual([]);
  });
});
