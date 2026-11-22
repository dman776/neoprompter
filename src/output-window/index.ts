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
  | { mode: 'fullscreen'; bounds: Bounds }
  | { mode: 'windowed' }
  | { mode: 'closed' };

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

export interface OutputWindowView {
  windowed: boolean;
  chosenMonitorId: string | null;
  monitors: MonitorOption[];
}

export interface OutputWindowManager {
  chooseMonitor(id: string): void;
  setWindowed(windowed: boolean): void;
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

  const chosenId = (): string | null =>
    settings.monitorBySetup[displaySetupKey(displays.list())] ?? null;

  function decide(): OutputPlacement {
    if (settings.windowed) return { mode: 'windowed' };
    const id = chosenId();
    if (id === null || id === displays.operatorDisplayId()) return { mode: 'closed' };
    const display = displays.list().find((d) => d.id === id);
    return display ? { mode: 'fullscreen', bounds: display.bounds } : { mode: 'closed' };
  }

  function refresh(): void {
    const next = decide();
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    current = next;
    if (next.mode === 'closed') host.hide();
    else host.show(next);
  }

  function update(next: OutputSettings): void {
    settings = next;
    store.save(settings);
    refresh();
  }

  return {
    chooseMonitor(id) {
      const key = displaySetupKey(displays.list());
      update({ ...settings, monitorBySetup: { ...settings.monitorBySetup, [key]: id } });
    },
    setWindowed(windowed) {
      update({ ...settings, windowed });
    },
    refresh,
    getView() {
      const operatorId = displays.operatorDisplayId();
      return {
        windowed: settings.windowed,
        chosenMonitorId: chosenId(),
        monitors: displays.list().map((d, i) => ({
          id: d.id,
          label: `Display ${i + 1} (${d.bounds.width}x${d.bounds.height})`,
          isOperatorDisplay: d.id === operatorId,
        })),
      };
    },
  };
}
