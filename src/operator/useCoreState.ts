import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command, CoreState } from '../core';
import type { OutputBlocked, OutputWindowView } from '../output-window';
import type { ApiSettings, ApiView } from '../api';
import type { ActionId, ButtonId, ButtonMappingView } from '../input';
import type { UiAction } from '../window-host';

/** What an Import tells the Operator; `ok: false` says plainly why the file could not be imported. */
export interface ImportOutcome {
  ok: boolean;
  message: string;
}

/** The slice of `window.neoprompter` the Operator view uses; a test passes a fake. */
export interface CoreBridge {
  getState(): Promise<CoreState>;
  dispatch(command: Command): void;
  onState(listener: (state: CoreState) => void): void;
  getOutputView(): Promise<OutputWindowView>;
  getApiView(): Promise<ApiView>;
  /** Native menu items only the Operator view can handle. Absent in windows that have no menu. */
  onMenuAction?(listener: (action: UiAction) => void): void;
  chooseOutputMonitor(id: string): Promise<OutputWindowView>;
  setWindowedOutput(windowed: boolean): Promise<OutputWindowView>;
  /** Opens a file picker and imports the chosen Word file; null when the Operator cancelled. */
  importScript?(): Promise<ImportOutcome | null>;
}

/** What the Preferences window uses beyond the Operator view's slice: Controls and Network. */
export interface PreferencesBridge extends CoreBridge {
  getButtonMapping(): Promise<ButtonMappingView>;
  setButton(button: ButtonId, action: ActionId): Promise<ButtonMappingView>;
  onButtonMapping(listener: (view: ButtonMappingView) => void): void;
  setApiSettings(settings: ApiSettings): Promise<ApiView>;
  getQuickMessages(): Promise<string[]>;
  setQuickMessages(messages: string[]): Promise<string[]>;
}

/** The latest core state (null until the first one arrives). Components render it and dispatch. */
export function useCoreState(bridge: CoreBridge): CoreState | null {
  const [state, setState] = useState<CoreState | null>(null);
  useEffect(() => {
    let live = true;
    bridge.onState((s) => live && setState(s));
    void bridge.getState().then((s) => live && setState((current) => current ?? s));
    return () => {
      live = false;
    };
  }, [bridge]);
  return state;
}

/** How often to look again at why the Output is not showing (a monitor may be plugged in). */
const BLOCKED_POLL_MS = 1500;

/**
 * Asks the main process for something now and again every `ms`, until the component goes. While
 * `enabled` is false it does not ask, and the value is null.
 */
function usePolled<T>(ask: () => Promise<T>, ms: number, enabled = true): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    if (!enabled) {
      setValue(null);
      return;
    }
    let live = true;
    const look = () => void ask().then((v) => live && setValue(v));
    look();
    const timer = setInterval(look, ms);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [ask, ms, enabled]);
  return value;
}

/** The Output window's view (monitors, which is chosen), kept fresh for the status panel. */
export function useOutputView(bridge: CoreBridge): OutputWindowView | null {
  return usePolled(bridge.getOutputView, BLOCKED_POLL_MS);
}

/** The Producer page's view (listening or not), kept fresh for the status panel. */
export function useApiView(bridge: CoreBridge): ApiView | null {
  return usePolled(bridge.getApiView, BLOCKED_POLL_MS);
}

/**
 * Why the Output is switched On but not showing (no monitor, monitor unplugged), or null.
 * Asked of the main process, which owns the displays; it looks again while the Output is On.
 */
export function useOutputBlocked(bridge: CoreBridge, outputOn: boolean): OutputBlocked | null {
  const ask = useCallback(() => bridge.getOutputView().then((v) => v.blocked), [bridge]);
  return usePolled(ask, BLOCKED_POLL_MS, outputOn);
}

/** Calls `handle` for each native menu item that is the Operator view's to handle. */
export function useMenuActions(bridge: CoreBridge, handle: (action: UiAction) => void): void {
  const latest = useRef(handle);
  latest.current = handle;
  useEffect(() => {
    bridge.onMenuAction?.((action) => latest.current(action));
  }, [bridge]);
}
