import { describe, expect, it } from 'vitest';
import { createCore, createFakeClock, createMemoryLibraryStorage } from '../core';
import type { ImportResult } from '../import';
import {
  createFolderWatcher,
  SETTLE_MS,
  type FolderChangeSource,
  type Scheduler,
  type WatchedFolderFs,
  type WatchedFolderResult,
} from './index';

/** A fake disk of path -> bytes, plus a size override so a file can look like it is growing. */
function setup(initial: Record<string, string> = {}) {
  const disk = new Map(Object.entries(initial));
  const growing = new Map<string, number>();
  const fs: WatchedFolderFs = {
    join: (...p) => p.join('/'),
    listFiles(dir) {
      const prefix = `${dir}/`;
      return [...disk.keys()]
        .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .map((p) => p.slice(prefix.length));
    },
    readFile: (p) => new TextEncoder().encode(disk.get(p) ?? ''),
    exists: (p) => disk.has(p),
    stat: (p) =>
      disk.has(p) ? { size: growing.get(p) ?? disk.get(p)!.length, modifiedMs: 0 } : null,
    moveFile(from, to) {
      disk.set(to, disk.get(from)!);
      disk.delete(from);
    },
  };

  // Time: tasks fire in order as `advance` moves the clock past them.
  let now = 0;
  const tasks: Array<{ at: number; fn: () => void; live: boolean }> = [];
  const scheduler: Scheduler = {
    after(ms, fn) {
      const task = { at: now + ms, fn, live: true };
      tasks.push(task);
      return () => (task.live = false);
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const next = tasks.filter((t) => t.live && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      now = next.at;
      next.live = false;
      next.fn();
    }
    now = end;
  };

  const watching: string[] = [];
  const stopped: string[] = [];
  let notify: () => void = () => {};
  const changes: FolderChangeSource = {
    watch(dir, onChange) {
      watching.push(dir);
      notify = onChange;
      return () => stopped.push(dir);
    },
  };

  const core = createCore({
    clock: createFakeClock(),
    libraryStorage: createMemoryLibraryStorage(),
  });
  const results: WatchedFolderResult[] = [];
  const watcher = createFolderWatcher({
    fs,
    core,
    changes,
    scheduler,
    importDocument: (bytes, name): ImportResult => ({
      ok: true,
      script: { name: name.replace(/\.docx?$/i, ''), lines: [new TextDecoder().decode(bytes)] },
    }),
    onResult: (r) => results.push(r),
  });
  const names = () => core.getState().library.map((s) => s.name);
  return {
    disk,
    growing,
    watcher,
    core,
    advance,
    names,
    results,
    watching,
    stopped,
    drop(file: string, text: string) {
      disk.set(`/Drop/${file}`, text);
      notify();
    },
  };
}

describe('createFolderWatcher', () => {
  it('Imports what is already in the folder when it starts watching', () => {
    const t = setup({ '/Drop/Sunday.docx': 'a' });
    t.watcher.setFolder('/Drop');
    expect(t.names()).toEqual(['Sunday']);
  });

  it('Imports a file dropped while running, once it has settled', () => {
    const t = setup();
    t.watcher.setFolder('/Drop');
    t.drop('Sunday.docx', 'a');
    expect(t.names()).toEqual([]);
    t.advance(SETTLE_MS); // first look: nothing to compare with yet
    expect(t.names()).toEqual([]);
    t.advance(SETTLE_MS); // second look: unchanged
    expect(t.names()).toEqual(['Sunday']);
    expect(t.disk.has('/Drop/imported/Sunday.docx')).toBe(true);
  });

  it('leaves a file that is still growing, and Imports it once it stops', () => {
    const t = setup();
    t.watcher.setFolder('/Drop');
    t.drop('Big.docx', 'a');
    t.growing.set('/Drop/Big.docx', 100);
    t.advance(SETTLE_MS);
    t.growing.set('/Drop/Big.docx', 200);
    t.advance(SETTLE_MS);
    t.growing.set('/Drop/Big.docx', 300);
    t.advance(SETTLE_MS);
    expect(t.names()).toEqual([]);
    t.advance(SETTLE_MS);
    expect(t.names()).toEqual(['Big']);
  });

  it('checks once for a burst of changes', () => {
    const t = setup();
    t.watcher.setFolder('/Drop');
    t.drop('A.docx', 'a');
    t.drop('B.docx', 'b');
    t.drop('C.docx', 'c');
    t.advance(SETTLE_MS * 2);
    expect(t.names().sort()).toEqual(['A', 'B', 'C']);
  });

  it('reports each pass that did something', () => {
    const t = setup();
    t.watcher.setFolder('/Drop');
    t.drop('Sunday.docx', 'a');
    t.advance(SETTLE_MS * 2);
    expect(t.results.map((r) => r.imported)).toEqual([['Sunday']]);
  });

  it('stops watching when cleared, and drops a check that was waiting', () => {
    const t = setup();
    t.watcher.setFolder('/Drop');
    t.drop('Sunday.docx', 'a');
    t.watcher.setFolder(null);
    t.advance(SETTLE_MS * 3);
    expect(t.stopped).toEqual(['/Drop']);
    expect(t.names()).toEqual([]);
  });

  it('watches the new folder when another is chosen', () => {
    const t = setup();
    t.watcher.setFolder('/Drop');
    t.watcher.setFolder('/Other');
    expect(t.stopped).toEqual(['/Drop']);
    expect(t.watching).toEqual(['/Drop', '/Other']);
  });
});
