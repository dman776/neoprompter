import fs from 'node:fs';
import type { Session, SessionStore } from '../core';

/** Last session persisted as JSON on disk (main process only). Writes are atomic via rename. */
export function createFileSessionStore(file: string): SessionStore {
  return {
    load() {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8')) as Session;
      } catch {
        return null;
      }
    },
    save(session) {
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(session));
      fs.renameSync(tmp, file);
    },
  };
}
