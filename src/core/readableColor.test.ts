import { describe, expect, it } from 'vitest';
import { contrastRatio, displayColor, MIN_CONTRAST } from './readableColor';

const THEME = '#ffffff';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

describe('displayColor', () => {
  it('replaces a stray Word default black on a dark background', () => {
    expect(displayColor('#000000', '#000000', THEME)).toBe(THEME);
  });
  it('replaces near-black on a dark background', () => {
    expect(displayColor('#111111', '#000000', THEME)).toBe(THEME);
    expect(displayColor('#1a1a1a', '#0a0a0a', THEME)).toBe(THEME);
  });
  it('replaces low-contrast mid colors', () => {
    expect(displayColor('#444444', '#000000', THEME)).toBe(THEME);
    expect(displayColor('#800000', '#000000', THEME)).toBe(THEME);
    expect(displayColor('#0000ff', '#000000', THEME)).toBe(THEME);
  });
  it('keeps readable colors as-is', () => {
    expect(displayColor('#ff0000', '#000000', THEME)).toBe('#ff0000');
    expect(displayColor('#00ff00', '#000000', THEME)).toBe('#00ff00');
    expect(displayColor('#ff0', '#000000', THEME)).toBe('#ff0');
  });
  it('judges the same color against the current background', () => {
    expect(displayColor('#cc0000', '#000000', THEME)).toBe('#cc0000');
    expect(displayColor('#cc0000', '#990000', THEME)).toBe(THEME);
    expect(displayColor('#000000', '#ffffff', '#222222')).toBe('#000000');
  });
  it('uses the theme color when there is no usable source color', () => {
    expect(displayColor(undefined, '#000000', THEME)).toBe(THEME);
    expect(displayColor('', '#000000', THEME)).toBe(THEME);
    expect(displayColor('red', '#000000', THEME)).toBe(THEME);
    expect(displayColor('#12345', '#000000', THEME)).toBe(THEME);
  });
  it('falls back to the theme color if the background is unparseable', () => {
    expect(displayColor('#ff0000', 'nonsense', THEME)).toBe(THEME);
  });
  it('uses a threshold suited to large text', () => {
    expect(MIN_CONTRAST).toBe(3);
  });
});

describe('displayColor final fallback', () => {
  it('never returns a theme color that matches the background', () => {
    const out = displayColor('#000000', '#000000', '#000000');
    expect(contrastRatio(out, '#000000')).toBeGreaterThanOrEqual(MIN_CONTRAST);
    const out2 = displayColor(undefined, '#ffffff', '#fefefe');
    expect(contrastRatio(out2, '#ffffff')).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});
