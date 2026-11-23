import fs from 'node:fs';
import path from 'node:path';
import type { FolderChangeSource, Scheduler, WatchedFolderFs } from '../watched-folder';

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
  stat(p) {
    try {
      const s = fs.statSync(p);
      return { size: s.size, modifiedMs: s.mtimeMs };
    } catch {
      return null;
    }
  },
  moveFile(from, to) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
  },
};

/** Folder changes from `fs.watch`. A folder that cannot be watched (missing) just never reports. */
export const folderChanges: FolderChangeSource = {
  watch(dir, onChange) {
    try {
      const watcher = fs.watch(dir, { persistent: false }, () => onChange());
      watcher.on('error', () => {});
      return () => watcher.close();
    } catch {
      return () => {};
    }
  },
};

export const realScheduler: Scheduler = {
  after(ms, fn) {
    const timer = setTimeout(fn, ms);
    return () => clearTimeout(timer);
  },
};
