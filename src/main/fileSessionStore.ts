import type { Session, SessionStore } from '../core';
import { createJsonFile } from './jsonFile';

/** Last session persisted as JSON on disk (main process only). Writes are atomic via rename. */
export function createFileSessionStore(file: string): SessionStore {
  const json = createJsonFile<Session | null>(file, { fallback: () => null, atomic: true });
  return { load: json.read, save: json.write };
}
