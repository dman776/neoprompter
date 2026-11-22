import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock, DEFAULT_NOTIFICATION_MS } from '../core';
import { createApiServer, isPrivateAddress, ROUTES, type ApiServer } from './index';

const servers: ApiServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.stop()));
});

async function setup(opts: { token?: string; maxBodyBytes?: number; allow?: () => boolean } = {}) {
  const clock = createFakeClock();
  const core = createCore({ clock });
  const server = createApiServer({
    core,
    port: 0,
    host: '127.0.0.1',
    token: opts.token,
    maxBodyBytes: opts.maxBodyBytes,
    isAllowedRemote: opts.allow,
  });
  servers.push(server);
  const { port } = await server.start();
  const call = (path: string, init: RequestInit = {}) => fetch(`http://127.0.0.1:${port}${path}`, init);
  const post = (body: unknown, headers: Record<string, string> = {}, path = '/api/notify') =>
    call(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { clock, core, server, port, call, post };
}
const texts = (core: ReturnType<typeof createCore>) => core.getState().notifications.map((n) => n.text);

describe('POST /api/notify', () => {
  it('shows a Notification for the default time', async () => {
    const { clock, core, post } = await setup();
    const res = await post({ text: 'Wrap up' });
    expect(res.status).toBe(202);
    expect(texts(core)).toEqual(['Wrap up']);
    clock.advance(DEFAULT_NOTIFICATION_MS);
    expect(texts(core)).toEqual([]);
  });

  it('honours an optional display time', async () => {
    const { clock, core, post } = await setup();
    await post({ text: 'Quick', durationMs: 1500 });
    clock.advance(1499);
    expect(texts(core)).toEqual(['Quick']);
    clock.advance(1);
    expect(texts(core)).toEqual([]);
  });

  it('rejects bad input with 400 and shows nothing', async () => {
    const { core, post } = await setup();
    expect((await post('{nope')).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ text: '   ' })).status).toBe(400);
    expect((await post({ text: 5 })).status).toBe(400);
    expect((await post({ text: 'x', durationMs: 'soon' })).status).toBe(400);
    expect((await post({ text: 'x', durationMs: -1 })).status).toBe(400);
    expect((await post({ text: 'x'.repeat(1000) })).status).toBe(400);
    expect((await post([1])).status).toBe(400);
    expect(texts(core)).toEqual([]);
  });

  it('rejects an oversized body with 413', async () => {
    const { core, post } = await setup({ maxBodyBytes: 100 });
    const res = await post({ text: 'x'.repeat(300) });
    expect(res.status).toBe(413);
    expect(texts(core)).toEqual([]);
  });

  it('rejects the wrong method with 405 and an Allow header', async () => {
    const { call } = await setup();
    const res = await call('/api/notify');
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });
});

describe('GET /api/status', () => {
  it('reports Script name, play state, position and progress', async () => {
    const { core, call } = await setup();
    const paused = await (await call('/api/status')).json();
    expect(paused).toMatchObject({
      script: core.getState().script.name,
      state: 'paused',
      playing: false,
      position: core.getState().position,
      progress: core.getState().progress,
    });
    core.dispatch({ type: 'play' });
    expect((await (await call('/api/status')).json()).state).toBe('playing');
  });

  it('rejects POST with 405', async () => {
    const { post } = await setup();
    expect((await post({}, {}, '/api/status')).status).toBe(405);
  });
});

describe('token', () => {
  it('is not required when none is set', async () => {
    const { call } = await setup();
    expect((await call('/api/status')).status).toBe(200);
  });

  it('rejects missing or wrong tokens with 401 and does not notify', async () => {
    const { core, call, post } = await setup({ token: 's3cret' });
    expect((await call('/api/status')).status).toBe(401);
    expect((await call('/api/status', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
    expect((await post({ text: 'x' })).status).toBe(401);
    expect(texts(core)).toEqual([]);
  });

  it('accepts a bearer header, an X-Neoprompter-Token header or a ?token= query', async () => {
    const { core, call, post } = await setup({ token: 's3cret' });
    expect((await call('/api/status', { headers: { authorization: 'Bearer s3cret' } })).status).toBe(200);
    expect((await call('/api/status', { headers: { 'x-neoprompter-token': 's3cret' } })).status).toBe(200);
    expect((await call('/api/status?token=s3cret')).status).toBe(200);
    expect((await post({ text: 'ok' }, { 'x-neoprompter-token': 's3cret' })).status).toBe(202);
    expect(texts(core)).toEqual(['ok']);
  });

  it('applies to unknown routes too, so they cannot be probed', async () => {
    const { call } = await setup({ token: 's3cret' });
    expect((await call('/nope')).status).toBe(401);
  });

  it('a token change takes effect without restarting', async () => {
    const { server, call } = await setup({ token: 'a' });
    server.setToken('b');
    expect((await call('/api/status?token=a')).status).toBe(401);
    expect((await call('/api/status?token=b')).status).toBe(200);
  });
});

describe('local network only', () => {
  it('classifies addresses', () => {
    for (const ok of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.20',
      '169.254.3.4', '::1', 'fe80::1', 'fd12:3456::1', '::ffff:192.168.1.5', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(ok), ok).toBe(true);
    }
    for (const bad of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.0.1', '100.64.0.1',
      '2001:4860:4860::8888', '::ffff:8.8.8.8', '', 'garbage', undefined]) {
      expect(isPrivateAddress(bad), String(bad)).toBe(false);
    }
  });

  it('rejects non-private remote addresses with 403 before anything else', async () => {
    const { core, call, post } = await setup({ allow: () => false });
    expect((await call('/api/status')).status).toBe(403);
    expect((await post({ text: 'x' })).status).toBe(403);
    expect(texts(core)).toEqual([]);
  });

  it('binds all interfaces by default (the remote-address check is the gate)', async () => {
    const server = createApiServer({ core: createCore({ clock: createFakeClock() }), port: 0 });
    servers.push(server);
    const info = await server.start();
    expect(info.host).toBe('0.0.0.0');
  });
});

describe('route table', () => {
  it('exposes only notify and status as built-ins (no transport control)', () => {
    expect(ROUTES.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      'GET /api/status',
      'POST /api/notify',
    ]);
  });

  it('answers 404 or 405 to transport-like routes and never moves the core', async () => {
    const { core, call } = await setup();
    const before = JSON.stringify(core.getState());
    const paths = ['/api', '/api/play', '/api/pause', '/api/stop', '/api/start', '/api/speed',
      '/api/scroll', '/api/jump', '/api/position', '/api/script', '/api/load', '/api/loadScript',
      '/api/command', '/api/dispatch', '/api/notify/../play', '/api/status/play', '/play', '/pause'];
    for (const path of paths) {
      for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']) {
        const res = await call(path, { method, body: method === 'GET' ? undefined : '{"type":"play"}' });
        expect([404, 405], `${method} ${path}`).toContain(res.status);
        if (res.status === 405) expect(['/api/notify', '/api/status']).toContain(path);
      }
    }
    expect(JSON.stringify(core.getState())).toBe(before);
    expect(core.getState().playing).toBe(false);
  });
});

describe('start', () => {
  it('fails with a clear message when the port is taken', async () => {
    const blocker = net.createServer();
    await new Promise<void>((r) => blocker.listen(0, '127.0.0.1', r));
    const taken = (blocker.address() as net.AddressInfo).port;
    const server = createApiServer({ core: createCore({ clock: createFakeClock() }), port: taken, host: '127.0.0.1' });
    servers.push(server);
    await expect(server.start()).rejects.toThrow(new RegExp(`port ${taken}.*already in use`, 'i'));
    await new Promise((r) => blocker.close(r));
  });
});

describe('extension', () => {
  it('lets another module add routes behind the same auth', async () => {
    const core = createCore({ clock: createFakeClock() });
    const server = createApiServer({
      core,
      port: 0,
      host: '127.0.0.1',
      token: 't',
      extraRoutes: [{ method: 'GET', path: '/', handler: (_req, res) => res.json(200, { page: true }) }],
    });
    servers.push(server);
    const { port } = await server.start();
    expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(401);
    expect((await fetch(`http://127.0.0.1:${port}/?token=t`)).status).toBe(200);
  });
});

describe('POST /api/notify display time cap', () => {
  it('caps a huge durationMs at the display-time maximum', async () => {
    const { clock, core, post } = await setup();
    expect((await post({ text: 'x', durationMs: 1e9 })).status).toBe(202);
    clock.advance(60000);
    expect(texts(core)).toEqual([]);
  });
});
