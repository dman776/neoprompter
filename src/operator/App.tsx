import { useEffect, useRef, useState } from 'react';
import type { Mode } from '../core';
import type { EditorHandle } from './ScriptEditor';
import {
  useCoreState,
  useMenuActions,
  useWatchedFolderNotices,
  useOutputBlocked,
  useUpdateView,
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
  const update = useUpdateView(bridge);
  const [notice, setNotice] = useState<ImportOutcome | null>(null);
  const editorHandle = useRef<EditorHandle | null>(null);
  const saveRejected = (message: string) => setNotice({ ok: false, message });
  // Typing waits up to 300 ms before it is saved, so send it before the mode (and the lock) changes.
  const changeMode = (mode: Mode) => {
    editorHandle.current?.flush();
    bridge.dispatch({ type: 'setMode', mode });
  };
  // Import adds to the library, which Run mode locks, so it belongs to Edit mode only.
  const runImport = () => {
    if (latest.current?.mode !== 'edit') return;
    void bridge.importScript?.().then((outcome) => setNotice(outcome));
  };
  useWatchedFolderNotices(bridge, setNotice);
  useMenuActions(bridge, (action) => {
    if (action === 'toggle-theme') toggleTheme();
    else if (action === 'toggle-right-column') toggleColumn();
    else if (action === 'import') runImport();
    else if (action === 'mode-edit') changeMode('edit');
    else if (action === 'mode-run') changeMode('run');
    else if (action === 'undo') editorHandle.current?.undo();
    else if (action === 'redo') editorHandle.current?.redo();
    else if (action === 'find') editorHandle.current?.find();
    // A new Script replaces the one on the Output, so it belongs to Edit mode only.
    else if (action === 'new' && latest.current?.mode === 'edit') {
      bridge.dispatch({ type: 'newScript' });
    }
  });
  if (!state) return null;
  return (
    <div className="shell">
      <Header
        scriptName={state.script.name}
        mode={state.mode}
        onModeChange={changeMode}
        outputOn={state.outputOn}
        onOutputChange={(on) => bridge.dispatch({ type: 'setOutput', on })}
        outputBlocked={outputBlocked}
        columnCollapsed={state.rightColumnCollapsed}
        onToggleColumn={toggleColumn}
        theme={state.theme}
        onToggleTheme={toggleTheme}
        onImport={state.mode === 'edit' && bridge.importScript ? runImport : undefined}
      />
      {notice && (
        <div
          className="import-note"
          data-testid="notice"
          data-ok={notice.ok ? 'true' : undefined}
          role={notice.ok ? 'status' : 'alert'}
        >
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}
      {state.mode === 'edit' && update?.available && (
        <div className="import-note update-note" data-testid="update-notice" role="status">
          <span>
            NeoPrompter {update.available.version} is available (you have {update.current}).
          </span>
          <button type="button" onClick={() => bridge.openUpdatePage?.()}>
            View release
          </button>
          <button type="button" onClick={() => void bridge.skipUpdate?.()}>
            Skip this version
          </button>
        </div>
      )}
      <main className="shell-body" data-mode={state.mode}>
        {state.mode === 'edit' ? (
          <EditMode
            state={state}
            bridge={bridge}
            outputShowing={state.outputOn && outputBlocked === null}
            editorHandle={editorHandle}
            onSaveRejected={saveRejected}
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
