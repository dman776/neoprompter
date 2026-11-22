/**
 * The fixed palette of prompter-safe colors the Operator can apply to text.
 * All are light, saturated enough to tell apart, and readable on the default
 * (black) Output background. There is deliberately no free color picker.
 */
export const PALETTE = [
  { name: 'Yellow', color: '#ffe14d' },
  { name: 'Cyan', color: '#4dd9ff' },
  { name: 'Green', color: '#7ee87e' },
  { name: 'Orange', color: '#ffa94d' },
  { name: 'Pink', color: '#ff85c0' },
  { name: 'Red', color: '#ff7a7a' },
  { name: 'Lavender', color: '#b9a3ff' },
] as const;

export const PALETTE_COLORS: readonly string[] = PALETTE.map((p) => p.color);
