import fs from 'node:fs';
import path from 'node:path';
import type { WatchedFolderFs } from '../watched-folder';

/** The real file system for the Watched folder (main process only). */
export const watchedFolderFs: WatchedFolderFs = {
  join: (...parts) => path.join(...parts),
  listFiles(dir) {
    try {
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name);
    } catch {
      return null;
    }
  },
  readFile: (p) => fs.readFileSync(p),
  exists: (p) => fs.existsSync(p),
  moveFile(from, to) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
  },
};
