// @vitest-environment jsdom
// Renderer seam: Edit mode's right-hand column (mini Live view and Script library), driven by a
// real core with a fake bridge. It checks what the Operator sees and which commands are sent.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock, createMemoryLibraryStorage } from '../core';
import { App } from './App';
import type { ImportOutcome } from './useCoreState';
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

async function mount(importResult: ImportOutcome | null = null) {
  const clock = createFakeClock(Date.UTC(2026, 10, 22, 12, 0));
  const storage = createMemoryLibraryStorage();
  const core = createCore({
    clock,
    libraryStorage: storage,
    script: { name: 'Sample', lines: ['hello'] },
  });
  core.dispatch({ type: 'saveScript', name: 'Sunday service', text: 'one\ntwo' });
  core.dispatch({ type: 'saveScript', name: 'Wedding', text: 'three' });
  let imports = 0;
  const { bridge, dispatched, menu } = createFakeBridge(core, {
    importScript: async () => {
      imports++;
      return importResult;
    },
  });
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  return {
    core,
    dispatched,
    imports: () => imports,
    menu,
  };
}

const library = () => host.querySelector('[data-testid="library"]') as HTMLElement;
const names = () => Array.from(library().querySelectorAll('.lib-card b')).map((b) => b.textContent);
const press = (el: Element | null | undefined) =>
  act(async () => el!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const labelled = (label: string) => library().querySelector(`button[aria-label="${label}"]`);
const type = (input: HTMLInputElement, value: string) =>
  act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const key = (el: Element, k: string) =>
  act(async () => void el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));

describe('Edit mode right-hand column', () => {
  it('lists each Script with its name and when it was edited', async () => {
    await mount();
    expect(names()).toEqual(['Sunday service', 'Wedding']);
    expect(library().querySelector('.lib-card small')!.textContent).toMatch(/^Edited /);
  });

  it('searches the library by name', async () => {
    await mount();
    await type(library().querySelector('input[type="search"]')!, 'wed');
    expect(names()).toEqual(['Wedding']);
    await type(library().querySelector('input[type="search"]')!, 'zzz');
    expect(library().textContent).toContain('No Scripts match');
  });

  it('loads a Script when its card is clicked, one at a time', async () => {
    const { core } = await mount();
    await press(library().querySelectorAll('.lib-card')[1]);
    expect(core.getState().script.name).toBe('Wedding');
    expect(library().querySelectorAll('.lib-card[aria-current="true"]')).toHaveLength(1);
  });

  it('makes a New Script and loads it', async () => {
    const { core } = await mount();
    await press(labelled('New Script'));
    expect(core.getState().script.name).toBe('New Script');
    expect(names()).toContain('New Script');
  });

  it('duplicates the loaded Script', async () => {
    const { core } = await mount();
    await press(library().querySelectorAll('.lib-card')[0]);
    await press(labelled('Duplicate'));
    expect(names()).toEqual(['Sunday service', 'Wedding', 'Sunday service copy']);
    expect(core.getState().script.name).toBe('Sunday service');
  });

  it('renames the loaded Script', async () => {
    const { core } = await mount();
    await press(library().querySelectorAll('.lib-card')[1]);
    await press(labelled('Rename'));
    const input = library().querySelector('input[aria-label="Script name"]') as HTMLInputElement;
    await type(input, 'Funeral');
    await key(input, 'Enter');
    expect(core.getState().script.name).toBe('Funeral');
    expect(names()).toEqual(['Sunday service', 'Funeral']);
  });

  it('asks before deleting, and deletes the loaded Script', async () => {
    const { core } = await mount();
    await press(library().querySelectorAll('.lib-card')[1]);
    await press(labelled('Delete'));
    expect(names()).toHaveLength(2);
    await press(
      Array.from(library().querySelectorAll('button')).find(
        (b) => b.textContent === 'Delete Script',
      ),
    );
    expect(names()).toEqual(['Sunday service']);
    expect(core.getState().loadedScriptId).toBeNull();
  });

  it('disables Duplicate, Rename and Delete while no library Script is loaded', async () => {
    await mount();
    expect((labelled('Duplicate') as HTMLButtonElement).disabled).toBe(true);
    expect((labelled('Rename') as HTMLButtonElement).disabled).toBe(true);
    expect((labelled('Delete') as HTMLButtonElement).disabled).toBe(true);
  });

  it('menu New makes a Script and menu Import runs Import', async () => {
    const { core, menu, imports } = await mount();
    await menu('new');
    expect(core.getState().library).toHaveLength(3);
    await menu('import');
    expect(imports()).toBe(1);
  });

  it('shows the mini Live view, which follows the Script', async () => {
    const { core } = await mount();
    const live = host.querySelector('[data-testid="live-view"]')!;
    expect(live).not.toBeNull();
    await act(async () => core.dispatch({ type: 'setScriptLines', lines: ['brand new words'] }));
    expect(live.textContent).toContain('brand new words');
  });

  it('collapses with the shared right-column state', async () => {
    const { dispatched } = await mount();
    await press(host.querySelector('[data-testid="toggle-column"]'));
    expect(dispatched).toContainEqual({ type: 'setRightColumnCollapsed', collapsed: true });
    expect(host.querySelector('[data-testid="library"]')).toBeNull();
    expect(host.querySelector('[data-testid="live-view"]')).toBeNull();
  });
});

describe('Import', () => {
  it('runs from the header and says nothing when the picker is cancelled', async () => {
    const { imports } = await mount(null);
    await press(host.querySelector('header [data-testid="import"]'));
    expect(imports()).toBe(1);
    expect(host.querySelector('[data-testid="notice"]')).toBeNull();
  });

  it('shows a plain message when a file cannot be imported', async () => {
    await mount({ ok: false, message: '"a.docx" is not a Word file.' });
    await press(host.querySelector('header [data-testid="import"]'));
    const note = host.querySelector('[data-testid="notice"]')!;
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.textContent).toContain('is not a Word file');
    await press(note.querySelector('button'));
    expect(host.querySelector('[data-testid="notice"]')).toBeNull();
  });

  it('shows the result of a good Import', async () => {
    await mount({ ok: true, message: 'Imported "Talk" into the library.' });
    await press(host.querySelector('header [data-testid="import"]'));
    expect(host.querySelector('[data-testid="notice"]')!.textContent).toContain('Imported');
  });

  it('is Edit mode only: the menu item does nothing and the header button is gone in Run mode', async () => {
    const { imports, core, menu } = await mount({ ok: true, message: 'Imported' });
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    await menu('import');
    expect(imports()).toBe(0);
    expect(host.querySelector('header [data-testid="import"]')).toBeNull();
  });
});
