import { describe, expect, it } from 'vitest';
import { findInText } from './find';

describe('finding text in a line', () => {
  it('finds every non-overlapping match, ignoring case by default', () => {
    expect(findInText('Ann met ann and ANN', 'ann', false)).toEqual([0, 8, 16]);
  });
  it('can match case', () => {
    expect(findInText('Ann met ann', 'ann', true)).toEqual([8]);
  });
  it('finds nothing for an empty query', () => {
    expect(findInText('anything', '', false)).toEqual([]);
  });
  it('does not overlap matches', () => {
    expect(findInText('aaaa', 'aa', false)).toEqual([0, 2]);
  });
  it('treats the query as plain text, not a pattern', () => {
    expect(findInText('a.b axb', 'a.b', false)).toEqual([0]);
  });
});
