import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { Command, CoreState } from '../core';

const api = {
  getState: (): Promise<CoreState> => ipcRenderer.invoke(IPC.getState),
  dispatch: (command: Command): void => ipcRenderer.send(IPC.command, command),
  onState: (listener: (state: CoreState) => void): void => {
    ipcRenderer.on(IPC.state, (_e, state: CoreState) => listener(state));
  },
};

contextBridge.exposeInMainWorld('neoprompter', api);

export type NeoprompterApi = typeof api;
