import fs from 'node:fs';
import { DEFAULT_QUICK_MESSAGES, normalizeQuickMessages, type QuickMessageStore } from '../api/producer';

/** The shared Producer quick-message list persisted as JSON on disk (main process only). */
export function createFileQuickMessageStore(file: string): QuickMessageStore {
  return {
    load() {
      try {
        return normalizeQuickMessages(JSON.parse(fs.readFileSync(file, 'utf8'))) ?? [...DEFAULT_QUICK_MESSAGES];
      } catch {
        return [...DEFAULT_QUICK_MESSAGES];
      }
    },
    save(messages) {
      fs.writeFileSync(file, JSON.stringify(messages));
    },
  };
}
