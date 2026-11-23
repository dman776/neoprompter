// @vitest-environment jsdom
// Renderer seam: Run mode's Script lock switch and the double-click live fix, with a real core.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock, type Command } from '../core';
import { App } from './App';
import type { CoreBridge } from './useCoreState';

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
  const dispatched: Command[] = [];
  const listeners: Array<(s: ReturnType<typeof core.getState>) => void> = [];
  core.subscribe((s) => listeners.forEach((l) => act(() => l(s))));
  const view = {
    windowed: false,
    outputOn: false,
    blocked: null,
    chosenMonitorId: null,
    missingMonitorId: null,
    monitors: [],
  };
  const bridge: CoreBridge = {
    chooseOutputMonitor: async () => view,
    setWindowedOutput: async () => view,
    getState: async () => core.getState(),
    dispatch: (c) => {
      dispatched.push(c);
      core.dispatch(c);
    },
    onState: (l) => listeners.push(l),
    getOutputView: async () => ({
      windowed: false,
      outputOn: false,
      blocked: null,
      chosenMonitorId: null,
      missingMonitorId: null,
      monitors: [],
    }),
    getApiView: async () => ({
      port: 4780,
      token: '',
      running: true,
      error: null,
      producerUrls: [],
    }),
  };
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
