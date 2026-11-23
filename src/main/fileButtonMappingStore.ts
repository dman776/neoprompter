import { normalizeButtonMapping, type ButtonMappingStore } from '../input';
import { createJsonFile } from './jsonFile';

/** The ShuttleXPress button mapping persisted as JSON on disk (main process only). */
export function createFileButtonMappingStore(file: string): ButtonMappingStore {
  const json = createJsonFile(file, {
    parse: normalizeButtonMapping,
    fallback: () => null,
    indent: 2,
    atomic: true,
  });
  return { load: json.read, save: json.write };
}
