import { describe, expect, it } from 'vitest';
import {
  createOutputWindowManager,
  type Display,
  type OutputPlacement,
  type OutputSettingsStore,
  type OutputSettings,
} from './index';

const laptop: Display = { id: 'laptop', bounds: { x: 0, y: 0, width: 1440, height: 900 } };
const prompter: Display = { id: 'prompter', bounds: { x: 1440, y: 0, width: 1920, height: 1080 } };
const projector: Display = { id: 'projector', bounds: { x: 1440, y: 0, width: 1280, height: 720 } };

function setup(initialDisplays: Display[], initialSettings?: OutputSettings) {
  let displays = initialDisplays;
  let settings: OutputSettings = initialSettings ?? { windowed: false, monitorBySetup: {} };
  const store: OutputSettingsStore = {
    load: () => settings,
    save: (s) => {
      settings = s;
    },
  };
  const log: OutputPlacement[] = [];
  let open = false;
  const manager = createOutputWindowManager({
    displays: { list: () => displays, operatorDisplayId: () => 'laptop' },
    store,
    host: {
      show: (p) => {
        open = true;
        log.push(p);
      },
      hide: () => {
        open = false;
        log.push({ mode: 'closed' });
      },
    },
  });
  manager.setOutputOn(true);
  return {
    manager,
    log,
    isOpen: () => open,
    setDisplays: (d: Display[]) => {
      displays = d;
    },
    settings: () => settings,
  };
}

describe('Output monitor selection', () => {
  it('opens the Output full screen on the chosen monitor', () => {
    const t = setup([laptop, prompter]);
    t.manager.chooseMonitor('prompter');
    expect(t.log.at(-1)).toEqual({ mode: 'fullscreen', bounds: prompter.bounds });
  });

  it('remembers the choice per display setup', () => {
    const t = setup([laptop, prompter]);
    t.manager.chooseMonitor('prompter');
    t.setDisplays([laptop, projector]);
    t.manager.refresh();
    expect(t.isOpen()).toBe(false); // new setup, nothing chosen yet
    t.manager.chooseMonitor('projector');
    expect(t.log.at(-1)).toEqual({ mode: 'fullscreen', bounds: projector.bounds });
    t.setDisplays([laptop, prompter]);
    t.manager.refresh();
    expect(t.log.at(-1)).toEqual({ mode: 'fullscreen', bounds: prompter.bounds });
  });

  it('survives a restart through saved settings', () => {
    const a = setup([laptop, prompter]);
    a.manager.chooseMonitor('prompter');
    const b = setup([laptop, prompter], a.settings());
    b.manager.refresh();
    expect(b.log.at(-1)).toEqual({ mode: 'fullscreen', bounds: prompter.bounds });
  });

  it('closes the Output when the chosen monitor goes missing', () => {
    const t = setup([laptop, prompter]);
    t.manager.chooseMonitor('prompter');
    t.setDisplays([laptop]);
    t.manager.refresh();
    expect(t.isOpen()).toBe(false);
  });

  it('never goes full screen on the Operator view display', () => {
    const t = setup([laptop]);
    t.manager.chooseMonitor('laptop');
    expect(t.isOpen()).toBe(false);
  });

  it('Windowed Output works on a single display', () => {
    const t = setup([laptop]);
    t.manager.setWindowed(true);
    expect(t.log.at(-1)).toEqual({ mode: 'windowed' });
    t.manager.setWindowed(false);
    expect(t.isOpen()).toBe(false);
  });

  it('lists monitors and reports the current choice', () => {
    const t = setup([laptop, prompter]);
    t.manager.chooseMonitor('prompter');
    expect(t.manager.getView()).toEqual({
      windowed: false,
      outputOn: true,
      blocked: null,
      chosenMonitorId: 'prompter',
      missingMonitorId: null,
      monitors: [
        { id: 'laptop', label: 'Display 1 (1440x900)', isOperatorDisplay: true },
        { id: 'prompter', label: 'Display 2 (1920x1080)', isOperatorDisplay: false },
      ],
    });
  });

  it('keeps one Output: refreshing an unchanged placement does not reopen', () => {
    const t = setup([laptop, prompter]);
    t.manager.chooseMonitor('prompter');
    t.manager.refresh();
    t.manager.refresh();
    expect(t.log).toHaveLength(1);
  });

  it('moves the single Output when the choice changes', () => {
    const third: Display = { id: 'third', bounds: { x: 3360, y: 0, width: 800, height: 600 } };
    const t = setup([laptop, prompter, third]);
    t.manager.chooseMonitor('prompter');
    t.manager.chooseMonitor('third');
    expect(t.log.at(-1)).toEqual({ mode: 'fullscreen', bounds: third.bounds });
  });
});

describe('remembered monitor missing', () => {
  it('reports the remembered monitor when it was unplugged, and keeps the Output closed', () => {
    const t = setup([laptop, prompter]);
    t.manager.chooseMonitor('prompter');
    expect(t.manager.getView().missingMonitorId).toBeNull();
    t.setDisplays([laptop]);
    t.manager.refresh();
    expect(t.isOpen()).toBe(false);
    expect(t.manager.getView().chosenMonitorId).toBeNull();
    expect(t.manager.getView().missingMonitorId).toBe('prompter');
  });

  it('clears once a monitor is chosen for the new setup, or when reconnected', () => {
    const t = setup([laptop, prompter]);
    t.manager.chooseMonitor('prompter');
    t.setDisplays([laptop]);
    t.setDisplays([laptop, prompter]);
    expect(t.manager.getView().missingMonitorId).toBeNull();
  });

  it('is not reported for an unrelated saved setup or in Windowed Output', () => {
    const t = setup([laptop, prompter]);
    t.manager.chooseMonitor('prompter');
    t.setDisplays([laptop, projector]);
    expect(t.manager.getView().missingMonitorId).toBeNull();
    t.setDisplays([laptop]);
    t.manager.setWindowed(true);
    expect(t.manager.getView().missingMonitorId).toBeNull();
  });
});

describe('the Output switch', () => {
  it('stays closed while Off, opens when switched On and closes when switched Off', () => {
    const t = setup([laptop, prompter]);
    t.manager.setOutputOn(false);
    t.manager.chooseMonitor('prompter');
    expect(t.isOpen()).toBe(false);
    t.manager.setOutputOn(true);
    expect(t.log.at(-1)).toEqual({ mode: 'fullscreen', bounds: prompter.bounds });
    t.manager.setOutputOn(false);
    expect(t.isOpen()).toBe(false);
  });

  it('opens a window for Windowed Output when switched On', () => {
    const t = setup([laptop]);
    t.manager.setOutputOn(false);
    t.manager.setWindowed(true);
    expect(t.isOpen()).toBe(false);
    t.manager.setOutputOn(true);
    expect(t.log.at(-1)).toEqual({ mode: 'windowed' });
  });

  it('says why it stays closed when switched On', () => {
    const t = setup([laptop, prompter]);
    expect(t.manager.getView().blocked).toBe('no-monitor');
    t.manager.chooseMonitor('laptop');
    expect(t.manager.getView().blocked).toBe('operator-display');
    t.manager.chooseMonitor('prompter');
    expect(t.manager.getView().blocked).toBeNull();
    t.setDisplays([laptop]);
    expect(t.manager.getView().blocked).toBe('missing-monitor');
    t.manager.setWindowed(true);
    expect(t.manager.getView().blocked).toBeNull();
  });

  it('reports nothing blocked while Off', () => {
    const t = setup([laptop]);
    t.manager.setOutputOn(false);
    expect(t.manager.getView().blocked).toBeNull();
  });
});
