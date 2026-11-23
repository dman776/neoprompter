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
type Importer = (bytes: Uint8Array, name: string) => ImportResult | Promise<ImportResult>;

function setup(initial: Record<string, string> = {}, importer?: Importer) {
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
  // Imports are async, so let their promises settle after each task fires.
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const advance = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      const next = tasks.filter((t) => t.live && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      now = next.at;
      next.live = false;
      next.fn();
      await settle();
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
    importDocument:
      importer ??
      ((bytes, name): ImportResult => {
        const text = new TextDecoder().decode(bytes);
        if (text === 'BAD') return { ok: false, message: `"${name}" is not readable.` };
        return { ok: true, script: { name: name.replace(/\.docx?$/i, ''), lines: [text] } };
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
  it('Imports what is already in the folder when it starts watching', async () => {
    const t = setup({ '/Drop/Sunday.docx': 'a' });
    await t.watcher.setFolder('/Drop');
    expect(t.names()).toEqual(['Sunday']);
  });

  it('Imports a file dropped while running, once it has settled', async () => {
    const t = setup();
    await t.watcher.setFolder('/Drop');
    t.drop('Sunday.docx', 'a');
    expect(t.names()).toEqual([]);
    await t.advance(SETTLE_MS); // first look: nothing to compare with yet
    expect(t.names()).toEqual([]);
    await t.advance(SETTLE_MS); // second look: unchanged
    expect(t.names()).toEqual(['Sunday']);
    expect(t.disk.has('/Drop/imported/Sunday.docx')).toBe(true);
  });

  it('leaves a file that is still growing, and Imports it once it stops', async () => {
    const t = setup();
    await t.watcher.setFolder('/Drop');
    t.drop('Big.docx', 'a');
    t.growing.set('/Drop/Big.docx', 100);
    await t.advance(SETTLE_MS);
    t.growing.set('/Drop/Big.docx', 200);
    await t.advance(SETTLE_MS);
    t.growing.set('/Drop/Big.docx', 300);
    await t.advance(SETTLE_MS);
    expect(t.names()).toEqual([]);
    await t.advance(SETTLE_MS);
    expect(t.names()).toEqual(['Big']);
  });

  it('checks once for a burst of changes', async () => {
    const t = setup();
    await t.watcher.setFolder('/Drop');
    t.drop('A.docx', 'a');
    t.drop('B.docx', 'b');
    t.drop('C.docx', 'c');
    await t.advance(SETTLE_MS * 2);
    expect(t.names().sort()).toEqual(['A', 'B', 'C']);
  });

  it('reports each pass that did something', async () => {
    const t = setup();
    await t.watcher.setFolder('/Drop');
    t.drop('Sunday.docx', 'a');
    await t.advance(SETTLE_MS * 2);
    expect(t.results.map((r) => r.imported)).toEqual([['Sunday']]);
  });

  it('stops watching when cleared, and drops a check that was waiting', async () => {
    const t = setup();
    await t.watcher.setFolder('/Drop');
    t.drop('Sunday.docx', 'a');
    await t.watcher.setFolder(null);
    await t.advance(SETTLE_MS * 3);
    expect(t.stopped).toEqual(['/Drop']);
    expect(t.names()).toEqual([]);
  });

  it('watches the new folder when another is chosen', async () => {
    const t = setup();
    await t.watcher.setFolder('/Drop');
    await t.watcher.setFolder('/Other');
    expect(t.stopped).toEqual(['/Drop']);
    expect(t.watching).toEqual(['/Drop', '/Other']);
  });

  describe('Run mode', () => {
    it('leaves dropped files alone in Run mode, and Imports them on return to Edit mode', async () => {
      const t = setup();
      await t.watcher.setFolder('/Drop');
      t.core.dispatch({ type: 'setMode', mode: 'run' });
      t.drop('Sunday.docx', 'a');
      t.drop('Prayer.docx', 'b');
      await t.advance(SETTLE_MS * 5);
      expect(t.names()).toEqual([]);
      expect(t.disk.has('/Drop/Sunday.docx')).toBe(true);
      expect(t.results).toEqual([]);

      t.core.dispatch({ type: 'setMode', mode: 'edit' });
      await t.advance(SETTLE_MS * 2);
      expect(t.names().sort()).toEqual(['Prayer', 'Sunday']);
      expect(t.disk.has('/Drop/imported/Sunday.docx')).toBe(true);
    });

    it('holds the files already in the folder when the app starts in Run mode', async () => {
      const t = setup({ '/Drop/Sunday.docx': 'a' });
      t.core.dispatch({ type: 'setMode', mode: 'run' });
      await t.watcher.setFolder('/Drop');
      expect(t.names()).toEqual([]);
      t.core.dispatch({ type: 'setMode', mode: 'edit' });
      await t.advance(SETTLE_MS * 2);
      expect(t.names()).toEqual(['Sunday']);
    });

    it('never tries to save in Run mode', async () => {
      const t = setup();
      await t.watcher.setFolder('/Drop');
      t.core.dispatch({ type: 'setMode', mode: 'run' });
      const dispatched: string[] = [];
      const real = t.core.dispatch;
      t.core.dispatch = (c) => {
        dispatched.push(c.type);
        real(c);
      };
      t.drop('Sunday.docx', 'a');
      await t.advance(SETTLE_MS * 5);
      expect(dispatched).not.toContain('saveScript');
    });

    it('Imports each file once however many times the mode changes', async () => {
      const t = setup();
      await t.watcher.setFolder('/Drop');
      t.core.dispatch({ type: 'setMode', mode: 'run' });
      t.drop('Sunday.docx', 'a');
      t.core.dispatch({ type: 'setMode', mode: 'edit' });
      t.core.dispatch({ type: 'setMode', mode: 'run' });
      t.core.dispatch({ type: 'setMode', mode: 'edit' });
      await t.advance(SETTLE_MS * 4);
      expect(t.names()).toEqual(['Sunday']);
    });
  });

  describe('a file that failed', () => {
    it('is reported once, not again at every later change', async () => {
      const t = setup();
      await t.watcher.setFolder('/Drop');
      t.drop('Broken.doc', 'BAD');
      await t.advance(SETTLE_MS * 2);
      expect(t.results.flatMap((r) => r.failed.map((f) => f.file))).toEqual(['Broken.doc']);
      t.drop('Next.docx', 'ok');
      await t.advance(SETTLE_MS * 2);
      expect(t.names()).toEqual(['Next']);
      expect(t.results.flatMap((r) => r.failed)).toHaveLength(1);
    });

    it('is tried again once the file has changed', async () => {
      const t = setup();
      await t.watcher.setFolder('/Drop');
      t.drop('Fixed.doc', 'BAD');
      await t.advance(SETTLE_MS * 2);
      t.drop('Fixed.doc', 'now good');
      await t.advance(SETTLE_MS * 2);
      expect(t.names()).toEqual(['Fixed']);
    });

    it('is reported again when the folder is chosen again', async () => {
      const t = setup({ '/Drop/Broken.doc': 'BAD' });
      await t.watcher.setFolder('/Drop');
      await t.watcher.setFolder('/Drop');
      expect(t.results.flatMap((r) => r.failed)).toHaveLength(2);
    });
  });

  it('does not Import a file twice when a change arrives during a slow Import', async () => {
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    let calls = 0;
    const t = setup({ '/Drop/Sunday.docx': 'a' }, async (bytes, name) => {
      calls++;
      await gate;
      return { ok: true, script: { name: name.replace(/\.docx$/i, ''), lines: ['a'] } };
    });
    const started = t.watcher.setFolder('/Drop');
    t.drop('Sunday.docx', 'a');
    await t.advance(SETTLE_MS * 3);
    open();
    await started;
    await t.advance(SETTLE_MS * 3);
    expect(calls).toBe(1);
    expect(t.names()).toEqual(['Sunday']);
  });
});
