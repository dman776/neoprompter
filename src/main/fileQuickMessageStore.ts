import { DEFAULT_QUICK_MESSAGES, normalizeQuickMessages, type QuickMessageStore } from '../api/producer';
import { createJsonFile } from './jsonFile';

/** The shared Producer quick-message list persisted as JSON on disk (main process only). */
export function createFileQuickMessageStore(file: string): QuickMessageStore {
  const json = createJsonFile(file, {
    parse: normalizeQuickMessages,
    fallback: () => [...DEFAULT_QUICK_MESSAGES],
  });
  return { load: json.read, save: json.write };
}
