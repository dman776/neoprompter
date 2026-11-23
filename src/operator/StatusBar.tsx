import type { CoreState } from '../core';

/** The essentials along the bottom: the mode, and whether the Script is scrolling. */
export function StatusBar({ state }: { state: CoreState }) {
  return (
    <footer className="shell-status">
      <span>{state.mode === 'edit' ? 'Edit mode' : 'Run mode'}</span>
      <span>{state.outputOn ? 'Output on' : 'Output off'}</span>
      <span>{state.playing ? 'Playing' : 'Paused'}</span>
    </footer>
  );
}
