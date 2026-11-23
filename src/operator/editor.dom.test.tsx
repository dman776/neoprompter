// @vitest-environment jsdom
// Renderer seam: the Script editor inside the real Operator view, driven by a real core.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Editor } from '@tiptap/core';
import { createCore, createFakeClock, lineText, type Command, type ScriptLine } from '../core';
import { App } from './App';
import { SAVE_DELAY_MS } from './ScriptEditor';
import { createFakeBridge } from './fakeBridge';

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

async function mount(lines: ScriptLine[] = ['Hello there.', 'Second line.']) {
  const core = createCore({ clock: createFakeClock(), script: { name: 'T', lines } });
  const { bridge, dispatched, menu, pushState } = createFakeBridge(core);
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  return { core, dispatched, menu, pushState, bridge };
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

  it('sends what was typed after the save delay, before Run mode locks the Script', async () => {
    const { core } = await mount();
    await act(async () => void tiptap().commands.insertContentAt(1, 'Late '));
    await act(async () => new Promise((r) => setTimeout(r, SAVE_DELAY_MS + 50)));
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    expect(core.getState().script.lines.map(lineText)[0]).toBe('Late Hello there.');
  });

  it('keeps typing made just before a mode switch, from the header and from the menu', async () => {
    const { core, menu } = await mount();
    await act(async () => void tiptap().commands.insertContentAt(1, 'Quick '));
    const runButton = Array.from(
      host.querySelectorAll('header button, header [role="radio"]'),
    ).find((b) => b.textContent?.trim() === 'Run') as HTMLElement;
    await act(async () => runButton.click());
    expect(core.getState().mode).toBe('run');
    expect(core.getState().script.lines.map(lineText)[0]).toBe('Quick Hello there.');
    await act(async () => core.dispatch({ type: 'setMode', mode: 'edit' }));
    await act(async () => void tiptap().commands.insertContentAt(1, 'Again '));
    await menu('mode-run');
    expect(core.getState().mode).toBe('run');
    expect(core.getState().script.lines.map(lineText)[0]).toBe('Again Quick Hello there.');
  });

  it('says so plainly when a save was rejected, instead of staying silent', async () => {
    const { core } = await mount();
    await act(async () => void tiptap().commands.insertContentAt(1, 'Lost '));
    // The mode changes behind the editor's back, so its unsent typing is refused by the core.
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    const note = host.querySelector('[data-testid="notice"]');
    expect(note?.getAttribute('role')).toBe('alert');
    expect(note?.textContent).toContain('could not be saved');
  });

  it('undoes and redoes from the Edit menu', async () => {
    const { menu } = await mount();
    await act(async () => void tiptap().commands.insertContentAt(1, 'X'));
    await menu('undo');
    expect(host.querySelector('.ProseMirror')!.textContent).not.toContain('XHello');
    await menu('redo');
    expect(host.querySelector('.ProseMirror')!.textContent).toContain('XHello');
  });

  it('undoes from the Edit menu even after the typing was saved', async () => {
    const { menu } = await mount();
    await act(async () => void tiptap().commands.insertContentAt(1, 'X'));
    await wait(SAVE_DELAY_MS + 100);
    await menu('undo');
    expect(host.querySelector('.ProseMirror')!.textContent).not.toContain('XHello');
  });

  it('keeps typing and undo history when an older state arrives just after a save', async () => {
    const { core, menu, pushState, bridge } = await mount();
    // The save is still travelling to the core when a state from before it comes in.
    const travelling: Command[] = [];
    const send = bridge.dispatch;
    bridge.dispatch = (c) => (c.type === 'setScriptLines' ? void travelling.push(c) : send(c));
    const older = core.getState();
    await act(async () => void tiptap().commands.insertContentAt(1, 'X'));
    await wait(SAVE_DELAY_MS + 100);
    pushState(older);
    expect(host.querySelector('.ProseMirror')!.textContent).toContain('XHello');
    await act(async () => travelling.forEach((c) => core.dispatch(c)));
    await menu('undo');
    expect(host.querySelector('.ProseMirror')!.textContent).not.toContain('XHello');
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

describe('find and replace', () => {
  const type = async (label: string, value: string) => {
    const input = host.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const counter = () => host.querySelector('.find-count')!.textContent;
  const lines = (core: Awaited<ReturnType<typeof mount>>['core']) =>
    core.getState().script.lines.map(lineText);

  it('opens from the Find button, counts matches, and steps next and previous with wrapping', async () => {
    await mount(['Ann met Ann.', 'Then Ann left.']);
    expect(host.querySelector('.find-bar')).toBeNull();
    await act(async () => button('Find').click());
    await type('Find', 'ann');
    expect(counter()).toBe('1 of 3');
    await act(async () => button('Next match').click());
    expect(counter()).toBe('2 of 3');
    await act(async () => button('Next match').click());
    await act(async () => button('Next match').click());
    expect(counter()).toBe('1 of 3');
    await act(async () => button('Previous match').click());
    expect(counter()).toBe('3 of 3');
    expect(host.querySelectorAll('.find-match').length).toBe(3);
    await type('Find', 'zzz');
    expect(counter()).toBe('No matches');
  });

  it('replaces the current match, then all of them, and saves the result', async () => {
    const { core } = await mount(['Ann met Ann.', 'Then Ann left.']);
    await act(async () => button('Find').click());
    await type('Find', 'Ann');
    await type('Replace with', 'Bea');
    await act(async () => button('Replace').click());
    expect(tiptap().getText()).toContain('Bea met Ann.');
    await act(async () => button('Replace all').click());
    await wait(SAVE_DELAY_MS + 100);
    expect(lines(core)).toEqual(['Bea met Bea.', 'Then Bea left.']);
    expect(counter()).toBe('No matches');
  });

  it('keeps the formatting of the text it replaces', async () => {
    const { core } = await mount([
      { runs: [{ text: 'Say ' }, { text: 'Ann', bold: true }] },
    ] as never);
    await act(async () => button('Find').click());
    await type('Find', 'Ann');
    await type('Replace with', 'Bea');
    await act(async () => button('Replace all').click());
    await wait(SAVE_DELAY_MS + 100);
    expect(core.getState().script.lines[0]).toEqual({
      runs: [{ text: 'Say ' }, { text: 'Bea', bold: true }],
    });
  });

  it('closes the find bar when the editor goes away on leaving Edit mode', async () => {
    // The editor is not shown in Run mode, so the bar goes with it.
    const { core } = await mount();
    await act(async () => button('Find').click());
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    expect(host.querySelector('.find-bar')).toBeNull();
  });
});

describe('pasting from Word', () => {
  const paste = async (html: string) => {
    const view = tiptap().view;
    const data = { getData: (t: string) => (t === 'text/html' ? html : '') };
    const event = Object.assign(new Event('paste', { bubbles: true, cancelable: true }), {
      clipboardData: data,
    });
    await act(async () => void view.dom.dispatchEvent(event));
  };

  it('keeps structure, emphasis and color and carries no fonts or sizes', async () => {
    const { core } = await mount(['']);
    tiptap().commands.focus();
    await paste(
      '<h2 style="font-family:Arial;font-size:20pt">Title</h2><p class="MsoNormal" style="font-size:14pt"><b>Bold</b> <span style="color:#ff0000;font-family:Calibri">red</span></p>',
    );
    await wait(SAVE_DELAY_MS + 100);
    expect(core.getState().script.lines).toEqual([
      { heading: 2, runs: [{ text: 'Title' }] },
      {
        runs: [{ text: 'Bold', bold: true }, { text: ' ' }, { text: 'red', color: '#ff0000' }],
      },
    ]);
    expect(tiptap().getHTML()).not.toMatch(/font|size|class=/i);
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

describe('readable colors in the editor', () => {
  const rich: ScriptLine[] = [
    {
      runs: [
        { text: 'black', color: '#000000' },
        { text: ' dim', color: '#111111' },
        { text: ' red', color: '#ff0000' },
        { text: ' white', color: '#ffffff' },
      ],
    },
  ];
  // jsdom loads no stylesheet, so the theme tokens the editor reads are set here.
  const tokens = (surface: string, text: string) => {
    document.documentElement.style.setProperty('--surface', surface);
    document.documentElement.style.setProperty('--text', text);
  };
  afterEach(() => {
    document.documentElement.style.removeProperty('--surface');
    document.documentElement.style.removeProperty('--text');
  });
  const shown = (word: string) => {
    const leaf = Array.from(host.querySelectorAll<HTMLElement>('.ProseMirror span')).filter(
      (el) => el.textContent?.trim() === word && el.children.length === 0,
    );
    return getComputedStyle(leaf[0]!).color;
  };
  const shownByStyle = (word: string) => {
    const leaves = Array.from(host.querySelectorAll<HTMLElement>('.ProseMirror span')).filter(
      (el) => el.textContent?.includes(word),
    );
    // The innermost span carries the color that wins.
    return leaves.at(-1)!.style.color;
  };

  it('shows black text in the editor text color on the dark theme, never black', async () => {
    tokens('#11161c', '#dfe5ee');
    await mount(rich);
    expect(shownByStyle('black')).toBe('rgb(223, 229, 238)');
    expect(shownByStyle('dim')).toBe('rgb(223, 229, 238)');
    expect(shown('black')).not.toBe('rgb(0, 0, 0)');
  });

  it('leaves a readable color alone', async () => {
    tokens('#11161c', '#dfe5ee');
    await mount(rich);
    expect(shownByStyle('red')).toBe('rgb(255, 0, 0)');
    expect(shownByStyle('white')).toBe('rgb(255, 255, 255)');
  });

  it('does not change the Script: the stored color stays black, and so does what is copied', async () => {
    tokens('#11161c', '#dfe5ee');
    const { core } = await mount(rich);
    const run = (core.getState().script.lines[0] as { runs: { text: string; color?: string }[] })
      .runs[0]!;
    expect(run.color).toBe('#000000');
    const json = JSON.stringify(tiptap().getJSON());
    expect(json).toContain('#000000');
    // What is copied is the document's own HTML: the source black, not the shown color.
    expect(tiptap().getHTML()).toContain('color: rgb(0, 0, 0)');
  });

  it('checks again against the light theme, where white is the unreadable one', async () => {
    tokens('#f4f6f9', '#19202a');
    await mount(rich);
    expect(shownByStyle('white')).toBe('rgb(25, 32, 42)');
    expect(shownByStyle('black')).toBe('rgb(0, 0, 0)');
  });

  it('follows a theme change without reloading the Script', async () => {
    tokens('#11161c', '#dfe5ee');
    const { core } = await mount(rich);
    expect(shownByStyle('black')).toBe('rgb(223, 229, 238)');
    tokens('#f4f6f9', '#19202a');
    await act(async () => core.dispatch({ type: 'setTheme', theme: 'light' }));
    await act(async () => void (await new Promise((r) => setTimeout(r, 60))));
    expect(shownByStyle('black')).toBe('rgb(0, 0, 0)');
    expect(shownByStyle('white')).toBe('rgb(25, 32, 42)');
  });

  it('keeps showing it right after the Operator types', async () => {
    tokens('#11161c', '#dfe5ee');
    await mount(rich);
    await act(async () => void tiptap().commands.insertContentAt(1, 'x'));
    expect(shownByStyle('black')).not.toBe('rgb(0, 0, 0)');
  });
});
