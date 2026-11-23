// @vitest-environment jsdom
// Renderer seam: the prompter keyboard shortcuts in Run mode send the same commands as the
// Virtual shuttle's buttons and the transport keys.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock } from '../core';
import { App } from './App';
import { createFakeBridge } from './fakeBridge';

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

async function mount(mode: 'edit' | 'run') {
  const core = createCore({
    clock: createFakeClock(),
    script: { name: 's', lines: Array.from({ length: 200 }, (_, i) => `line ${i}`) },
  });
  core.dispatch({ type: 'setViewport', lines: 10 });
  const { bridge } = createFakeBridge(core);
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  await act(async () => core.dispatch({ type: 'setMode', mode }));
  return core;
}

const press = (key: string, target: Element = document.body) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });

describe('Run mode keyboard shortcuts', () => {
  it('Space plays and pauses', async () => {
    const core = await mount('run');
    await press(' ');
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

  it('keys do nothing while typing, on a focused button, or in Edit mode', async () => {
    const core = await mount('run');
    const input = document.createElement('input');
    host.append(input);
    await press(' ', input);
    const btn = document.createElement('button');
    host.append(btn);
    await press(' ', btn);
    expect(core.getState().playing).toBe(false);
    await act(async () => core.dispatch({ type: 'setMode', mode: 'edit' }));
    await press(' ');
    expect(core.getState().playing).toBe(false);
  });
});
