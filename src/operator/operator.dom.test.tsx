// @vitest-environment jsdom
// Renderer seam: the real Operator view, driven by a real core, in a DOM. It checks what the
// Operator sees and the commands the view sends; real layout is covered by the Electron test.
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

async function mount() {
  const core = createCore({ clock: createFakeClock() });
  const dispatched: Command[] = [];
  const listeners: Array<(s: ReturnType<typeof core.getState>) => void> = [];
  core.subscribe((s) => listeners.forEach((l) => act(() => l(s))));
  const bridge: CoreBridge = {
    getState: async () => core.getState(),
    dispatch: (c) => {
      dispatched.push(c);
      core.dispatch(c);
    },
    onState: (l) => listeners.push(l),
  };
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  return { core, dispatched };
}

const button = (name: string) =>
  Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name)!;

describe('the Operator view shell', () => {
  it('shows the current Script and the mode switch in the header', async () => {
    const { core } = await mount();
    const header = host.querySelector('header')!;
    expect(header.textContent).toContain(core.getState().script.name);
    expect(header.textContent).toContain('Edit');
    expect(header.textContent).toContain('Run');
  });

  it('opens in Edit mode and says so in the status bar', async () => {
    await mount();
    expect(host.querySelector('main')!.getAttribute('data-mode')).toBe('edit');
    expect(host.querySelector('footer')!.textContent).toContain('Edit mode');
  });

  it('switches to Run mode through the core when the Operator presses Run', async () => {
    const { core, dispatched } = await mount();
    await act(async () => button('Run').click());
    expect(dispatched).toEqual([{ type: 'setMode', mode: 'run' }]);
    expect(core.getState().mode).toBe('run');
    expect(host.querySelector('main')!.getAttribute('data-mode')).toBe('run');
    expect(host.querySelector('footer')!.textContent).toContain('Run mode');
  });

  it('follows a mode change that came from somewhere else', async () => {
    const { core } = await mount();
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    expect(host.querySelector('main')!.getAttribute('data-mode')).toBe('run');
  });

  it('uses the dark theme', async () => {
    await mount();
    expect(document.documentElement.getAttribute('data-theme') ?? 'dark').toBe('dark');
  });
});
