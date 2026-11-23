/**
 * Where and how big each window opens. Pure: the main process hands in the screens' work areas
 * and any remembered rectangle. Windows open large enough for their content, never bigger than the
 * screen, and come back where the Operator left them, so nobody has to drag a window to reach an
 * option.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BoundsKind = 'operator' | 'preferences' | 'shuttle' | 'output-windowed';

export const BOUNDS_KINDS: readonly BoundsKind[] = [
  'operator',
  'preferences',
  'shuttle',
  'output-windowed',
];

interface SizeSpec {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

export const WINDOW_SIZES: Record<BoundsKind, SizeSpec> = {
  // Run mode (meter, Live view, transport, status column) and Edit mode (editor and library).
  operator: { width: 1360, height: 860, minWidth: 1100, minHeight: 640 },
  // The longest page (Appearance) shows without scrolling when the screen is tall enough.
  preferences: { width: 900, height: 980, minWidth: 640, minHeight: 420 },
  // The whole device with its readout.
  shuttle: { width: 420, height: 640, minWidth: 380, minHeight: 600 },
  // The Output is a 16:9 picture: a 16:9 window shows it with no bars.
  'output-windowed': { width: 960, height: 540, minWidth: 320, minHeight: 180 },
};

const intersection = (a: Rect, b: Rect): number => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/** The screen a remembered window is mostly on, else the first (primary) screen. */
export function chooseWorkArea(areas: Rect[], saved: Rect | null | undefined): Rect {
  const primary = areas[0];
  if (!saved) return primary;
  let best = primary;
  let bestArea = 0;
  for (const area of areas) {
    const overlap = intersection(area, saved);
    if (overlap > bestArea) {
      best = area;
      bestArea = overlap;
    }
  }
  return bestArea >= 120 * 80 ? best : primary;
}

export function windowBounds(
  kind: BoundsKind,
  workArea: Rect,
  saved?: Rect | null,
): { bounds: Rect; minWidth: number; minHeight: number } {
  const spec = WINDOW_SIZES[kind];
  const usable = saved && intersection(workArea, saved) >= 120 * 80 ? saved : null;
  const width = Math.min(usable ? usable.width : spec.width, workArea.width);
  const height = Math.min(usable ? usable.height : spec.height, workArea.height);
  const centeredX = workArea.x + (workArea.width - width) / 2;
  const centeredY = workArea.y + (workArea.height - height) / 2;
  // The small helpers sit at the right edge, out of the way of the Operator view.
  const x = usable
    ? usable.x
    : kind === 'shuttle' || kind === 'output-windowed'
      ? workArea.x + workArea.width - width - 24
      : centeredX;
  const y = usable ? usable.y : kind === 'shuttle' ? workArea.y + 40 : centeredY;
  return {
    bounds: {
      width,
      height,
      // Keep the whole window on the screen.
      x: Math.round(Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width))),
      y: Math.round(Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height))),
    },
    minWidth: Math.min(spec.minWidth, width),
    minHeight: Math.min(spec.minHeight, height),
  };
}

export type WindowState = Partial<Record<BoundsKind, Rect>>;

const isRect = (value: unknown): value is Rect => {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    ['x', 'y', 'width', 'height'].every((k) => typeof r[k] === 'number' && Number.isFinite(r[k])) &&
    (r.width as number) >= 200 &&
    (r.height as number) >= 100
  );
};

/** Turns whatever the file held into a clean map; unknown or damaged entries are dropped. */
export function normalizeWindowState(raw: unknown): WindowState {
  const out: WindowState = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const kind of BOUNDS_KINDS) {
    const value = (raw as Record<string, unknown>)[kind];
    if (isRect(value)) {
      out[kind] = { x: value.x, y: value.y, width: value.width, height: value.height };
    }
  }
  return out;
}
