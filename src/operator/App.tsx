import { useRef } from 'react';
import type { Mode } from '../core';
import { useCoreState, useMenuActions, useOutputBlocked, type CoreBridge } from './useCoreState';
import { Header } from './Header';
import { ScriptEditor } from './ScriptEditor';
import { StatusBar } from './StatusBar';
import { Notifications } from './Notifications';
import { Panel } from './ui/Panel';
import { RunMode } from './RunMode';
import { useTheme } from './ui/useTheme';

/** The Operator view: header, a body for the current mode, and a status bar. */
export function App({ bridge }: { bridge: CoreBridge }) {
  const state = useCoreState(bridge);
  const outputBlocked = useOutputBlocked(bridge, state?.outputOn ?? false);
  useTheme(state?.theme);
  // The View menu's items; they need the latest state, so they read it when they fire.
  const latest = useRef(state);
  latest.current = state;
  const toggleTheme = () => {
    const s = latest.current;
    if (s) bridge.dispatch({ type: 'setTheme', theme: s.theme === 'dark' ? 'light' : 'dark' });
  };
  const toggleColumn = () => {
    const s = latest.current;
    if (s) {
      bridge.dispatch({ type: 'setRightColumnCollapsed', collapsed: !s.rightColumnCollapsed });
    }
  };
  useMenuActions(bridge, (action) => {
    if (action === 'toggle-theme') toggleTheme();
    else if (action === 'toggle-right-column') toggleColumn();
  });
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
        columnCollapsed={state.rightColumnCollapsed}
        onToggleColumn={toggleColumn}
        theme={state.theme}
        onToggleTheme={toggleTheme}
      />
      <main className="shell-body" data-mode={state.mode}>
        {state.mode === 'edit' ? (
          <ScriptEditor
            bridge={bridge}
            script={state.script}
            editable={state.mode === 'edit'}
            recentColors={state.recentColors}
          />
        ) : (
          <RunMode
            state={state}
            bridge={bridge}
            outputBlocked={outputBlocked !== null}
            columnCollapsed={state.rightColumnCollapsed}
          />
        )}
      </main>
      <StatusBar state={state} />
      <Notifications notifications={state.notifications} dispatch={bridge.dispatch} />
    </div>
  );
}
