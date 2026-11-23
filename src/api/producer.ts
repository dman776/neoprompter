import { isNotificationColor, type NotificationColor } from '../core';
import type { Route } from './index';
import { PRODUCER_PAGE } from './producerPage';

/** A saved Notification text, with the palette color it shows in. No color means neutral. */
export interface QuickMessage {
  text: string;
  color?: NotificationColor;
}

export const DEFAULT_QUICK_MESSAGES: readonly QuickMessage[] = [
  { text: 'Slow down', color: 'amber' },
  { text: 'Speed up', color: 'blue' },
  { text: 'Wrap up', color: 'red' },
  { text: 'Pause', color: 'purple' },
  { text: 'Look at camera', color: 'green' },
];
export const MAX_QUICK_MESSAGES = 30;
export const MAX_QUICK_MESSAGE_LENGTH = 500;

/** The shared Producer quick-message list. One list for every browser; persisted by the app. */
export interface QuickMessageStore {
  load(): QuickMessage[];
  save(messages: QuickMessage[]): void;
}
export function createMemoryQuickMessageStore(initial?: QuickMessage[]): QuickMessageStore {
  const copy = (list: readonly QuickMessage[]) => list.map((m) => ({ ...m }));
  let list = copy(initial ?? DEFAULT_QUICK_MESSAGES);
  return { load: () => copy(list), save: (m) => (list = copy(m)) };
}
/**
 * Trim, drop blanks and repeated texts (the first one wins). Each item is a plain string (no
 * color, which is what older saved lists hold) or `{text, color?}`; an unknown color is dropped.
 * Used for data read from disk too. Null when it is not a list of those.
 */
export function normalizeQuickMessages(raw: unknown): QuickMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: QuickMessage[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let text: unknown;
    let color: unknown;
    if (typeof item === 'string') text = item;
    else if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      ({ text, color } = item as { text?: unknown; color?: unknown });
    }
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (trimmed === '' || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(isNotificationColor(color) ? { text: trimmed, color } : { text: trimmed });
  }
  return out;
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
        if (list.some((m) => m.text.length > MAX_QUICK_MESSAGE_LENGTH)) {
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
