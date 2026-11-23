import type { MutableRefObject } from 'react';
import type { CoreState } from '../core';
import { LiveView } from './LiveView';
import { Library } from './Library';
import { ScriptEditor, type EditorHandle } from './ScriptEditor';
import { Panel } from './ui/Panel';
import type { CoreBridge } from './useCoreState';

/** Edit mode: the Script editor, and beside it a mini Live view over the Script library. */
export function EditMode({
  state,
  bridge,
  outputShowing,
  editorHandle,
  onSaveRejected,
}: {
  state: CoreState;
  bridge: CoreBridge;
  /** Whether the real Output is showing (then it measures the Script, not the mini Live view). */
  outputShowing: boolean;
  editorHandle: MutableRefObject<EditorHandle | null>;
  onSaveRejected: (message: string) => void;
}) {
  const collapsed = state.rightColumnCollapsed;
  return (
    <div className="edit" data-collapsed={collapsed ? 'true' : undefined}>
      <ScriptEditor
        bridge={bridge}
        script={state.script}
        editable={state.mode === 'edit'}
        recentColors={state.recentColors}
        handle={editorHandle}
        onSaveRejected={onSaveRejected}
      />
      {!collapsed && (
        <aside className="edit-side" data-testid="edit-side">
          <Panel className="mini">
            <LiveView
              state={state}
              dispatch={bridge.dispatch}
              outputShowing={outputShowing}
              badge={false}
            />
          </Panel>
          <div className="edit-lib" data-testid="library">
            <Library
              library={state.library}
              loadedId={state.loadedScriptId}
              dispatch={bridge.dispatch}
            />
          </div>
        </aside>
      )}
    </div>
  );
}
