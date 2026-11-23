import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemorySessionStore } from './session';
import type { ScriptLine } from './types';

function setup(lines: ScriptLine[] = ['alpha', 'beta', 'gamma', 'delta']) {
  const env = { clock: createFakeClock(), sessionStore: createMemorySessionStore() };
  const core = createCore({ ...env, script: { name: 'T', lines } });
  return { core, ...env };
}
const lines = (core: ReturnType<typeof createCore>) => core.getState().script.lines;

describe('the Run mode lock', () => {
  it('lets every edit command through in Edit mode', () => {
    const { core } = setup();
    core.dispatch({ type: 'editLine', line: 0, text: 'ALPHA' });
    core.dispatch({ type: 'setScriptLines', lines: ['x', 'y'] });
    core.dispatch({ type: 'cutLines', from: 0, count: 1 });
    expect(lines(core)).toEqual(['y']);
  });

  it('rejects every Script-editing command in Run mode', () => {
    const { core } = setup();
    core.dispatch({ type: 'setMode', mode: 'run' });
    const before = core.getState();
    core.dispatch({ type: 'editLine', line: 0, text: 'changed' });
    core.dispatch({ type: 'setScriptLines', lines: ['x'] });
    core.dispatch({ type: 'cutLines', from: 0, count: 2 });
    core.dispatch({ type: 'colorRange', line: 0, start: 0, end: 3, color: '#ff0000' });
    const after = core.getState();
    expect(after.script).toEqual(before.script);
    expect(after.scriptRevision).toBe(before.scriptRevision);
  });

  it('still rejects them after unlocking: only a live fix is allowed', () => {
    const { core } = setup();
    core.dispatch({ type: 'setMode', mode: 'run' });
    core.dispatch({ type: 'setUnlocked', unlocked: true });
    core.dispatch({ type: 'editLine', line: 0, text: 'changed' });
    core.dispatch({ type: 'cutLines', from: 0, count: 1 });
    expect(lines(core)).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  it('starts locked', () => {
    const { core } = setup();
    expect(core.getState().unlocked).toBe(false);
    core.dispatch({ type: 'setMode', mode: 'run' });
    expect(core.getState().unlocked).toBe(false);
  });

  it('only unlocks in Run mode', () => {
    const { core } = setup();
    core.dispatch({ type: 'setUnlocked', unlocked: true });
    expect(core.getState().unlocked).toBe(false);
  });

  it('re-locks when the mode changes, either way', () => {
    const { core } = setup();
    core.dispatch({ type: 'setMode', mode: 'run' });
    core.dispatch({ type: 'setUnlocked', unlocked: true });
    expect(core.getState().unlocked).toBe(true);
    core.dispatch({ type: 'setMode', mode: 'edit' });
    expect(core.getState().unlocked).toBe(false);
    core.dispatch({ type: 'setMode', mode: 'run' });
    expect(core.getState().unlocked).toBe(false);
  });

  it('is locked after a restart', () => {
    const { core, ...env } = setup();
    core.dispatch({ type: 'setMode', mode: 'run' });
    core.dispatch({ type: 'setUnlocked', unlocked: true });
    expect(createCore(env).getState().unlocked).toBe(false);
  });
});

describe('the live fix', () => {
  function unlocked(wrap?: number[]) {
    const s = setup();
    s.core.dispatch({ type: 'setMode', mode: 'run' });
    s.core.dispatch({ type: 'setUnlocked', unlocked: true });
    if (wrap) {
      s.core.dispatch({ type: 'setViewport', lines: 3 });
      s.core.dispatch({
        type: 'setLineExtents',
        extents: wrap,
        revision: s.core.getState().scriptRevision,
      });
    }
    return s;
  }

  it('replaces the text of one paragraph and bumps the revision so the Output redraws', () => {
    const { core } = unlocked();
    const rev = core.getState().scriptRevision;
    core.dispatch({ type: 'liveFix', line: 1, text: 'BETA' });
    expect(lines(core)).toEqual(['alpha', 'BETA', 'gamma', 'delta']);
    expect(core.getState().scriptRevision).toBe(rev + 1);
  });

  it('does not move the reading position, even in a wrapped paragraph', () => {
    const { core } = unlocked([1, 3, 1, 1]);
    core.dispatch({ type: 'scrollBy', lines: 2.5 });
    const position = core.getState().position;
    core.dispatch({ type: 'liveFix', line: 1, text: 'a much shorter fix' });
    expect(core.getState().position).toBe(position);
    core.dispatch({ type: 'liveFix', line: 0, text: 'also fixed' });
    expect(core.getState().position).toBe(position);
  });

  it('keeps playing', () => {
    const { core } = unlocked([1, 1, 1, 1]);
    core.dispatch({ type: 'play' });
    core.dispatch({ type: 'liveFix', line: 2, text: 'fixed' });
    expect(core.getState().playing).toBe(true);
  });

  it('keeps bold and color on text that did not change', () => {
    const { core } = setup([
      {
        runs: [
          { text: 'Hello ', bold: true },
          { text: 'world', color: '#ff0000' },
        ],
      },
    ]);
    core.dispatch({ type: 'setMode', mode: 'run' });
    core.dispatch({ type: 'setUnlocked', unlocked: true });
    core.dispatch({ type: 'liveFix', line: 0, text: 'Hello there world' });
    expect(JSON.stringify(lines(core))).toContain('"bold":true');
    expect(JSON.stringify(lines(core))).toContain('#ff0000');
  });

  it('stays one paragraph: newlines become spaces', () => {
    const { core } = unlocked();
    core.dispatch({ type: 'liveFix', line: 0, text: 'one\ntwo' });
    expect(lines(core)).toEqual(['one two', 'beta', 'gamma', 'delta']);
  });

  it('is rejected while locked, in Edit mode, or for a line that does not exist', () => {
    const { core } = setup();
    core.dispatch({ type: 'liveFix', line: 0, text: 'no' });
    core.dispatch({ type: 'setMode', mode: 'run' });
    core.dispatch({ type: 'liveFix', line: 0, text: 'no' });
    core.dispatch({ type: 'setUnlocked', unlocked: true });
    core.dispatch({ type: 'liveFix', line: 9, text: 'no' });
    expect(lines(core)).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  it('is rejected once the mode has changed and changed back', () => {
    const { core } = unlocked();
    core.dispatch({ type: 'setMode', mode: 'edit' });
    core.dispatch({ type: 'setMode', mode: 'run' });
    core.dispatch({ type: 'liveFix', line: 0, text: 'no' });
    expect(lines(core)[0]).toBe('alpha');
  });

  it('is saved to the library Script', () => {
    const { core } = setup();
    core.dispatch({ type: 'saveScript', name: 'S', text: 'a\nb' });
    core.dispatch({ type: 'loadScript', id: core.getState().library[0].id });
    core.dispatch({ type: 'setMode', mode: 'run' });
    core.dispatch({ type: 'setUnlocked', unlocked: true });
    core.dispatch({ type: 'liveFix', line: 1, text: 'B' });
    core.dispatch({ type: 'setMode', mode: 'edit' });
    core.dispatch({ type: 'loadScript', id: core.getState().library[0].id });
    expect(lines(core)).toEqual(['a', 'B']);
  });
});
