// @vitest-environment jsdom
// Renderer seam: the editor has its own text size (a view setting; it never touches the Script or Output).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock } from '../core';
import { App } from './App';
import { createFakeBridge } from './fakeBridge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const noRects = () => [] as unknown as DOMRectList;
Range.prototype.getClientRects = noRects;
Range.prototype.getBoundingClientRect = () => new DOMRect();
Element.prototype.getClientRects = noRects;

let root: Root;
let host: HTMLElement;

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function mount() {
  const core = createCore({ clock: createFakeClock(), script: { name: 'T', lines: ['Hello'] } });
  const { bridge } = createFakeBridge(core);
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  return core;
}
const button = (label: string) =>
  host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
const input = () => host.querySelector<HTMLInputElement>('input.editor-size-input')!;
const scroll = () => host.querySelector<HTMLElement>('.script-scroll')!;
const setValue = (el: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('Editor text size', () => {
  it('starts at 17 and the + and - buttons change it', async () => {
    const core = await mount();
    const outputSize = core.getState().appearance.fontSize;
    expect(input().value).toBe('17');
    await act(async () => button('Larger editor text').click());
    expect(input().value).toBe('18');
    expect(scroll().style.getPropertyValue('--editor-size')).toBe('18px');
    await act(async () => button('Smaller editor text').click());
    await act(async () => button('Smaller editor text').click());
    expect(input().value).toBe('16');
    expect(core.getState().appearance.fontSize).toBe(outputSize);
  });

  it('takes a typed size, keeps it within limits, and remembers it', async () => {
    await mount();
    await act(async () => input().focus());
    await act(async () => setValue(input(), '30'));
    await act(async () => input().blur());
    expect(scroll().style.getPropertyValue('--editor-size')).toBe('30px');
    expect(localStorage.getItem('neoprompter.editorFontSize')).toBe('30');
    await act(async () => input().focus());
    await act(async () => setValue(input(), '99'));
    await act(async () => input().blur());
    expect(input().value).toBe('48');
    expect(button('Larger editor text').disabled).toBe(true);
  });
});
