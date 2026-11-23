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
  /** renderer -> main (invoke): the Watched folder setting */
  watchedFolderGet: 'watched-folder:get',
  appVersionGet: 'app:version',
  /** renderer -> main (invoke): pick the Watched folder, returns the new view */
  watchedFolderChoose: 'watched-folder:choose',
  /** renderer -> main (invoke): turn the Watched folder off, returns the new view */
  watchedFolderClear: 'watched-folder:clear',
  /** main -> Operator view: what an automatic Import of the Watched folder did */
  watchedFolderNotice: 'watched-folder:notice',
  /** Operator view -> main (invoke): the Operator view is ready; returns a notice that arrived earlier, once */
  watchedFolderTakeNotice: 'watched-folder:take-notice',
  /** renderer -> main: a device event (Virtual shuttle now, the real ShuttleXPress later) */
  deviceEvent: 'input:event',
  /** renderer -> main (invoke): the button mapping and the actions that can be chosen */
  inputGetMapping: 'input:get-mapping',
  /** renderer -> main (invoke): remap one button, returns the new mapping view */
  inputSetButton: 'input:set-button',
  /** main -> renderers: the button mapping changed */
  inputMapping: 'input:mapping',
  /** renderer -> main (invoke): the Key bindings and the actions in listing order */
  inputGetKeys: 'input:get-keys',
  /** renderer -> main (invoke): give a key to an action; returns the result and the new view */
  inputAddKey: 'input:add-key',
  /** renderer -> main (invoke): take a key over from another action; returns the result and the new view */
  inputMoveKey: 'input:move-key',
  /** renderer -> main (invoke): take a key off an action, returns the new view */
  inputRemoveKey: 'input:remove-key',
  /** renderer -> main (invoke): back to the default Key bindings, returns the new view */
  inputResetKeys: 'input:reset-keys',
  /** main -> renderers: the Key bindings changed */
  inputKeys: 'input:keys',
  /** renderer -> main (invoke): the Update check's view */
  updateGet: 'update:get',
  /** renderer -> main (invoke): check now, returns the new view */
  updateCheck: 'update:check',
  /** renderer -> main (invoke): turn the check at launch on or off, returns the new view */
  updateSetAuto: 'update:set-auto',
  /** renderer -> main (invoke): skip the version on offer, returns the new view */
  updateSkip: 'update:skip',
  /** renderer -> main: open the release page of the version on offer in the system browser */
  updateOpen: 'update:open',
  /** main -> renderers: the Update check's view changed */
  updateView: 'update:view',
  /** main -> Operator view: a native menu item that only the Operator view can handle */
  menuAction: 'menu:action',
} as const;
