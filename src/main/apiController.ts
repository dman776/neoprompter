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
  type QuickMessageStore,
} from '../api/producer';
import type { Core } from '../core';

/** Owns the running API server: starts it from saved settings and restarts it when they change. */
export function createApiController(
  core: Core,
  store: ApiSettingsStore,
  quickMessages: QuickMessageStore = createMemoryQuickMessageStore(),
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
    });
    try {
      await server.start();
      error = null;
    } catch (e) {
      server = null;
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const view = (): ApiView => ({ ...settings, running: server !== null, error });

  return {
    startup,
    getView: view,
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
