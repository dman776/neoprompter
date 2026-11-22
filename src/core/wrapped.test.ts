import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';

/** 6 Script lines; the Output reports line 1 wrapping to 3 visual lines and line 4 to 2. */
function setup(viewport = 4) {
  const clock = createFakeClock();
  const lines = Array.from({ length: 6 }, (_, i) => `para ${i}`);
  const core = createCore({ clock, script: { name: 't', lines }, speed: 1 });
  core.dispatch({ type: 'setViewport', lines: viewport });
  const report = (extents: number[]) =>
    core.dispatch({
      type: 'setLineExtents',
      extents,
      revision: core.getState().scriptRevision,
    });
  report([1, 3, 1, 1, 2, 1]); // 9 visual lines
  return { clock, core, report };
}

describe('wrapped paragraphs', () => {
  it('stops at the end of the Script measured in visual lines', () => {
    const { core, clock } = setup(4);
    core.dispatch({ type: 'setSpeed', level: 10 });
    core.dispatch({ type: 'play' });
    clock.advance(60000);
    const s = core.getState();
    expect(s.position).toBe(9 - 4); // last visual line at the bottom, not 6 - 4
    expect(s.playing).toBe(false);
    expect(s.progress).toBe(1);
  });

  it('progress counts visual lines', () => {
    const { core } = setup(4);
    // range: -4 .. 5 = 9 visual lines
    core.dispatch({ type: 'scrollBy', lines: 4.5 });
    expect(core.getState().progress).toBeCloseTo(0.5);
  });

  it('keeps the reading position on the same text when a paragraph above is cut', () => {
    const { core } = setup(2);
    core.dispatch({ type: 'scrollBy', lines: 4 + 6 }); // visual 6 = start of paragraph 4
    expect(core.getState().position).toBe(6);
    core.dispatch({ type: 'cutLines', from: 1, count: 1 }); // removes 3 visual lines
    expect(core.getState().position).toBe(3); // still on the start of "para 4"
  });

  it('keeps the position on the same text when the Output re-measures', () => {
    const { core, report } = setup(2);
    core.dispatch({ type: 'scrollBy', lines: 4 + 6 }); // start of paragraph 4
    report([1, 6, 1, 1, 2, 1]); // paragraph 1 now wraps wider (e.g. font change)
    expect(core.getState().position).toBe(9);
  });

  it('ignores a measurement for an outdated Script', () => {
    const { core } = setup(4);
    const before = core.getState();
    core.dispatch({ type: 'editLine', line: 0, text: 'changed' });
    core.dispatch({
      type: 'setLineExtents',
      extents: [9, 9, 9, 9, 9, 9],
      revision: before.scriptRevision,
    });
    core.dispatch({ type: 'scrollBy', lines: 100 });
    expect(core.getState().position).toBe(9 - 4);
  });
});

describe('script revision', () => {
  it('changes on edits and on loading a Script, not on playback', () => {
    const { core } = setup();
    const r0 = core.getState().scriptRevision;
    core.dispatch({ type: 'scrollBy', lines: 1 });
    expect(core.getState().scriptRevision).toBe(r0);
    core.dispatch({ type: 'editLine', line: 0, text: 'x' });
    const r1 = core.getState().scriptRevision;
    expect(r1).not.toBe(r0);
    core.dispatch({ type: 'saveScript', name: 'a', text: 'x\ny' });
    core.dispatch({ type: 'loadScript', id: core.getState().library[0].id });
    expect(core.getState().scriptRevision).not.toBe(r1);
  });
});
