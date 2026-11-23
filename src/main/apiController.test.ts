import { afterEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock } from '../core';
import { createMemoryApiSettingsStore } from '../api';
import { createMemoryQuickMessageStore } from '../api/producer';
import { createApiController } from './apiController';

const controllers: Array<ReturnType<typeof createApiController>> = [];
afterEach(async () => {
  await Promise.all(controllers.splice(0).map((c) => c.stop()));
});

let PORT = 47930;
async function setup() {
  PORT += 3; // a fresh port each time, so no keep-alive connection reaches an old server
  const controller = createApiController(
    createCore({ clock: createFakeClock() }),
    createMemoryApiSettingsStore({ port: PORT, token: 'abc' }),
    createMemoryQuickMessageStore(['Wrap up']),
    () => ({ en0: [{ address: '192.168.1.20', family: 'IPv4', internal: false }] }),
  );
  controllers.push(controller);
  await controller.startup();
  return controller;
}
const basic = (password: string) => ({
  authorization: `Basic ${Buffer.from(`:${password}`).toString('base64')}`,
});

describe('API controller', () => {
  it('reports where the Producer page can be opened', async () => {
    const c = await setup();
    expect(c.getView().producerUrls).toEqual([`http://192.168.1.20:${PORT}/`]);
    const next = await c.apply({ port: PORT + 1, token: 'abc' });
    expect(next.producerUrls).toEqual([`http://192.168.1.20:${PORT + 1}/`]);
  });

  it('serves a changed list of Quick messages on the Producer page, behind the token', async () => {
    const c = await setup();
    expect(c.getQuickMessages()).toEqual(['Wrap up']);
    expect(await c.setQuickMessages(['  Slow down ', 'Pause', 'Pause', ''])).toEqual([
      'Slow down',
      'Pause',
    ]);
    const url = `http://127.0.0.1:${PORT}/api/quick-messages`;
    expect((await fetch(url)).status).toBe(401);
    const res = await fetch(url, { headers: basic('abc') });
    expect(await res.json()).toEqual({ messages: ['Slow down', 'Pause'] });
  });

  it('keeps asking for the new token after it changes', async () => {
    const c = await setup();
    await c.apply({ port: PORT, token: 'new' });
    const url = `http://127.0.0.1:${PORT}/`;
    expect((await fetch(url, { headers: basic('abc') })).status).toBe(401);
    expect((await fetch(url, { headers: basic('new') })).status).toBe(200);
  });
});
