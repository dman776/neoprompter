import { MAX_SPEED_LEVEL } from '../core';

/**
 * The speed level for a pointer at `y` on the speed meter, which spans `top` to `top + height`:
 * the top of the meter is the fastest, the bottom is stopped, and every point between is a speed.
 */
export function levelFromMeter(y: number, top: number, height: number): number {
  if (!(height > 0)) return 0;
  const fraction = 1 - (y - top) / height;
  return Math.max(0, Math.min(MAX_SPEED_LEVEL, fraction * MAX_SPEED_LEVEL));
}
