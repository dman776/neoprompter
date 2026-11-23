// Headless: decides where the single Output goes. No Electron imports; the display list,
// saved settings and the real window are injected.

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Display {
  id: string;
  bounds: Bounds;
}

export type OutputPlacement =
  { mode: 'fullscreen'; bounds: Bounds } | { mode: 'windowed' } | { mode: 'closed' };

export interface OutputSettings {
  /** Windowed Output: a test setting that shows the Output in an ordinary window. */
  windowed: boolean;
  /** Chosen monitor id, keyed by display setup (the set of connected displays). */
  monitorBySetup: Record<string, string>;
}

export interface OutputSettingsStore {
  load(): OutputSettings;
  save(settings: OutputSettings): void;
}

export interface DisplayProvider {
  list(): Display[];
  /** The display holding the Operator view, which the Output must never cover. */
  operatorDisplayId(): string;
}

/** Shows or hides the one real Output window. */
export interface OutputHost {
  show(placement: Exclude<OutputPlacement, { mode: 'closed' }>): void;
  hide(): void;
}

export interface MonitorOption {
  id: string;
  label: string;
  isOperatorDisplay: boolean;
}

/** Why the Output is switched On but not showing; null when it shows or is Off. */
export type OutputBlocked = 'no-monitor' | 'missing-monitor' | 'operator-display';

export interface OutputWindowView {
  windowed: boolean;
  /** Whether the Operator has switched the Output On (the core's `outputOn`). */
  outputOn: boolean;
  blocked: OutputBlocked | null;
  chosenMonitorId: string | null;
  /**
   * Set when no monitor is chosen for the current display setup but one remembered for a
   * larger setup (the current displays plus others) is no longer connected: it was unplugged.
   */
  missingMonitorId: string | null;
  monitors: MonitorOption[];
}

export interface OutputWindowManager {
  /** Follow the core's Output switch: Off closes the window, On shows it where it belongs. */
  setOutputOn(on: boolean): void;
  chooseMonitor(id: string): void;
  setWindowed(windowed: boolean): void;
  /**
   * Esc on the Output: a full screen Output becomes an ordinary window (so it can be moved and
   * closed) for now. The saved settings do not change, and switching the Output Off and On
   * again, or choosing a monitor, puts it back to full screen. Does nothing otherwise.
   */
  exitFullscreen(): void;
  /** Re-evaluate placement, e.g. after displays are added or removed. */
  refresh(): void;
  getView(): OutputWindowView;
}

export function displaySetupKey(displays: Display[]): string {
  return displays
    .map((d) => `${d.id}@${d.bounds.x},${d.bounds.y},${d.bounds.width}x${d.bounds.height}`)
    .sort()
    .join('|');
}

export function createOutputWindowManager(deps: {
  displays: DisplayProvider;
  store: OutputSettingsStore;
  host: OutputHost;
}): OutputWindowManager {
  const { displays, store, host } = deps;
  let settings = store.load();
  let current: OutputPlacement = { mode: 'closed' };
  let outputOn = false;
  /** Esc was pressed on the full screen Output: an ordinary window until it is switched Off. */
  let leftFullscreen = false;

  const chosenId = (): string | null =>
    settings.monitorBySetup[displaySetupKey(displays.list())] ?? null;

  /** The remembered monitor of a saved setup that contains all current displays plus more. */
  function missingMonitor(): string | null {
    if (settings.windowed || chosenId() !== null) return null;
    const connected = new Set(displaySetupKey(displays.list()).split('|').filter(Boolean));
    const connectedIds = new Set(displays.list().map((d) => d.id));
    for (const [key, id] of Object.entries(settings.monitorBySetup)) {
      const parts = key.split('|');
      if ([...connected].every((c) => parts.includes(c)) && !connectedIds.has(id)) return id;
    }
    return null;
  }

  function decide(): OutputPlacement {
    if (!outputOn) return { mode: 'closed' };
    if (settings.windowed || leftFullscreen) return { mode: 'windowed' };
    const id = chosenId();
    if (id === null || id === displays.operatorDisplayId()) return { mode: 'closed' };
    const display = displays.list().find((d) => d.id === id);
    return display ? { mode: 'fullscreen', bounds: display.bounds } : { mode: 'closed' };
  }

  /**
   * Windowed Output follows the display count: on with a single display, off with more. It only
   * changes when the count does (and once at start), so the Operator can still toggle it by hand.
   */
  let lastDisplayCount: number | null = null;
  function followDisplayCount(): void {
    const count = displays.list().length;
    if (count === lastDisplayCount) return;
    lastDisplayCount = count;
    const windowed = count <= 1;
    if (settings.windowed === windowed) return;
    leftFullscreen = false;
    settings = { ...settings, windowed };
    store.save(settings);
  }

  function refresh(): void {
    followDisplayCount();
    const next = decide();
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    current = next;
    if (next.mode === 'closed') host.hide();
    else host.show(next);
  }

  followDisplayCount();

  function blockedReason(): OutputBlocked | null {
    if (!outputOn || settings.windowed || leftFullscreen) return null;
    const id = chosenId();
    if (id === null) return missingMonitor() !== null ? 'missing-monitor' : 'no-monitor';
    return id === displays.operatorDisplayId() ? 'operator-display' : null;
  }

  function update(next: OutputSettings): void {
    settings = next;
    store.save(settings);
    refresh();
  }

  return {
    setOutputOn(on) {
      outputOn = on;
      if (!on) leftFullscreen = false;
      refresh();
    },
    exitFullscreen() {
      if (current.mode !== 'fullscreen') return;
      leftFullscreen = true;
      refresh();
    },
    chooseMonitor(id) {
      leftFullscreen = false;
      const key = displaySetupKey(displays.list());
      update({ ...settings, monitorBySetup: { ...settings.monitorBySetup, [key]: id } });
    },
    setWindowed(windowed) {
      leftFullscreen = false;
      update({ ...settings, windowed });
    },
    refresh,
    getView() {
      const operatorId = displays.operatorDisplayId();
      return {
        windowed: settings.windowed,
        outputOn,
        blocked: blockedReason(),
        chosenMonitorId: chosenId(),
        missingMonitorId: missingMonitor(),
        monitors: displays.list().map((d, i) => ({
          id: d.id,
          label: `Display ${i + 1} (${d.bounds.width}x${d.bounds.height})`,
          isOperatorDisplay: d.id === operatorId,
        })),
      };
    },
  };
}
