/** IPC channel names shared by main, preload and renderers. */
export const IPC = {
  /** main -> renderers: CoreState broadcast */
  state: 'core:state',
  /** renderer -> main: dispatch a Command */
  command: 'core:command',
  /** renderer -> main (invoke): fetch current CoreState */
  getState: 'core:get-state',
  /** renderer -> main (invoke): pick a Word file and import it into the library */
  importScript: 'library:import',
  /** renderer -> main (invoke): Output monitor settings view */
  outputGetView: 'output:get-view',
  /** renderer -> main (invoke): choose Output monitor, returns the new view */
  outputChooseMonitor: 'output:choose-monitor',
  /** Output renderer -> main: Esc was pressed; leave full screen (only the Output window's own message counts) */
  outputExitFullscreen: 'output:exit-fullscreen',
  /** renderer -> main (invoke): toggle Windowed Output, returns the new view */
  outputSetWindowed: 'output:set-windowed',
  /** renderer -> main (invoke): Companion API settings and status */
  apiGet: 'api:get',
  /** renderer -> main (invoke): save Companion API settings (port, token), returns the new view */
  apiSet: 'api:set',
  /** renderer -> main (invoke): the Producer page's Quick messages */
  quickMessagesGet: 'api:quick-messages-get',
  /** renderer -> main (invoke): save the Quick messages, returns the list as saved */
  quickMessagesSet: 'api:quick-messages-set',
  /** renderer -> main: a device event (Virtual shuttle now, the real ShuttleXPress later) */
  deviceEvent: 'input:event',
  /** renderer -> main (invoke): the button mapping and the actions that can be chosen */
  inputGetMapping: 'input:get-mapping',
  /** renderer -> main (invoke): remap one button, returns the new mapping view */
  inputSetButton: 'input:set-button',
  /** main -> renderers: the button mapping changed */
  inputMapping: 'input:mapping',
  /** main -> Operator view: a native menu item that only the Operator view can handle */
  menuAction: 'menu:action',
} as const;
