import { describe, expect, it } from 'vitest';
import { chooseWorkArea, normalizeWindowState, windowBounds, WINDOW_SIZES } from './bounds';

const laptop = { x: 0, y: 25, width: 1440, height: 875 };
const big = { x: 0, y: 25, width: 2560, height: 1415 };
const tiny = { x: 0, y: 0, width: 1024, height: 700 };

describe('windowBounds', () => {
  it('opens the Operator view large and centered on a roomy screen', () => {
    const { bounds, minWidth, minHeight } = windowBounds('operator', big);
    expect(bounds.width).toBe(WINDOW_SIZES.operator.width);
    expect(bounds.height).toBe(WINDOW_SIZES.operator.height);
    expect(bounds.x).toBe(Math.round((big.width - bounds.width) / 2));
    expect(bounds.y).toBe(Math.round(big.y + (big.height - bounds.height) / 2));
    expect([minWidth, minHeight]).toEqual([1100, 640]);
  });

  it('never opens bigger than the screen, so nothing needs dragging to reach', () => {
    const { bounds, minWidth, minHeight } = windowBounds('operator', tiny);
    expect(bounds.width).toBeLessThanOrEqual(tiny.width);
    expect(bounds.height).toBeLessThanOrEqual(tiny.height);
    expect(minWidth).toBeLessThanOrEqual(bounds.width);
    expect(minHeight).toBeLessThanOrEqual(bounds.height);
    expect(bounds.x).toBeGreaterThanOrEqual(tiny.x);
    expect(bounds.y).toBeGreaterThanOrEqual(tiny.y);
  });

  it('opens Preferences tall enough for its longest page when the screen allows', () => {
    expect(windowBounds('preferences', big).bounds.height).toBe(WINDOW_SIZES.preferences.height);
    expect(windowBounds('preferences', laptop).bounds.height).toBeLessThanOrEqual(laptop.height);
  });

  it('opens the windowed Output as a 16:9 window so the picture has no bars', () => {
    const { bounds } = windowBounds('output-windowed', big);
    expect(bounds.width / bounds.height).toBeCloseTo(16 / 9, 1);
  });

  it('keeps every window fully on the screen', () => {
    for (const kind of ['operator', 'preferences', 'shuttle', 'output-windowed'] as const) {
      for (const area of [laptop, big, tiny]) {
        const { bounds } = windowBounds(kind, area);
        expect(bounds.x).toBeGreaterThanOrEqual(area.x);
        expect(bounds.y).toBeGreaterThanOrEqual(area.y);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(area.x + area.width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(area.y + area.height);
      }
    }
  });

  it('restores where the Operator left a window', () => {
    const saved = { x: 100, y: 60, width: 1250, height: 800 };
    expect(windowBounds('operator', laptop, saved).bounds).toEqual(saved);
  });

  it('shrinks a remembered window that no longer fits a smaller screen', () => {
    const saved = { x: 0, y: 0, width: 2000, height: 1300 };
    const { bounds } = windowBounds('operator', tiny, saved);
    expect(bounds.width).toBeLessThanOrEqual(tiny.width);
    expect(bounds.height).toBeLessThanOrEqual(tiny.height);
  });

  it('ignores a remembered window that is off every screen', () => {
    const saved = { x: 9000, y: 9000, width: 1200, height: 800 };
    const { bounds } = windowBounds('operator', laptop, saved);
    expect(bounds.x).toBeLessThan(laptop.width);
  });
});

describe('chooseWorkArea', () => {
  const second = { x: 1440, y: 0, width: 1920, height: 1080 };
  it('uses the screen a remembered window is on', () => {
    expect(chooseWorkArea([laptop, second], { x: 1500, y: 100, width: 800, height: 600 })).toBe(
      second,
    );
  });
  it('falls back to the first (primary) screen', () => {
    expect(chooseWorkArea([laptop, second], null)).toBe(laptop);
    expect(chooseWorkArea([laptop, second], { x: 9000, y: 9000, width: 800, height: 600 })).toBe(
      laptop,
    );
  });
});

describe('normalizeWindowState', () => {
  it('keeps valid rectangles and drops junk', () => {
    expect(
      normalizeWindowState({
        operator: { x: 1, y: 2, width: 1200, height: 800 },
        preferences: { x: 'a', y: 2, width: 1, height: 1 },
        shuttle: 'nope',
        other: { x: 0, y: 0, width: 500, height: 500 },
      }),
    ).toEqual({ operator: { x: 1, y: 2, width: 1200, height: 800 } });
  });
  it('treats a non-object as empty', () => {
    expect(normalizeWindowState(null)).toEqual({});
    expect(normalizeWindowState(7)).toEqual({});
  });
});
