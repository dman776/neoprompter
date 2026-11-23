/** Pixels of vertical drag for one speed level. */
export const PIXELS_PER_LEVEL = 14;

/** The speed level for a pointer at `y`, after a drag that began at `startY` on `startLevel`. */
export function levelFromDrag(startLevel: number, startY: number, y: number): number {
  return startLevel + (startY - y) / PIXELS_PER_LEVEL;
}
