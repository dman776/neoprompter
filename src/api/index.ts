import http from 'node:http';
import net from 'node:net';
import { timingSafeEqual } from 'node:crypto';
import type { Core } from '../core';

export const DEFAULT_API_PORT = 4780;
export const MAX_BODY_BYTES = 4096;
export const MAX_NOTIFICATION_TEXT = 500;

/** Persisted API settings. An empty token means "no token required". */
export interface ApiSettings {
  port: number;
  token: string;
}
export const defaultApiSettings: ApiSettings = { port: DEFAULT_API_PORT, token: '' };
export interface ApiSettingsStore {
  load(): ApiSettings;
  save(settings: ApiSettings): void;
}
export function createMemoryApiSettingsStore(initial?: Partial<ApiSettings>): ApiSettingsStore {
  let s: ApiSettings = { ...defaultApiSettings, ...initial };
  return { load: () => ({ ...s }), save: (n) => (s = { ...n }) };
}
/** Sanitise settings read from disk or the UI: a valid port (1024-65535) and a string token. */
export function normalizeApiSettings(raw: Partial<ApiSettings> | null | undefined): ApiSettings {
  const port = Number(raw?.port);
  return {
    port: Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : DEFAULT_API_PORT,
    token: typeof raw?.token === 'string' ? raw.token.trim() : '',
  };
}

/** What the Operator view shows about the API: settings plus whether it is listening. */
export interface ApiView extends ApiSettings {
  running: boolean;
  /** Clear failure message (e.g. port taken) when it could not start; null otherwise. */
  error: string | null;
}

export interface ApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  /** Raw request body (empty for GET), capped at `maxBodyBytes`. */
  body: string;
}
export interface ApiResponse {
  json(status: number, body: unknown): void;
  send(status: number, contentType: string, body: string): void;
}
export interface Route {
  method: 'GET' | 'POST';
  path: string;
  handler(req: ApiRequest, res: ApiResponse): void;
}

/**
 * True for addresses that cannot be reached from the public internet: loopback, RFC 1918
 * (10/8, 172.16/12, 192.168/16), IPv4 link-local (169.254/16), IPv6 loopback, unique-local
 * (fc00::/7) and link-local (fe80::/10), and IPv4-mapped IPv6 forms of those.
 */
export function isPrivateAddress(address: string | undefined): boolean {
  if (!address) return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  const a = mapped ? mapped[1] : address;
  if (net.isIPv4(a)) {
    const [o1, o2] = a.split('.').map(Number);
    return (
      o1 === 127 ||
      o1 === 10 ||
      (o1 === 172 && o2 >= 16 && o2 <= 31) ||
      (o1 === 192 && o2 === 168) ||
      (o1 === 169 && o2 === 254)
    );
  }
  if (net.isIPv6(a)) {
    const lower = a.toLowerCase().split('%')[0];
    if (lower === '::1') return true;
    const first = parseInt(lower.split(':')[0] || '0', 16);
    return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
  }
  return false;
}

/** The whole public surface of the built-in routes. There is deliberately no transport control. */
export const ROUTES: readonly { method: 'GET' | 'POST'; path: string }[] = [
  { method: 'POST', path: '/api/notify' },
  { method: 'GET', path: '/api/status' },
];

export interface ApiServerOptions {
  core: Core;
  port: number;
  token?: string;
  maxBodyBytes?: number;
  /** Override the remote-address gate (tests). Default: `isPrivateAddress`. */
  isAllowedRemote?: (address: string | undefined) => boolean;
  /** Extra routes (such as the Producer page). They sit behind the same address gate and token. */
  extraRoutes?: Route[];
}
export interface ApiServer {
  start(): Promise<{ port: number; host: string }>;
  stop(): Promise<void>;
  setToken(token: string): void;
}

function tokensMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApiServer(options: ApiServerOptions): ApiServer {
  const { core } = options;
  // All interfaces so LAN devices can reach it; the private-address check is the gate.
  const host = '0.0.0.0';
  const maxBody = options.maxBodyBytes ?? MAX_BODY_BYTES;
  const allowed = options.isAllowedRemote ?? isPrivateAddress;
  let token = options.token ?? '';

  const notify: Route = {
    method: 'POST',
    path: '/api/notify',
    handler(req, res) {
      let data: unknown;
      try {
        data = JSON.parse(req.body);
      } catch {
        return res.json(400, { error: 'Body must be JSON: {"text": "...", "durationMs": 5000}' });
      }
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return res.json(400, { error: 'Body must be a JSON object' });
      }
      const { text, durationMs } = data as { text?: unknown; durationMs?: unknown };
      if (typeof text !== 'string' || text.trim() === '') {
        return res.json(400, { error: '"text" must be a non-empty string' });
      }
      if (text.length > MAX_NOTIFICATION_TEXT) {
        return res.json(400, {
          error: `"text" is longer than ${MAX_NOTIFICATION_TEXT} characters`,
        });
      }
      if (
        durationMs !== undefined &&
        (typeof durationMs !== 'number' || !(durationMs > 0) || !isFinite(durationMs))
      ) {
        return res.json(400, { error: '"durationMs" must be a positive number of milliseconds' });
      }
      core.dispatch({ type: 'notify', text, durationMs });
      res.json(202, { ok: true });
    },
  };
  const status: Route = {
    method: 'GET',
    path: '/api/status',
    handler(_req, res) {
      const s = core.getState();
      res.json(200, {
        script: s.script.name,
        state: s.playing ? 'playing' : 'paused',
        playing: s.playing,
        position: s.position,
        progress: s.progress,
      });
    },
  };
  const routes: Route[] = [notify, status, ...(options.extraRoutes ?? [])];

  /**
   * The token arrives as `Authorization: Bearer`, `X-Neoprompter-Token` (Companion), or as the
   * password of HTTP Basic (a browser's own prompt for the Producer page; the username is ignored).
   */
  function givenToken(req: http.IncomingMessage): string {
    const auth = req.headers.authorization ?? '';
    const bearer = /^Bearer (.+)$/i.exec(auth)?.[1];
    if (bearer !== undefined) return bearer;
    const basic = /^Basic (.+)$/i.exec(auth)?.[1];
    if (basic !== undefined) {
      const credentials = Buffer.from(basic, 'base64').toString('utf8');
      return credentials.slice(credentials.indexOf(':') + 1);
    }
    const header = req.headers['x-neoprompter-token'];
    return typeof header === 'string' ? header : '';
  }
  const authorized = (req: http.IncomingMessage): boolean =>
    !token || tokensMatch(givenToken(req), token);

  const server = http.createServer((req, httpRes) => {
    const send = (
      status: number,
      contentType: string,
      body: string,
      extra: Record<string, string | string[]> = {},
    ) => {
      httpRes.writeHead(status, {
        'content-type': contentType,
        'cache-control': 'no-store',
        ...extra,
      });
      httpRes.end(body);
    };
    const json = (status: number, body: unknown, extra?: Record<string, string | string[]>) =>
      send(status, 'application/json; charset=utf-8', JSON.stringify(body), extra);

    // 1. Address gate, 2. token, 3. routing. Everything, including 404s, passes the first two.
    if (!allowed(req.socket.remoteAddress)) return json(403, { error: 'Local network only' });
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!authorized(req)) {
      // Basic makes a browser ask for the token; Bearer tells API clients what to send.
      return json(
        401,
        { error: 'Missing or wrong token' },
        { 'www-authenticate': ['Basic realm="Neoprompter", charset="UTF-8"', 'Bearer'] },
      );
    }
    const matching = routes.filter((r) => r.path === url.pathname);
    if (matching.length === 0) return json(404, { error: 'Not found' });
    const route = matching.find((r) => r.method === req.method);
    if (!route) {
      return json(
        405,
        { error: 'Method not allowed' },
        { allow: matching.map((r) => r.method).join(', ') },
      );
    }

    const declared = Number(req.headers['content-length'] ?? 0);
    let body = '';
    let size = 0;
    let tooBig = declared > maxBody;
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      size += Buffer.byteLength(chunk);
      if (size > maxBody) tooBig = true;
      else if (!tooBig) body += chunk;
    });
    req.on('end', () => {
      if (tooBig) return json(413, { error: `Body larger than ${maxBody} bytes` });
      try {
        route.handler(
          { method: route.method, path: url.pathname, query: url.searchParams, body },
          { json: (s, b) => json(s, b), send: (s, t, b) => send(s, t, b) },
        );
      } catch {
        json(500, { error: 'Internal error' });
      }
    });
    req.on('error', () => httpRes.destroy());
  });

  return {
    setToken: (t) => {
      token = t;
    },
    start: () =>
      new Promise((resolve, reject) => {
        server.once('error', (err: NodeJS.ErrnoException) => {
          const why =
            err.code === 'EADDRINUSE'
              ? `Port ${options.port} is already in use by another program. Choose a different port for the Companion API.`
              : err.code === 'EACCES'
                ? `Not allowed to listen on port ${options.port}. Choose a port of 1024 or higher.`
                : `The Companion API could not start on port ${options.port}: ${err.message}`;
          reject(new Error(why));
        });
        server.listen(options.port, host, () => {
          resolve({ port: (server.address() as net.AddressInfo).port, host });
        });
      }),
    stop: () =>
      new Promise((resolve) => {
        if (!server.listening) return resolve();
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
