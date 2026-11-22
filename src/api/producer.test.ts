import { afterEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock } from '../core';
import { createApiServer, ROUTES, type ApiServer } from './index';
import {
  createMemoryQuickMessageStore,
  createProducerRoutes,
  DEFAULT_QUICK_MESSAGES,
  type QuickMessageStore,
} from './producer';

const servers: ApiServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.stop()));
});

async function setup(opts: { token?: string; store?: QuickMessageStore } = {}) {
  const core = createCore({ clock: createFakeClock() });
  const store = opts.store ?? createMemoryQuickMessageStore();
  const server = createApiServer({
    core,
    port: 0,
    token: opts.token,
    extraRoutes: createProducerRoutes(store),
  });
  servers.push(server);
  const { port } = await server.start();
  const call = (path: string, init: RequestInit = {}) =>
    fetch(`http://127.0.0.1:${port}${path}`, init);
  const save = (messages: unknown, headers: Record<string, string> = {}) =>
    call('/api/quick-messages', { method: 'POST', headers, body: JSON.stringify({ messages }) });
  return { core, store, call, save };
}

describe('Producer page', () => {
  it('is served as HTML with no external resources and no remote URLs', async () => {
    const { call } = await setup();
    const res = await call('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('name="viewport"');
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });
});

/** What a browser sends once its own password box has been filled in: the token is the password. */
const basic = (password: string, user = '') => ({
  authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
});

describe('Producer page token', () => {
  it('needs the token to open, and asks the browser for it', async () => {
    const { call } = await setup({ token: 'sekret-123' });
    const res = await call('/');
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toMatch(/^Basic /i);
    expect(await res.text()).not.toContain('<html');
  });

  it('opens with the token as the Basic password, whatever the username', async () => {
    const { call } = await setup({ token: 'sekret-123' });
    for (const user of ['', 'producer']) {
      const res = await call('/', { headers: basic('sekret-123', user) });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/text\/html/);
      expect(await res.text()).not.toContain('sekret-123');
    }
  });

  it('rejects a wrong password, an empty one, and a token in the URL', async () => {
    const { call } = await setup({ token: 'sekret-123' });
    expect((await call('/', { headers: basic('wrong') })).status).toBe(401);
    expect((await call('/', { headers: basic('') })).status).toBe(401);
    expect((await call('/?token=sekret-123')).status).toBe(401);
  });

  it('takes a token that contains a colon', async () => {
    const { call } = await setup({ token: 'a:b:c' });
    expect((await call('/', { headers: basic('a:b:c') })).status).toBe(200);
  });

  it('lets the page reach the data routes with the same browser credentials', async () => {
    const { core, call } = await setup({ token: 'sekret-123' });
    const h = basic('sekret-123');
    expect((await call('/api/quick-messages', { headers: h })).status).toBe(200);
    const sent = await call('/api/notify', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ text: 'Wrap up' }),
    });
    expect(sent.status).toBe(202);
    expect(core.getState().notifications.map((n) => n.text)).toEqual(['Wrap up']);
  });

  it('still accepts the Bearer and X-Neoprompter-Token headers that Companion sends', async () => {
    const { call } = await setup({ token: 'sekret-123' });
    expect((await call('/', { headers: { authorization: 'Bearer sekret-123' } })).status).toBe(200);
    expect((await call('/', { headers: { 'x-neoprompter-token': 'sekret-123' } })).status).toBe(
      200,
    );
  });

  it('is open when no token is set', async () => {
    const { call } = await setup();
    expect((await call('/')).status).toBe(200);
  });
});

describe('quick messages', () => {
  it('starts with sensible defaults', async () => {
    const { call } = await setup();
    const body = await (await call('/api/quick-messages')).json();
    expect(body.messages).toEqual(DEFAULT_QUICK_MESSAGES);
    expect(DEFAULT_QUICK_MESSAGES).toEqual(
      expect.arrayContaining(['Slow down', 'Wrap up', 'Pause']),
    );
  });

  it('saves an edited list, shared with every reader and persisted in the store', async () => {
    const { call, save, store } = await setup({ token: 't' });
    const h = { 'x-neoprompter-token': 't' };
    const res = await save(['  Louder ', 'Wrap up', 'Louder', ''], h);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ messages: ['Louder', 'Wrap up'] });
    expect((await (await call('/api/quick-messages', { headers: h })).json()).messages).toEqual([
      'Louder',
      'Wrap up',
    ]);
    expect(store.load()).toEqual(['Louder', 'Wrap up']);
  });

  it('survives a restart through the store', async () => {
    const store = createMemoryQuickMessageStore();
    await (await setup({ store })).save(['One']);
    const { call } = await setup({ store });
    expect((await (await call('/api/quick-messages')).json()).messages).toEqual(['One']);
  });

  it('allows removing every button', async () => {
    const { call, save } = await setup();
    expect((await save([])).status).toBe(200);
    expect((await (await call('/api/quick-messages')).json()).messages).toEqual([]);
  });

  it('rejects bad lists and keeps the old one', async () => {
    const { call, save } = await setup();
    expect((await save('nope')).status).toBe(400);
    expect((await save([1])).status).toBe(400);
    expect((await save(['x'.repeat(501)])).status).toBe(400);
    expect((await save(Array.from({ length: 60 }, (_, i) => `m${i}`))).status).toBe(400);
    expect((await call('/api/quick-messages', { method: 'POST', body: '{bad' })).status).toBe(400);
    expect((await (await call('/api/quick-messages')).json()).messages).toEqual(
      DEFAULT_QUICK_MESSAGES,
    );
  });
});

describe('sending from the page', () => {
  it('a notify call results in a Notification in core state', async () => {
    const { core, call } = await setup({ token: 't' });
    const res = await call('/api/notify', {
      method: 'POST',
      headers: { authorization: 'Bearer t' },
      body: JSON.stringify({ text: 'Slow down' }),
    });
    expect(res.status).toBe(202);
    expect(core.getState().notifications.map((n) => n.text)).toEqual(['Slow down']);
  });

  it('the page script posts to /api/notify and keeps no token of its own', async () => {
    const { call } = await setup();
    const html = await (await call('/')).text();
    expect(html).toContain('/api/notify');
    expect(html).toContain('/api/quick-messages');
    // The browser holds the credentials after its own prompt; the page stores and sends none.
    expect(html).not.toContain('localStorage');
    expect(html).not.toContain('X-Neoprompter-Token');
  });
});

describe('route table', () => {
  it('adds only the page and the quick-message list, and nothing for transport', () => {
    const all = [...ROUTES, ...createProducerRoutes(createMemoryQuickMessageStore())]
      .map((r) => `${r.method} ${r.path}`)
      .sort();
    expect(all).toEqual([
      'GET /',
      'GET /api/quick-messages',
      'GET /api/status',
      'POST /api/notify',
      'POST /api/quick-messages',
    ]);
  });
});
