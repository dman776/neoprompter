import os from 'node:os';
import { producerUrls, type NetworkInterfaces } from '../api/addresses';
import {
  createApiServer,
  normalizeApiSettings,
  type ApiServer,
  type ApiSettings,
  type ApiSettingsStore,
  type ApiView,
} from '../api';
import {
  createProducerRoutes,
  createMemoryQuickMessageStore,
  MAX_QUICK_MESSAGE_LENGTH,
  MAX_QUICK_MESSAGES,
  normalizeQuickMessages,
  type QuickMessageStore,
} from '../api/producer';
import type { Core } from '../core';

/** Owns the running API server: starts it from saved settings and restarts it when they change. */
export function createApiController(
  core: Core,
  store: ApiSettingsStore,
  quickMessages: QuickMessageStore = createMemoryQuickMessageStore(),
  interfaces: () => NetworkInterfaces = os.networkInterfaces,
  version?: string,
) {
  let settings = store.load();
  let server: ApiServer | null = null;
  let error: string | null = null;

  async function startup(): Promise<void> {
    await server?.stop();
    server = createApiServer({
      core,
      port: settings.port,
      token: settings.token,
      extraRoutes: createProducerRoutes(quickMessages),
      version,
    });
    try {
      await server.start();
      error = null;
    } catch (e) {
      server = null;
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const view = (): ApiView => ({
    ...settings,
    running: server !== null,
    error,
    producerUrls: producerUrls(interfaces(), settings.port),
  });

  return {
    startup,
    getView: view,
    getQuickMessages: (): string[] => quickMessages.load(),
    /** Saves the list the Producer page shows: trimmed, no blanks or repeats, within the limits. */
    async setQuickMessages(messages: string[]): Promise<string[]> {
      const clean = (normalizeQuickMessages(messages) ?? [])
        .map((m) => m.slice(0, MAX_QUICK_MESSAGE_LENGTH))
        .slice(0, MAX_QUICK_MESSAGES);
      quickMessages.save(clean);
      return clean;
    },
    async apply(next: ApiSettings): Promise<ApiView> {
      const clean = normalizeApiSettings(next);
      const restart = clean.port !== settings.port || server === null;
      settings = clean;
      store.save(settings);
      if (restart) await startup();
      else server?.setToken(settings.token);
      return view();
    },
    stop: async () => void (await server?.stop()),
  };
}
