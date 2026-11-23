import { useEffect, useState } from 'react';
import type { Command, CoreState } from '../core';
import type { OutputBlocked, OutputWindowView } from '../output-window';

/** The slice of `window.neoprompter` the Operator view uses; a test passes a fake. */
export interface CoreBridge {
  getState(): Promise<CoreState>;
  dispatch(command: Command): void;
  onState(listener: (state: CoreState) => void): void;
  getOutputView(): Promise<OutputWindowView>;
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
 * Why the Output is switched On but not showing (no monitor, monitor unplugged), or null.
 * Asked of the main process, which owns the displays; it looks again while the Output is On.
 */
export function useOutputBlocked(bridge: CoreBridge, outputOn: boolean): OutputBlocked | null {
  const [blocked, setBlocked] = useState<OutputBlocked | null>(null);
  useEffect(() => {
    if (!outputOn) {
      setBlocked(null);
      return;
    }
    let live = true;
    const look = () => void bridge.getOutputView().then((v) => live && setBlocked(v.blocked));
    look();
    const timer = setInterval(look, BLOCKED_POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [bridge, outputOn]);
  return blocked;
}
