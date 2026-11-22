/** IPC channel names shared by main, preload and renderers. */
export const IPC = {
  /** main -> renderers: CoreState broadcast */
  state: 'core:state',
  /** renderer -> main: dispatch a Command */
  command: 'core:command',
  /** renderer -> main (invoke): fetch current CoreState */
  getState: 'core:get-state',
  /** renderer -> main (invoke): Output monitor settings view */
  outputGetView: 'output:get-view',
  /** renderer -> main (invoke): choose Output monitor, returns the new view */
  outputChooseMonitor: 'output:choose-monitor',
  /** renderer -> main (invoke): toggle Windowed Output, returns the new view */
  outputSetWindowed: 'output:set-windowed',
} as const;
