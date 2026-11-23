import { describe, expect, it } from 'vitest';
import { createCore, createFakeClock, outputState } from './index';

describe('the Output switch', () => {
  it('switches the Output on and off and keeps the reading position', () => {
    const clock = createFakeClock();
    const core = createCore({ clock });
    core.dispatch({ type: 'jumpForward' });
    const position = core.getState().position;
    core.dispatch({ type: 'setOutput', on: true });
    expect(core.getState().outputOn).toBe(true);
    core.dispatch({ type: 'setOutput', on: false });
    expect(core.getState().outputOn).toBe(false);
    expect(core.getState().position).toBe(position);
  });

  it('ignores a value that is not on or off', () => {
    const core = createCore({ clock: createFakeClock() });
    core.dispatch({ type: 'setOutput', on: 'yes' as never });
    expect(core.getState().outputOn).toBe(false);
  });

  it('is part of what the Output window receives', () => {
    const core = createCore({ clock: createFakeClock() });
    core.dispatch({ type: 'setOutput', on: true });
    expect(outputState(core.getState()).outputOn).toBe(true);
  });
});
