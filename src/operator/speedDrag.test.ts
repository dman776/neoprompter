import { describe, expect, it } from 'vitest';
import { levelFromDrag, PIXELS_PER_LEVEL } from './speedDrag';

describe('dragging the speed dial', () => {
  it('moving up raises the level, moving down lowers it', () => {
    expect(levelFromDrag(3, 200, 200 - PIXELS_PER_LEVEL)).toBeCloseTo(4);
    expect(levelFromDrag(3, 200, 200 + 2 * PIXELS_PER_LEVEL)).toBeCloseTo(1);
  });

  it('does not move without a drag', () => {
    expect(levelFromDrag(2.5, 100, 100)).toBe(2.5);
  });

  it('takes any value in between, not whole levels', () => {
    expect(levelFromDrag(0, 100, 100 - PIXELS_PER_LEVEL / 2)).toBeCloseTo(0.5);
  });
});
