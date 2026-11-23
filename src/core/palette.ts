/** How many recently used text colors the core keeps. */
export const MAX_RECENT_COLORS = 10;

/** The recent colors before the Operator has picked anything: red, green, blue, yellow, white. */
export const SEED_COLORS: readonly string[] = [
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#ffffff',
];

/** Any color is accepted as `#rrggbb` and stored as-is; the Output makes unreadable ones readable. */
export const isHexColor = (c: unknown): c is string =>
  typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/** The color moves to the front, without duplicates, capped at ten. Not a color: unchanged. */
export function moveColorToFront(recent: readonly string[], color: string): string[] {
  if (!isHexColor(color)) return [...recent];
  const c = color.toLowerCase();
  return [c, ...recent.filter((r) => r !== c)].slice(0, MAX_RECENT_COLORS);
}
