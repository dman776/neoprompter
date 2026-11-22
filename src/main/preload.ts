import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { Command, CoreState } from '../core';
import type { OutputWindowView } from '../output-window';

const api = {
  getState: (): Promise<CoreState> => ipcRenderer.invoke(IPC.getState),
  dispatch: (command: Command): void => ipcRenderer.send(IPC.command, command),
  getOutputView: (): Promise<OutputWindowView> => ipcRenderer.invoke(IPC.outputGetView),
  chooseOutputMonitor: (id: string): Promise<OutputWindowView> =>
    ipcRenderer.invoke(IPC.outputChooseMonitor, id),
  setWindowedOutput: (windowed: boolean): Promise<OutputWindowView> =>
    ipcRenderer.invoke(IPC.outputSetWindowed, windowed),
  onState: (listener: (state: CoreState) => void): void => {
    ipcRenderer.on(IPC.state, (_e, state: CoreState) => listener(state));
  },
};

contextBridge.exposeInMainWorld('neoprompter', api);

export type NeoprompterApi = typeof api;
