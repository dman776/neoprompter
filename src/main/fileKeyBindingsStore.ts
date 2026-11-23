import { normalizeKeyBindings, type KeyBindingsStore } from '../input';
import { createJsonFile } from './jsonFile';

/** The Key bindings persisted as JSON on disk (main process only). */
export function createFileKeyBindingsStore(file: string): KeyBindingsStore {
  const json = createJsonFile(file, {
    parse: normalizeKeyBindings,
    fallback: () => null,
    indent: 2,
    atomic: true,
  });
  return { load: json.read, save: json.write };
}
