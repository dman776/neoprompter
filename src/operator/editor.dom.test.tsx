// @vitest-environment jsdom
// Renderer seam: the Script editor inside the real Operator view, driven by a real core.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Editor } from '@tiptap/core';
import { createCore, createFakeClock, lineText, type Command } from '../core';
import { App } from './App';
import { SAVE_DELAY_MS } from './ScriptEditor';
import type { CoreBridge } from './useCoreState';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no layout; ProseMirror asks for rectangles when it scrolls the caret into view.
const noRects = () => [] as unknown as DOMRectList;
Range.prototype.getClientRects = noRects;
Range.prototype.getBoundingClientRect = () => new DOMRect();
Element.prototype.getClientRects = noRects;

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

async function mount(lines: string[] = ['Hello there.', 'Second line.']) {
  const core = createCore({ clock: createFakeClock(), script: { name: 'T', lines } });
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
    getOutputView: async () =>
      ({
        blocked: null,
        windowed: false,
        monitors: [],
        chosenMonitorId: null,
        missingMonitorId: null,
      }) as never,
    getApiView: async () => ({ running: true, error: null }) as never,
  };
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  return { core, dispatched };
}

const tiptap = () =>
  (host.querySelector('.ProseMirror') as HTMLElement & { editor: Editor }).editor;
const button = (label: string) =>
  host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
const wait = (ms: number) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));
const savedLabel = () => host.querySelector('.np-panel > h4')!.textContent;

describe('the Script editor in Edit mode', () => {
  it('shows the loaded Script with a word count and read time', async () => {
    await mount();
    expect(host.querySelector('.ProseMirror')!.textContent).toContain('Hello there.');
    expect(host.querySelector('.word-count')!.textContent).toBe('4 words · 0:02');
    expect(savedLabel()).toContain('Saved');
  });

  it('shows Saving, then saves the edit through the core and shows Saved', async () => {
    const { core, dispatched } = await mount();
    await act(async () => void tiptap().commands.insertContentAt(1, 'Well. '));
    expect(savedLabel()).toContain('Saving');
    expect(dispatched.some((c) => c.type === 'setScriptLines')).toBe(false);
    await wait(SAVE_DELAY_MS + 100);
    expect(core.getState().script.lines.map(lineText)).toEqual([
      'Well. Hello there.',
      'Second line.',
    ]);
    expect(savedLabel()).toContain('Saved');
  });

  it('updates the word count as the Operator types', async () => {
    await mount();
    await act(async () => void tiptap().commands.insertContentAt(1, 'one two three '));
    await wait(SAVE_DELAY_MS + 100);
    expect(host.querySelector('.word-count')!.textContent).toContain('7 words');
  });

  it('makes bold and a heading from the formatting bar and saves them as styled lines', async () => {
    const { core } = await mount();
    await act(async () => void tiptap().commands.setTextSelection({ from: 1, to: 6 }));
    await act(async () => button('Bold').click());
    await act(async () => button('Heading').click());
    await wait(SAVE_DELAY_MS + 100);
    expect(core.getState().script.lines[0]).toEqual({
      heading: 1,
      runs: [{ text: 'Hello', bold: true }, { text: ' there.' }],
    });
  });

  it('undoes and redoes from the toolbar', async () => {
    await mount();
    await act(async () => void tiptap().commands.insertContentAt(1, 'X'));
    expect(host.querySelector('.ProseMirror')!.textContent).toContain('XHello');
    await act(async () => button('Undo').click());
    expect(host.querySelector('.ProseMirror')!.textContent).not.toContain('XHello');
    await act(async () => button('Redo').click());
    expect(host.querySelector('.ProseMirror')!.textContent).toContain('XHello');
  });

  it('follows a Script change that came from somewhere else', async () => {
    const { core } = await mount();
    await act(async () =>
      core.dispatch({ type: 'setScriptLines', lines: ['Replaced by the API.'] }),
    );
    expect(host.querySelector('.ProseMirror')!.textContent).toBe('Replaced by the API.');
  });

  it('sends what was typed before the editor locks on leaving Edit mode', async () => {
    const { core } = await mount();
    await act(async () => void tiptap().commands.insertContentAt(1, 'Late '));
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    expect(core.getState().script.lines.map(lineText)[0]).toBe('Late Hello there.');
  });

  it('is not editable when the app is not in Edit mode', async () => {
    const { core } = await mount();
    await act(async () => {
      core.dispatch({ type: 'setMode', mode: 'run' });
    });
    // Run mode shows no editor; back in Edit mode it is editable again.
    expect(host.querySelector('.ProseMirror')).toBeNull();
    await act(async () => core.dispatch({ type: 'setMode', mode: 'edit' }));
    expect(tiptap().isEditable).toBe(true);
  });
});

describe('the Color button', () => {
  const swatches = () => [...host.querySelectorAll<HTMLButtonElement>('.swatch')];
  const altKey = (digit: string) =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: `Digit${digit}`, altKey: true, cancelable: true }),
    );

  it('opens a panel of ten slots: the five seed colors, then empty slots', async () => {
    await mount();
    await act(async () => button('Color').click());
    expect(swatches().map((s) => s.style.background)).toEqual([
      'rgb(255, 0, 0)',
      'rgb(0, 255, 0)',
      'rgb(0, 0, 255)',
      'rgb(255, 255, 0)',
      'rgb(255, 255, 255)',
    ]);
    expect(host.querySelectorAll('.swatch-empty')).toHaveLength(5);
    expect(host.querySelector('.color-more')!.textContent).toBe('Any color…');
  });

  it('colors the selected text from a swatch, moves it to the front and saves it as-is', async () => {
    const { core } = await mount();
    await act(async () => void tiptap().commands.setTextSelection({ from: 1, to: 6 }));
    await act(async () => button('Color').click());
    await act(async () => swatches()[2].click());
    await wait(SAVE_DELAY_MS + 100);
    expect(core.getState().script.lines[0]).toEqual({
      runs: [{ text: 'Hello', color: '#0000ff' }, { text: ' there.' }],
    });
    expect(core.getState().recentColors[0]).toBe('#0000ff');
    expect(host.querySelector('.swatch-grid')).toBeNull();
  });

  it('colors with Alt+1 to Alt+0 from the recent colors', async () => {
    const { core } = await mount();
    await act(async () => void tiptap().commands.setTextSelection({ from: 1, to: 6 }));
    await act(async () => void altKey('2'));
    await wait(SAVE_DELAY_MS + 100);
    expect(core.getState().script.lines[0]).toMatchObject({
      runs: [{ text: 'Hello', color: '#00ff00' }, { text: ' there.' }],
    });
    expect(core.getState().recentColors[0]).toBe('#00ff00');
  });

  it('does nothing for a shortcut whose slot is empty', async () => {
    const { dispatched } = await mount();
    await act(async () => void altKey('0'));
    expect(dispatched.some((c) => c.type === 'pickColor')).toBe(false);
  });

  it('counts an Any color pick as used when the picker closes, not while dragging', async () => {
    const { core } = await mount();
    await act(async () => void tiptap().commands.setTextSelection({ from: 1, to: 6 }));
    const input = host.querySelector<HTMLInputElement>('input[type="color"]')!;
    await act(async () => {
      input.value = '#123456';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(core.getState().recentColors).not.toContain('#123456');
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(core.getState().recentColors[0]).toBe('#123456');
    await wait(SAVE_DELAY_MS + 100);
    expect(core.getState().script.lines[0]).toMatchObject({
      runs: [{ text: 'Hello', color: '#123456' }, { text: ' there.' }],
    });
  });
});
