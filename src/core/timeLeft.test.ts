import { describe, expect, it } from 'vitest';
import { formatTimeLeft } from './timeLeft';

describe('time left', () => {
  it('is minutes and seconds at the current speed', () => {
    expect(formatTimeLeft(90, 1)).toBe('1:30');
    expect(formatTimeLeft(125, 0.5)).toBe('4:10');
    expect(formatTimeLeft(0, 2)).toBe('0:00');
  });

  it('rounds to the nearest second and pads seconds', () => {
    expect(formatTimeLeft(5, 1)).toBe('0:05');
    expect(formatTimeLeft(10, 3)).toBe('0:03');
  });

  it('shows dashes when the speed is zero', () => {
    expect(formatTimeLeft(40, 0)).toBe('--:--');
  });
});
