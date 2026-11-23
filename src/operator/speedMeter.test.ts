import { describe, expect, it } from 'vitest';
import { MAX_SPEED_LEVEL } from '../core';
import { levelFromMeter } from './speedMeter';

describe('pressing the speed meter', () => {
  it('is fastest at the top and stopped at the bottom', () => {
    expect(levelFromMeter(100, 100, 200)).toBe(MAX_SPEED_LEVEL);
    expect(levelFromMeter(300, 100, 200)).toBe(0);
  });

  it('is continuous in between, not in steps', () => {
    expect(levelFromMeter(200, 100, 200)).toBeCloseTo(5);
    expect(levelFromMeter(137, 100, 200)).toBeCloseTo(8.15);
  });

  it('stays in range when the pointer leaves the meter', () => {
    expect(levelFromMeter(-500, 100, 200)).toBe(MAX_SPEED_LEVEL);
    expect(levelFromMeter(5000, 100, 200)).toBe(0);
  });

  it('is stopped for a meter with no height yet', () => {
    expect(levelFromMeter(50, 0, 0)).toBe(0);
  });
});
