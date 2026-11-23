// @vitest-environment jsdom
// Renderer seam: Run mode's Script lock switch and the double-click live fix, with a real core.
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

async function mountRun() {
  const core = createCore({
    clock: createFakeClock(),
    script: { name: 'Sunday', lines: ['alpha', 'beta', 'gamma'] },
  });
  core.dispatch({ type: 'setMode', mode: 'run' });
  const { bridge, dispatched } = createFakeBridge(core);
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  return { core, dispatched };
}

const lockSwitch = () =>
  host.querySelector('[data-slot="script-lock"] [role="switch"]') as HTMLElement;
const paragraph = (i: number) =>
  host.querySelectorAll('[data-live="text"] > div')[i] as HTMLElement;
const dblclick = (el: Element) =>
  act(() => void el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));

describe('Run mode: Script lock', () => {
  it('stays reachable when the right column is collapsed', async () => {
    const { core } = await mountRun();
    await act(async () => core.dispatch({ type: 'setRightColumnCollapsed', collapsed: true }));
    expect(host.querySelector('.run-side')).toBeNull();
    const compact = host.querySelector(
      '[data-testid="transport"] [data-testid="script-lock-compact"] [role="switch"]',
    ) as HTMLElement;
    expect(compact).not.toBeNull();
    await act(async () => compact.click());
    expect(core.getState().unlocked).toBe(true);
  });

  it('starts locked and says so', async () => {
    await mountRun();
    expect(lockSwitch().getAttribute('aria-checked')).toBe('false');
    expect(host.querySelector('[data-slot="script-lock"]')!.textContent).toContain(
      'Editing locked',
    );
  });

  it('unlocks and locks again through the core', async () => {
    const { core, dispatched } = await mountRun();
    await act(async () => lockSwitch().click());
    expect(dispatched).toContainEqual({ type: 'setUnlocked', unlocked: true });
    expect(core.getState().unlocked).toBe(true);
    expect(host.querySelector('[data-slot="script-lock"]')!.textContent).toContain('Live edit on');
    await act(async () => lockSwitch().click());
    expect(core.getState().unlocked).toBe(false);
  });

  it('shows locked again after leaving Run mode and coming back', async () => {
    const { core } = await mountRun();
    await act(async () => lockSwitch().click());
    await act(async () => core.dispatch({ type: 'setMode', mode: 'edit' }));
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    expect(lockSwitch().getAttribute('aria-checked')).toBe('false');
  });
});

describe('Run mode: live fix', () => {
  it('does nothing when a paragraph is double-clicked while locked', async () => {
    await mountRun();
    dblclick(paragraph(1));
    expect(host.querySelector('[data-testid="live-fix"]')).toBeNull();
  });

  it('fixes one paragraph, sends a liveFix and does not move the position', async () => {
    const { core, dispatched } = await mountRun();
    await act(async () => lockSwitch().click());
    const position = core.getState().position;
    dblclick(paragraph(1));
    const box = host.querySelector('textarea') as HTMLTextAreaElement;
    expect(box.value).toBe('beta');
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      set.call(box, 'BETA!');
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(dispatched).toContainEqual({ type: 'liveFix', line: 1, text: 'BETA!' });
    expect(core.getState().script.lines).toEqual(['alpha', 'BETA!', 'gamma']);
    expect(core.getState().position).toBe(position);
    expect(host.querySelector('textarea')).toBeNull();
    expect(paragraph(1).textContent).toBe('BETA!');
  });

  it('measures the fixed paragraph again even while the Output is on, without moving the position', async () => {
    // jsdom has no layout: a paragraph longer than ten characters is three lines tall.
    const lineHeight = 48 * 1.4;
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        return ((this as HTMLElement).textContent ?? '').length > 10 ? 3 * lineHeight : lineHeight;
      },
    });
    try {
      const { core, dispatched } = await mountRun();
      await act(async () => core.dispatch({ type: 'setOutput', on: true }));
      const position = core.getState().position;
      await act(async () => lockSwitch().click());
      dblclick(paragraph(1));
      const box = host.querySelector('textarea')!;
      await act(async () => {
        const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
        set.call(box, 'a much longer paragraph now');
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => {
        box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      expect(dispatched).toContainEqual({
        type: 'setLineExtents',
        extents: [1, 3, 1],
        revision: core.getState().scriptRevision,
      });
      expect(core.getState().position).toBe(position);
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original);
    }
  });

  it('cancels with Escape and changes nothing', async () => {
    const { core } = await mountRun();
    await act(async () => lockSwitch().click());
    dblclick(paragraph(0));
    const box = host.querySelector('textarea')!;
    await act(async () => {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(host.querySelector('textarea')).toBeNull();
    expect(core.getState().script.lines[0]).toBe('alpha');
  });
});
