/**
 * Minimum WCAG contrast ratio for a source color to be shown. 3:1 is the WCAG bar
 * for large text, and prompter text is far larger than that.
 */
export const MIN_CONTRAST = 3;

type Rgb = [number, number, number];

function parseHex(color: string | undefined): Rgb | null {
  if (!color) return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1 to 21) of two `#rgb`/`#rrggbb` colors, or NaN if either is invalid. */
export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return NaN;
  const [hi, lo] = [luminance(ra), luminance(rb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever contrasts more with `background` (white if it is not a valid color). */
export function readableTextOn(background: string): string {
  const bg = parseHex(background);
  if (!bg) return '#ffffff';
  return contrastRatio('#ffffff', background) >= contrastRatio('#000000', background)
    ? '#ffffff'
    : '#000000';
}

/**
 * The color to show for a run: its source color if readable on the Output background,
 * otherwise the theme text color, otherwise black or white (the theme color itself may
 * match the background). Applied at render time; the Script is never rewritten.
 */
export function displayColor(
  source: string | undefined,
  background: string,
  themeColor: string,
): string {
  if (source && parseHex(source) && contrastRatio(source, background) >= MIN_CONTRAST) return source;
  return contrastRatio(themeColor, background) >= MIN_CONTRAST
    ? themeColor
    : readableTextOn(background);
}
