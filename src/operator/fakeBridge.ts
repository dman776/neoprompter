// Test helper (DOM tests only): a bridge over a real core, so a test says only what differs.
import { act } from 'react';
import type { Command, Core, CoreState } from '../core';
import { defaultButtonMapping } from '../input';
import type { OutputWindowView } from '../output-window';
import type { UiAction } from '../window-host';
import type { PreferencesBridge } from './useCoreState';

/** A monitor view with nothing chosen and the Output not blocked. */
export const quietOutputView: OutputWindowView = {
  windowed: false,
  outputOn: false,
  blocked: null,
  chosenMonitorId: null,
  missingMonitorId: null,
  monitors: [],
};

export interface FakeBridge {
  bridge: PreferencesBridge;
  /** Every command the renderer sent, in order. */
  dispatched: Command[];
  /** Fires a native menu item at the renderer, as the main process would. */
  menu(action: UiAction): Promise<void>;
}

/**
 * A `PreferencesBridge` (a superset of the Operator view's) backed by `core`: commands reach the
 * core, and every state change is pushed to the renderer inside `act`. `overrides` replace any
 * method, for example `getOutputView` to show a monitor problem.
 */
export function createFakeBridge(
  core: Core,
  overrides: Partial<PreferencesBridge> = {},
): FakeBridge {
  const dispatched: Command[] = [];
  const stateListeners: Array<(s: CoreState) => void> = [];
  const menuListeners: Array<(action: UiAction) => void> = [];
  core.subscribe((s) => stateListeners.forEach((l) => act(() => l(s))));
  const bridge: PreferencesBridge = {
    getState: async () => core.getState(),
    dispatch: (c) => {
      dispatched.push(c);
      core.dispatch(c);
    },
    onState: (l) => stateListeners.push(l),
    onMenuAction: (l) => menuListeners.push(l),
    getOutputView: async () => quietOutputView,
    chooseOutputMonitor: async () => quietOutputView,
    setWindowedOutput: async () => quietOutputView,
    getApiView: async () => ({
      port: 4780,
      token: '',
      running: true,
      error: null,
      producerUrls: [],
    }),
    getButtonMapping: async () => ({ mapping: { ...defaultButtonMapping }, actions: [] }),
    setButton: async () => ({ mapping: { ...defaultButtonMapping }, actions: [] }),
    onButtonMapping: () => {},
    setApiSettings: async () => ({
      port: 4780,
      token: '',
      running: true,
      error: null,
      producerUrls: [],
    }),
    getQuickMessages: async () => [],
    setQuickMessages: async (m) => m,
    ...overrides,
  };
  return {
    bridge,
    dispatched,
    menu: (action) => act(async () => menuListeners.forEach((l) => l(action))),
  };
}
