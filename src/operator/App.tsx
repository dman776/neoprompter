import type { Mode } from '../core';
import { useCoreState, useOutputBlocked, type CoreBridge } from './useCoreState';
import { Header } from './Header';
import { StatusBar } from './StatusBar';
import { Panel } from './ui/Panel';

/** The Operator view: header, a body for the current mode, and a status bar. */
export function App({ bridge }: { bridge: CoreBridge }) {
  const state = useCoreState(bridge);
  const outputBlocked = useOutputBlocked(bridge, state?.outputOn ?? false);
  if (!state) return null;
  const setMode = (mode: Mode) => bridge.dispatch({ type: 'setMode', mode });
  return (
    <div className="shell">
      <Header
        scriptName={state.script.name}
        mode={state.mode}
        onModeChange={setMode}
        outputOn={state.outputOn}
        onOutputChange={(on) => bridge.dispatch({ type: 'setOutput', on })}
        outputBlocked={outputBlocked}
      />
      <main className="shell-body" data-mode={state.mode}>
        {state.mode === 'edit' ? (
          <Panel title="Script">
            <p className="placeholder">The Script editor and library arrive here.</p>
          </Panel>
        ) : (
          <Panel title="Live view">
            <p className="placeholder">The Live view and transport keys arrive here.</p>
          </Panel>
        )}
      </main>
      <StatusBar state={state} />
    </div>
  );
}
