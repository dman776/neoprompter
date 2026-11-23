// @vitest-environment jsdom
// Renderer seam: the real Preferences window, driven by a real core, in a DOM. It checks what the
// Operator sees and the commands the window sends; real layout is covered by the Electron test.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock, createMemoryPresetStore, type Command } from '../core';
import type { CoreBridge } from '../operator/useCoreState';
import { Preferences } from './PreferencesWindow';

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
  const core = createCore({ clock: createFakeClock(), presetStore: createMemoryPresetStore() });
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
    getOutputView: async () => {
      throw new Error('not used by Preferences yet');
    },
  };
  root = createRoot(host);
  await act(async () => root.render(<Preferences bridge={bridge} />));
  return { core, dispatched };
}

const nav = (name: string) =>
  Array.from(host.querySelectorAll('nav button')).find((b) => b.textContent?.trim() === name)!;
const field = (label: string) =>
  host.querySelector<HTMLInputElement & HTMLSelectElement>(`[aria-label="${label}"]`)!;
const button = (name: string) =>
  Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name)!;

/** React tracks the value itself, so set it through the native setter and fire the event. */
async function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(
      new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
    );
  });
}

describe('Preferences categories', () => {
  it('lists the six categories and opens on General', async () => {
    await mount();
    const names = Array.from(host.querySelectorAll('nav button'), (b) => b.textContent?.trim());
    expect(names).toEqual([
      'General',
      'Appearance',
      'Output',
      'Controls',
      'Notifications',
      'Network',
    ]);
    expect(host.querySelector('main h2')!.textContent).toBe('General');
  });

  it('shows a placeholder for a category that has no settings yet', async () => {
    await mount();
    await act(async () => (nav('Network') as HTMLElement).click());
    expect(host.querySelector('main h2')!.textContent).toBe('Network');
    expect(host.querySelector('main')!.textContent).toContain('Coming soon');
  });
});

describe('Appearance', () => {
  async function openAppearance() {
    const m = await mount();
    await act(async () => (nav('Appearance') as HTMLElement).click());
    return m;
  }

  it('shows the current Appearance', async () => {
    await openAppearance();
    expect(field('Font size').value).toBe('48');
    expect(field('Text width').value).toBe('80');
    expect(field('Text color').value).toBe('#ffffff');
    expect(field('Background').value).toBe('#000000');
    expect(field('Reading line').getAttribute('aria-checked')).toBe('true');
  });

  it('applies a slider change at once, with no Save button', async () => {
    const { core } = await openAppearance();
    await setValue(field('Font size'), '72');
    expect(core.getState().appearance.fontSize).toBe(72);
    await setValue(field('Line spacing'), '1.8');
    expect(core.getState().appearance.lineSpacing).toBe(1.8);
    await setValue(field('Margin'), '20');
    expect(core.getState().appearance.margin).toBe(20);
    expect(button('Save')).toBeUndefined();
  });

  it('applies colors at once', async () => {
    const { core } = await openAppearance();
    await setValue(field('Background'), '#102030');
    expect(core.getState().appearance.backgroundColor).toBe('#102030');
    await setValue(field('Text color'), '#ffcc00');
    expect(core.getState().appearance.textColor).toBe('#ffcc00');
  });

  it('switches the Reading line and the mirror through the core', async () => {
    const { core, dispatched } = await openAppearance();
    await act(async () => field('Reading line').click());
    expect(core.getState().appearance.readingLine).toBe(false);
    await act(async () => field('Mirror').click());
    expect(dispatched.at(-1)).toEqual({ type: 'toggleMirror' });
    expect(core.getState().appearance.mirror).toBe(true);
  });

  it('follows a change that came from somewhere else', async () => {
    const { core } = await openAppearance();
    await act(async () => core.dispatch({ type: 'setAppearance', changes: { fontSize: 100 } }));
    expect(field('Font size').value).toBe('100');
  });

  it('shows a sample that matches the Appearance', async () => {
    const { core } = await openAppearance();
    await act(async () =>
      core.dispatch({
        type: 'setAppearance',
        changes: { backgroundColor: '#112233', textColor: '#ffee00', mirror: true },
      }),
    );
    const sample = host.querySelector<HTMLElement>('[data-testid="sample"]')!;
    expect(sample.style.backgroundColor).toBe('rgb(17, 34, 51)');
    expect(sample.style.color).toBe('rgb(255, 238, 0)');
    expect(sample.style.transform).toContain('scaleX(-1)');
  });
});

describe('Presets', () => {
  async function openAppearance() {
    const m = await mount();
    await act(async () => (nav('Appearance') as HTMLElement).click());
    return m;
  }

  it('saves the current Appearance under a name and selects it', async () => {
    const { core } = await openAppearance();
    await setValue(field('Font size'), '90');
    await setValue(field('Preset name'), 'Large text');
    await act(async () => button('Save Preset').click());
    expect(core.getState().presets).toEqual(['Large text']);
    expect(core.getState().activePreset).toBe('Large text');
    expect(field('Preset name').value).toBe('');
  });

  it('loads a Preset chosen from the list', async () => {
    const { core } = await openAppearance();
    await setValue(field('Font size'), '90');
    await act(async () => core.dispatch({ type: 'savePreset', name: 'Big' }));
    await setValue(field('Font size'), '30');
    await setValue(field('Preset'), 'Big');
    expect(core.getState().appearance.fontSize).toBe(90);
    expect(core.getState().activePreset).toBe('Big');
  });

  it('deletes the selected Preset', async () => {
    const { core } = await openAppearance();
    await act(async () => core.dispatch({ type: 'savePreset', name: 'Big' }));
    await act(async () => button('Delete Preset').click());
    expect(core.getState().presets).toEqual([]);
  });

  it('cannot delete when no Preset is selected', async () => {
    await openAppearance();
    expect((button('Delete Preset') as HTMLButtonElement).disabled).toBe(true);
  });
});
