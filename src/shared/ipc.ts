/** IPC channel names shared by main, preload and renderers. */
export const IPC = {
  /** main -> renderers: CoreState broadcast */
  state: 'core:state',
  /** renderer -> main: dispatch a Command */
  command: 'core:command',
  /** renderer -> main (invoke): fetch current CoreState */
  getState: 'core:get-state',
} as const;
