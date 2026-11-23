import type { Command, CoreState } from '../core';
import { LiveView } from './LiveView';
import { ScriptLock } from './ScriptLock';
import { StatusPanel } from './StatusPanel';
import { Transport } from './Transport';
import { useApiView, useOutputView, type CoreBridge } from './useCoreState';

/**
 * Run mode: the large Live view with the transport under it, and the right-hand column.
 * Empty `data-slot` boxes are where the speed meter (left), the dial (in the transport) and the
 * Script lock (right-hand column) go.
 */
export function RunMode({
  state,
  bridge,
  outputBlocked,
  columnCollapsed,
}: {
  state: CoreState;
  bridge: CoreBridge;
  outputBlocked: boolean;
  /** The right-hand column is hidden, so the Live view takes the full width. */
  columnCollapsed: boolean;
}) {
  const outputView = useOutputView(bridge);
  const apiView = useApiView(bridge);
  const dispatch = (command: Command) => bridge.dispatch(command);
  return (
    <div className="run" data-collapsed={columnCollapsed ? 'true' : undefined}>
      <div className="run-slot run-slot-meter" data-slot="speed-meter" />
      <div className="run-center">
        <div className="run-bezel">
          <LiveView
            state={state}
            dispatch={bridge.dispatch}
            outputShowing={state.outputOn && !outputBlocked}
          />
        </div>
        <Transport state={state} dispatch={dispatch} />
      </div>
      {!columnCollapsed && (
        <aside className="run-side">
          <div className="run-slot" data-slot="script-lock">
            <ScriptLock
              unlocked={state.unlocked}
              onChange={(unlocked) => bridge.dispatch({ type: 'setUnlocked', unlocked })}
            />
          </div>
          <StatusPanel state={state} outputView={outputView} apiView={apiView} />
        </aside>
      )}
    </div>
  );
}
