import type { Command, CoreState } from '../core';
import { LiveView } from './LiveView';
import { ScriptLock } from './ScriptLock';
import { SpeedMeter, useSpeedKeys } from './Speed';
import { StatusPanel } from './StatusPanel';
import { Transport, useTransportKeys } from './Transport';
import { useApiView, useOutputView, type CoreBridge } from './useCoreState';

/**
 * Run mode: the large Live view with the transport under it, and the right-hand column.
 * The speed meter sits on the left and the dial in the transport; the empty `data-slot` box in the
 * right-hand column is where the Script lock goes.
 */
export function RunMode({
  state,
  bridge,
  outputBlocked,
}: {
  state: CoreState;
  bridge: CoreBridge;
  outputBlocked: boolean;
}) {
  const outputView = useOutputView(bridge);
  const apiView = useApiView(bridge);
  useSpeedKeys(bridge.dispatch);
  useTransportKeys(state, bridge.dispatch);
  const dispatch = (command: Command) => bridge.dispatch(command);
  return (
    <div className="run">
      <div className="run-slot run-slot-meter" data-slot="speed-meter">
        <SpeedMeter level={state.speedLevel} />
      </div>
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
      <aside className="run-side">
        <div className="run-slot" data-slot="script-lock">
          <ScriptLock
            unlocked={state.unlocked}
            onChange={(unlocked) => bridge.dispatch({ type: 'setUnlocked', unlocked })}
          />
        </div>
        <StatusPanel state={state} outputView={outputView} apiView={apiView} />
      </aside>
    </div>
  );
}
