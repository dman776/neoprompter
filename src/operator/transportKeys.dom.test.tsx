// @vitest-environment jsdom
// Renderer seam: the prompter keyboard shortcuts in Run mode send the same commands as the
// Virtual shuttle's buttons and the transport keys.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock, SPEED_NUDGE_STEP } from '../core';
import { SPEED_NUDGE_BIG_STEP } from '../core/types';
import { App } from './App';
import {
  BINDABLE_ACTIONS,
  defaultKeyBindings,
  type KeyBindingsView,
  type KeyBindingTable,
} from '../input';
import { createFakeBridge } from './fakeBridge';
import type { PreferencesBridge } from './useCoreState';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function mount(mode: 'edit' | 'run', overrides: Partial<PreferencesBridge> = {}) {
  const core = createCore({
    clock: createFakeClock(),
    script: { name: 's', lines: Array.from({ length: 200 }, (_, i) => `line ${i}`) },
  });
  core.dispatch({ type: 'setViewport', lines: 10 });
  const { bridge } = createFakeBridge(core, overrides);
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  await act(async () => core.dispatch({ type: 'setMode', mode }));
  // Run mode asks the bridge for the Key bindings when it opens; wait for the answer, so a key
  // pressed next sees the table the test set up and not the defaults.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return core;
}

const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
  act(async () => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        code: key === ' ' ? 'Space' : key,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });

describe('Run mode keyboard shortcuts', () => {
  it('Space plays and pauses', async () => {
    const core = await mount('run');
    await press(' ');
    expect(core.getState().playing).toBe(true);
    await press(' ');
    expect(core.getState().playing).toBe(false);
  });

  it('Shift+Space plays in reverse and pauses it, Space plays forward and pauses either way', async () => {
    const core = await mount('run');
    await act(async () => core.dispatch({ type: 'scrollBy', lines: 40 }));
    await press(' ', document.body, { shiftKey: true });
    expect(core.getState().playing).toBe(true);
    expect(core.getState().direction).toBe('reverse');
    // Space is Play / Pause: it pauses whichever way the Script is playing.
    await press(' ');
    expect(core.getState().playing).toBe(false);
    // Space plays forward, and Shift+Space while playing forward turns round to reverse.
    await press(' ');
    expect(core.getState().direction).toBe('forward');
    expect(core.getState().playing).toBe(true);
    await press(' ', document.body, { shiftKey: true });
    expect(core.getState().playing).toBe(true);
    expect(core.getState().direction).toBe('reverse');
    // Shift+Space again pauses it.
    await press(' ', document.body, { shiftKey: true });
    expect(core.getState().playing).toBe(false);
    // Space plays forward again, and pauses.
    await press(' ');
    expect(core.getState().direction).toBe('forward');
    expect(core.getState().playing).toBe(true);
    await press(' ');
    expect(core.getState().playing).toBe(false);
  });

  it('Page Down goes forward a Screen and Page Up back', async () => {
    const core = await mount('run');
    const start = core.getState().position;
    await press('PageDown');
    expect(core.getState().position).toBeGreaterThan(start);
    await press('PageUp');
    expect(core.getState().position).toBe(start);
  });

  it('the Left arrow goes back a Screen and the Right arrow forward a Screen', async () => {
    const core = await mount('run');
    const start = core.getState().position;
    await press('ArrowRight');
    const forward = core.getState().position;
    expect(forward).toBeGreaterThan(start);
    await press('ArrowRight');
    expect(core.getState().position).toBeGreaterThan(forward);
    await press('ArrowLeft');
    await press('ArrowLeft');
    expect(core.getState().position).toBe(start);
  });

  it('the arrows still work right after a button is clicked and holds the focus', async () => {
    const core = await mount('run');
    const btn = document.createElement('button');
    host.append(btn);
    btn.focus();
    const start = core.getState().position;
    await press('ArrowRight', btn);
    expect(core.getState().position).toBeGreaterThan(start);
    await press('ArrowLeft', btn);
    expect(core.getState().position).toBe(start);
  });

  it('the arrows do nothing while typing, and Left and Right leave the speed alone', async () => {
    const core = await mount('run');
    const input = document.createElement('input');
    host.append(input);
    const start = core.getState().position;
    const speed = core.getState().speedLevel;
    await press('ArrowRight', input);
    expect(core.getState().position).toBe(start);
    await press('ArrowRight');
    expect(core.getState().speedLevel).toBe(speed);
  });

  it('keys do nothing while typing in a text field, or in Edit mode', async () => {
    const core = await mount('run');
    const input = document.createElement('input');
    host.append(input);
    await press(' ', input);
    expect(core.getState().playing).toBe(false);
    await act(async () => core.dispatch({ type: 'setMode', mode: 'edit' }));
    await press(' ');
    expect(core.getState().playing).toBe(false);
  });

  it('Space always plays, even when a button still has the focus, and the button is not pressed', async () => {
    const core = await mount('run');
    const btn = document.createElement('button');
    let pressed = 0;
    btn.addEventListener('click', () => pressed++);
    host.append(btn);
    btn.focus();
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => void btn.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(core.getState().playing).toBe(true);
    // The button's own activation on key release is stopped too.
    const up = new KeyboardEvent('keyup', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => void btn.dispatchEvent(up));
    expect(up.defaultPrevented).toBe(true);
    expect(pressed).toBe(0);
    await press(' ', btn);
    expect(core.getState().playing).toBe(false);
  });

  it('Space plays and does not flip the Output switch or the unlock that was just clicked', async () => {
    const core = await mount('run');
    const lamp = host.querySelector('button[role="switch"]') as HTMLButtonElement;
    expect(lamp).not.toBeNull();
    lamp.focus();
    const before = JSON.stringify([core.getState().outputOn, core.getState().unlocked]);
    await press(' ', lamp);
    expect(core.getState().playing).toBe(true);
    expect(JSON.stringify([core.getState().outputOn, core.getState().unlocked])).toBe(before);
  });

  it('Space still works for a button in Edit mode, where it is not the prompter key', async () => {
    const core = await mount('edit');
    const btn = document.createElement('button');
    host.append(btn);
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => void btn.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(core.getState().playing).toBe(false);
  });
});

const viewOf = (changes: KeyBindingTable): KeyBindingsView => ({
  table: { ...defaultKeyBindings(), ...changes },
  actions: [...BINDABLE_ACTIONS],
});
const chord = (
  code: string,
  mods: Partial<Record<'shift' | 'ctrl' | 'alt' | 'meta', boolean>> = {},
) => ({
  code,
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
  ...mods,
});
const pressCode = (code: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  act(async () => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init }),
    );
  });

describe('Run mode Key bindings', () => {
  it('a rebound action runs on its new key and no longer on the old one', async () => {
    const core = await mount('run', {
      getKeyBindings: async () => viewOf({ playPause: [chord('F5')] }),
    });
    await pressCode('Space');
    expect(core.getState().playing).toBe(false);
    await pressCode('F5');
    expect(core.getState().playing).toBe(true);
  });

  it('a binding with a modifier runs', async () => {
    const core = await mount('run', {
      getKeyBindings: async () => viewOf({ playPause: [chord('Space', { ctrl: true })] }),
    });
    await pressCode('Space');
    expect(core.getState().playing).toBe(false);
    await pressCode('Space', { ctrlKey: true });
    expect(core.getState().playing).toBe(true);
  });

  it('follows a change made elsewhere at once', async () => {
    let push: (view: KeyBindingsView) => void = () => {};
    const core = await mount('run', { onKeyBindings: (l) => (push = l) });
    await act(async () => push(viewOf({ playPause: [chord('F6')] })));
    await pressCode('Space');
    expect(core.getState().playing).toBe(false);
    await pressCode('F6');
    expect(core.getState().playing).toBe(true);
  });

  it('does nothing while the Script is unlocked for a live fix', async () => {
    const core = await mount('run');
    await act(async () => core.dispatch({ type: 'setUnlocked', unlocked: true }));
    await pressCode('Space');
    expect(core.getState().playing).toBe(false);
    await act(async () => core.dispatch({ type: 'setUnlocked', unlocked: false }));
    await pressCode('Space');
    expect(core.getState().playing).toBe(true);
  });

  it('holding a key repeats Speed up and Speed down only', async () => {
    const core = await mount('run');
    const speed = core.getState().speedLevel;
    await pressCode('ArrowUp');
    await pressCode('ArrowUp', { repeat: true });
    expect(core.getState().speedLevel).toBeCloseTo(speed + 2 * SPEED_NUDGE_STEP, 5);
    await pressCode('Space');
    await pressCode('Space', { repeat: true });
    expect(core.getState().playing).toBe(true);
    const held = new KeyboardEvent('keydown', {
      code: 'Space',
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => void document.body.dispatchEvent(held));
    expect(held.defaultPrevented).toBe(true);
  });

  it('Shift with a Speed up key makes a bigger step, unless that combination is bound', async () => {
    const core = await mount('run');
    const speed = core.getState().speedLevel;
    await pressCode('ArrowUp', { shiftKey: true });
    expect(core.getState().speedLevel).toBeCloseTo(speed + SPEED_NUDGE_BIG_STEP, 5);
  });

  it('Shift with a Speed up key does not make a bigger step when that combination is bound', async () => {
    const own = await mount('run', {
      getKeyBindings: async () =>
        viewOf({ returnToPlayStart: [chord('ArrowUp', { shift: true })] }),
    });
    const before = own.getState().speedLevel;
    await pressCode('ArrowUp', { shiftKey: true });
    expect(own.getState().speedLevel).toBe(before);
  });

  it('the Reading line slider keeps its own arrow keys', async () => {
    const core = await mount('run');
    const handle = host.querySelector('[data-live="reading-line"]') as HTMLElement;
    const speed = core.getState().speedLevel;
    await pressCode('ArrowUp', {}, handle);
    expect(core.getState().speedLevel).toBe(speed);
  });

  it('a key that is not bound does nothing and is left alone', async () => {
    const core = await mount('run');
    const event = new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true, cancelable: true });
    await act(async () => void document.body.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(core.getState().playing).toBe(false);
  });
});
