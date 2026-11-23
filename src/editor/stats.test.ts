import { describe, expect, it } from 'vitest';
import { formatReadTime, scriptStats } from './index';

describe('word count and read time', () => {
  it('counts words across paragraphs, headings and styled runs', () => {
    const stats = scriptStats([
      { heading: 1, runs: [{ text: 'Good' }, { text: ' evening', bold: true }] },
      '',
      'Please  stand, everyone.',
    ]);
    expect(stats.words).toBe(5);
  });

  it('reads 150 words a minute', () => {
    const lines = [Array.from({ length: 300 }, () => 'word').join(' ')];
    expect(scriptStats(lines).readSeconds).toBe(120);
  });

  it('is zero for an empty Script', () => {
    expect(scriptStats([''])).toEqual({ words: 0, readSeconds: 0 });
  });

  it('formats a read time as minutes and seconds', () => {
    expect(formatReadTime(0)).toBe('0:00');
    expect(formatReadTime(125)).toBe('2:05');
  });
});
