import { normalizeWindowState, type WindowState } from '../window-host/bounds';
import { createJsonFile } from './jsonFile';

/** Where the Operator left each window (size and position), persisted as JSON (main process only). */
export function createFileWindowStateStore(file: string) {
  const json = createJsonFile<WindowState>(file, {
    parse: normalizeWindowState,
    fallback: () => ({}),
    indent: 2,
    atomic: true,
  });
  return { load: json.read, save: json.write };
}
