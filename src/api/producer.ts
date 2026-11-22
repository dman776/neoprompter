import type { Route } from './index';
import { PRODUCER_PAGE } from './producerPage';

export const DEFAULT_QUICK_MESSAGES: readonly string[] = [
  'Slow down',
  'Speed up',
  'Wrap up',
  'Pause',
  'Look at camera',
];
export const MAX_QUICK_MESSAGES = 30;
export const MAX_QUICK_MESSAGE_LENGTH = 500;

/** The shared Producer quick-message list. One list for every browser; persisted by the app. */
export interface QuickMessageStore {
  load(): string[];
  save(messages: string[]): void;
}
export function createMemoryQuickMessageStore(initial?: string[]): QuickMessageStore {
  let list = initial ? [...initial] : [...DEFAULT_QUICK_MESSAGES];
  return { load: () => [...list], save: (m) => (list = [...m]) };
}
/** Trim, drop blanks and duplicates. Used for data read from disk too. Null when not a list of strings. */
export function normalizeQuickMessages(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.some((m) => typeof m !== 'string')) return null;
  return [...new Set((raw as string[]).map((m) => m.trim()).filter((m) => m !== ''))];
}

/** The Producer page plus the quick-message list. Nothing here touches transport. */
export function createProducerRoutes(store: QuickMessageStore): Route[] {
  return [
    {
      method: 'GET',
      path: '/',
      handler: (_req, res) => res.send(200, 'text/html; charset=utf-8', PRODUCER_PAGE),
    },
    {
      method: 'GET',
      path: '/api/quick-messages',
      handler: (_req, res) => res.json(200, { messages: store.load() }),
    },
    {
      method: 'POST',
      path: '/api/quick-messages',
      handler(req, res) {
        let data: unknown;
        try {
          data = JSON.parse(req.body);
        } catch {
          return res.json(400, { error: 'Body must be JSON: {"messages": ["..."]}' });
        }
        const list = normalizeQuickMessages((data as { messages?: unknown } | null)?.messages);
        if (!list) return res.json(400, { error: '"messages" must be a list of strings' });
        if (list.length > MAX_QUICK_MESSAGES)
          return res.json(400, { error: `At most ${MAX_QUICK_MESSAGES} quick messages` });
        if (list.some((m) => m.length > MAX_QUICK_MESSAGE_LENGTH)) {
          return res.json(400, {
            error: `Each quick message must be ${MAX_QUICK_MESSAGE_LENGTH} characters or fewer`,
          });
        }
        store.save(list);
        res.json(200, { messages: list });
      },
    },
  ];
}
