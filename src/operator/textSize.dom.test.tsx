// @vitest-environment jsdom
// Renderer seam: Run mode has quick Text size buttons beside the transport.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock, FONT_SIZE_STEP } from '../core';
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
    script: { name: 's', lines: Array.from({ length: 50 }, (_, i) => `line ${i}`) },
  });
  const { bridge } = createFakeBridge(core);
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
  return core;
}

const button = (name: string) =>
  host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`) as HTMLButtonElement;

describe('Run mode text size', () => {
  it('shows the current size and makes the Output text bigger and smaller', async () => {
    const core = await mountRun();
    const start = core.getState().appearance.fontSize;
    expect(host.querySelector('[data-testid="text-size-value"]')?.textContent).toBe(`${start}`);
    await act(async () => button('Larger text').click());
    expect(core.getState().appearance.fontSize).toBe(start + FONT_SIZE_STEP);
    expect(host.querySelector('[data-testid="text-size-value"]')?.textContent).toBe(
      `${start + FONT_SIZE_STEP}`,
    );
    await act(async () => button('Smaller text').click());
    await act(async () => button('Smaller text').click());
    expect(core.getState().appearance.fontSize).toBe(start - FONT_SIZE_STEP);
  });
});
