import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { Command, CoreState } from '../core';
import type { OutputWindowView } from '../output-window';
import type { UiAction } from '../window-host';
import type { ApiSettings, ApiView } from '../api';

const api = {
  getState: (): Promise<CoreState> => ipcRenderer.invoke(IPC.getState),
  dispatch: (command: Command): void => ipcRenderer.send(IPC.command, command),
  /** Opens a file picker and imports the chosen file; resolves to a message to show, or null if cancelled. */
  importScript: (): Promise<{ ok: boolean; message: string } | null> =>
    ipcRenderer.invoke(IPC.importScript),
  getOutputView: (): Promise<OutputWindowView> => ipcRenderer.invoke(IPC.outputGetView),
  chooseOutputMonitor: (id: string): Promise<OutputWindowView> =>
    ipcRenderer.invoke(IPC.outputChooseMonitor, id),
  setWindowedOutput: (windowed: boolean): Promise<OutputWindowView> =>
    ipcRenderer.invoke(IPC.outputSetWindowed, windowed),
  getApiView: (): Promise<ApiView> => ipcRenderer.invoke(IPC.apiGet),
  setApiSettings: (settings: ApiSettings): Promise<ApiView> =>
    ipcRenderer.invoke(IPC.apiSet, settings),
  /** Native menu items for the Operator view (New, Import, theme, right column, find). */
  onMenuAction: (listener: (action: UiAction) => void): void => {
    ipcRenderer.on(IPC.menuAction, (_e, action: UiAction) => listener(action));
  },
  onState: (listener: (state: CoreState) => void): void => {
    ipcRenderer.on(IPC.state, (_e, state: CoreState) => listener(state));
  },
};

contextBridge.exposeInMainWorld('neoprompter', api);

export type NeoprompterApi = typeof api;
