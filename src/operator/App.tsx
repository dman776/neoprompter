import { useEffect, useRef, useState } from 'react';
import type { Mode } from '../core';
import {
  useCoreState,
  useMenuActions,
  useOutputBlocked,
  type CoreBridge,
  type ImportOutcome,
} from './useCoreState';
import { Header } from './Header';
import { EditMode } from './EditMode';
import { StatusBar } from './StatusBar';
import { Notifications } from './Notifications';
import { Panel } from './ui/Panel';
import { RunMode } from './RunMode';

/** The Operator view: header, a body for the current mode, and a status bar. */
export function App({ bridge }: { bridge: CoreBridge }) {
  const state = useCoreState(bridge);
  const outputBlocked = useOutputBlocked(bridge, state?.outputOn ?? false);
  const theme = state?.theme;
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);
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
  const [importNote, setImportNote] = useState<ImportOutcome | null>(null);
  const runImport = () => {
    void bridge.importScript?.().then((outcome) => setImportNote(outcome));
  };
  useMenuActions(bridge, (action) => {
    if (action === 'toggle-theme') toggleTheme();
    else if (action === 'toggle-right-column') toggleColumn();
    else if (action === 'import') runImport();
    // A new Script replaces the one on the Output, so it belongs to Edit mode only.
    else if (action === 'new' && latest.current?.mode === 'edit') {
      bridge.dispatch({ type: 'newScript' });
    }
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
        onImport={state.mode === 'edit' && bridge.importScript ? runImport : undefined}
      />
      {importNote && (
        <div
          className="import-note"
          data-testid="import-note"
          data-ok={importNote.ok ? 'true' : undefined}
          role={importNote.ok ? 'status' : 'alert'}
        >
          <span>{importNote.message}</span>
          <button type="button" onClick={() => setImportNote(null)}>
            Dismiss
          </button>
        </div>
      )}
      <main className="shell-body" data-mode={state.mode}>
        {state.mode === 'edit' ? (
          <EditMode
            state={state}
            bridge={bridge}
            outputShowing={state.outputOn && outputBlocked === null}
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
