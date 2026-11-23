// @vitest-environment jsdom
// Renderer seam: the real Preferences window, driven by a real core, in a DOM. It checks what the
// Operator sees and the commands the window sends; real layout is covered by the Electron test.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock, createMemoryPresetStore } from '../core';
import { createFakeBridge } from '../operator/fakeBridge';
import type { ApiView } from '../api';
import type { QuickMessage } from '../api/producer';
import { defaultButtonMapping, type ButtonMappingView } from '../input';
import type { OutputWindowView } from '../output-window';
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

const baseView: OutputWindowView = {
  windowed: false,
  outputOn: false,
  blocked: null,
  chosenMonitorId: 'b',
  missingMonitorId: null,
  monitors: [
    { id: 'a', label: 'Built-in display', isOperatorDisplay: true },
    { id: 'b', label: 'Prompter monitor', isOperatorDisplay: false },
  ],
};

const baseApi: ApiView = {
  port: 4780,
  token: 'sekret',
  running: true,
  error: null,
  producerUrls: ['http://192.168.1.20:4780/'],
};
const ACTIONS = ['none', 'playPause', 'jumpBack', 'jumpForward', 'returnToPlayStart'];

async function mount(
  initialView: Partial<OutputWindowView> = {},
  options: {
    api?: Partial<ApiView>;
    applyError?: string;
    watched?: { path: string; missing?: boolean; lastResult?: string };
  } = {},
) {
  let api: ApiView = { ...baseApi, ...options.api };
  let mapping: ButtonMappingView = { mapping: { ...defaultButtonMapping }, actions: ACTIONS };
  const mappingListeners: Array<(v: ButtonMappingView) => void> = [];
  const apiSaved: Array<{ port: number; token: string }> = [];
  let quick: QuickMessage[] = [{ text: 'Slow down', color: 'amber' }, { text: 'Wrap up' }];
  const quickSaved: QuickMessage[][] = [];
  let view: OutputWindowView = { ...baseView, ...initialView };
  let watched: string | null = options.watched?.path ?? null;
  let watchedExtra = {
    missing: options.watched?.missing ?? false,
    lastResult: options.watched?.lastResult ?? (null as string | null),
  };
  const chosen: string[] = [];
  const windowedCalls: boolean[] = [];
  const core = createCore({ clock: createFakeClock(), presetStore: createMemoryPresetStore() });
  const { bridge, dispatched } = createFakeBridge(core, {
    getOutputView: async () => view,
    chooseOutputMonitor: async (id) => {
      chosen.push(id);
      view = { ...view, chosenMonitorId: id, blocked: null };
      return view;
    },
    setWindowedOutput: async (w) => {
      windowedCalls.push(w);
      view = { ...view, windowed: w };
      return view;
    },
    getApiView: async () => api,
    getButtonMapping: async () => mapping,
    setButton: async (button, action) => {
      mapping = { ...mapping, mapping: { ...mapping.mapping, [button]: action } };
      mappingListeners.forEach((l) => l(mapping));
      return mapping;
    },
    onButtonMapping: (l) => mappingListeners.push(l),
    setApiSettings: async (settings) => {
      apiSaved.push(settings);
      api = options.applyError
        ? { ...api, running: false, error: options.applyError }
        : { ...api, ...settings, running: true, error: null };
      return api;
    },
    getVersion: async () => '1.2.3',
    getWatchedFolder: async () => ({ path: watched, ...watchedExtra }),
    chooseWatchedFolder: async () => {
      watched = '/Scripts/Drop';
      return { path: watched, ...watchedExtra };
    },
    clearWatchedFolder: async () => {
      watched = null;
      return { path: null, ...watchedExtra };
    },
    getQuickMessages: async () => quick,
    setQuickMessages: async (messages) => {
      quickSaved.push(messages);
      quick = messages.filter((m) => m.text.trim() !== '');
      return quick;
    },
  });
  root = createRoot(host);
  await act(async () => root.render(<Preferences bridge={bridge} />));
  return {
    core,
    dispatched,
    chosen,
    windowedCalls,
    apiSaved,
    quickSaved,
    getMapping: () => mapping,
  };
}

const nav = (name: string) =>
  Array.from(host.querySelectorAll('nav button')).find((b) => b.textContent?.trim() === name)!;
const tab = (name: string) =>
  Array.from(host.querySelectorAll('[role="tab"]')).find(
    (t) => t.textContent?.trim() === name,
  )! as HTMLElement;
const openTab = (name: string) => act(async () => tab(name).click());
const tabNames = () =>
  Array.from(host.querySelectorAll('[role="tab"]'), (t) => t.textContent?.trim());
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
});

describe('Appearance', () => {
  async function openAppearance(tabName = 'Text') {
    const m = await mount();
    await act(async () => (nav('Appearance') as HTMLElement).click());
    await openTab(tabName);
    return m;
  }

  it('shows the current Appearance', async () => {
    await openAppearance();
    expect(field('Font size').value).toBe('48');
    expect(field('Text width').value).toBe('80');
    await openTab('Colors');
    expect(field('Text color').value).toBe('#ffffff');
    expect(field('Background').value).toBe('#000000');
    await openTab('Reading line');
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

  it('moves Text width with Margin: Margin 0% widens the text to the edges', async () => {
    const { core } = await openAppearance();
    await setValue(field('Margin'), '0');
    expect(core.getState().appearance.margin).toBe(0);
    expect(core.getState().appearance.textWidth).toBe(100);
    expect(field('Text width').value).toBe('100');
    await setValue(field('Text width'), '60');
    expect(core.getState().appearance.margin).toBe(20);
    expect(field('Margin').value).toBe('20');
  });

  it('applies colors at once', async () => {
    const { core } = await openAppearance('Colors');
    await setValue(field('Background'), '#102030');
    expect(core.getState().appearance.backgroundColor).toBe('#102030');
    await setValue(field('Text color'), '#ffcc00');
    expect(core.getState().appearance.textColor).toBe('#ffcc00');
  });

  it('chooses the Reading line and Progress bar colors, red to begin with, and the sample shows them', async () => {
    const { core } = await openAppearance('Colors');
    expect(field('Reading line color').value).toBe('#ff0000');
    expect(field('Progress bar color').value).toBe('#ff0000');
    await setValue(field('Reading line color'), '#00cc66');
    await setValue(field('Progress bar color'), '#3366ff');
    expect(core.getState().appearance.readingLineColor).toBe('#00cc66');
    expect(core.getState().appearance.progressColor).toBe('#3366ff');
    const triangle = host.querySelector<HTMLElement>('[data-testid="sample-reading-line"]')!;
    expect(triangle.style.borderLeftColor).toBe('rgb(0, 204, 102)');
    const bar = host.querySelector<HTMLElement>('[data-testid="sample-progress"]')!;
    expect(bar.style.backgroundColor).toBe('rgb(51, 102, 255)');
  });

  it('draws the sample triangle as a miniature of the Output: the same size at any text size', async () => {
    const { core } = await openAppearance();
    const triangle = () => host.querySelector<HTMLElement>('[data-testid="sample-reading-line"]')!;
    const size = () => [
      triangle().style.borderLeftWidth,
      triangle().style.borderTopWidth,
      triangle().style.borderBottomWidth,
    ];
    // The Output's triangle is 56px wide and 64px tall on the stage; the sample is 0.4 of it.
    expect(size()).toEqual(['22.4px', '12.8px', '12.8px']);
    await act(async () => core.dispatch({ type: 'setAppearance', changes: { fontSize: 120 } }));
    expect(size()).toEqual(['22.4px', '12.8px', '12.8px']);
    await act(async () => core.dispatch({ type: 'setAppearance', changes: { fontSize: 24 } }));
    expect(size()).toEqual(['22.4px', '12.8px', '12.8px']);
    // The text, by contrast, follows the font size.
    const sample = host.querySelector<HTMLElement>('[data-testid="sample"]')!;
    expect(sample.style.fontSize).toBe('9.6px');
  });

  it('keeps the title, the sample and the tab strip fixed above the tab panel', async () => {
    await openAppearance();
    const head = host.querySelector('.pf-head')!;
    const panel = host.querySelector('[role="tabpanel"]')!;
    expect(head.querySelector('h2')!.textContent).toBe('Appearance');
    expect(head.querySelector('[data-testid="sample"]')).not.toBeNull();
    expect(head.querySelector('[role="tablist"]')).not.toBeNull();
    expect(panel.contains(head)).toBe(false);
    expect(panel.querySelector('[data-testid="sample"]')).toBeNull();
    expect(panel.querySelector('[aria-label="Font size"]')).not.toBeNull();
  });

  it('has the four tabs, each with its own settings', async () => {
    await openAppearance();
    expect(tabNames()).toEqual(['Text', 'Colors', 'Reading line', 'Presets']);
    const has = (names: string[]) =>
      names.every((n) =>
        host.querySelector('[role="tabpanel"]')!.querySelector(`[aria-label="${n}"]`),
      );
    expect(has(['Font size', 'Line spacing', 'Text width', 'Margin'])).toBe(true);
    await openTab('Colors');
    expect(has(['Text color', 'Background', 'Reading line color', 'Progress bar color'])).toBe(
      true,
    );
    await openTab('Reading line');
    expect(has(['Reading line', 'Reading line position', 'Mirror'])).toBe(true);
    await openTab('Presets');
    expect(has(['Preset', 'Preset name'])).toBe(true);
    expect(button('Save Preset')).toBeDefined();
    expect(button('Delete Preset')).toBeDefined();
  });

  it('shows the sample above every tab, and it follows a change made on any of them', async () => {
    await openAppearance();
    for (const name of ['Text', 'Colors', 'Reading line', 'Presets']) {
      await openTab(name);
      expect(host.querySelector('.pf-head [data-testid="sample"]'), name).not.toBeNull();
    }
    await openTab('Reading line');
    await act(async () => field('Mirror').click());
    await openTab('Presets');
    expect(host.querySelector<HTMLElement>('[data-testid="sample"]')!.style.transform).toContain(
      'scaleX(-1)',
    );
  });

  it('switches tabs with the mouse and the arrow keys, Home and End', async () => {
    await openAppearance();
    const press = async (key: string) =>
      act(async () => {
        host
          .querySelector('[role="tab"][aria-selected="true"]')!
          .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    const selected = () => host.querySelector('[role="tab"][aria-selected="true"]')!.textContent;
    expect(selected()).toBe('Text');
    await press('ArrowRight');
    expect(selected()).toBe('Colors');
    expect(document.activeElement).toBe(tab('Colors'));
    await press('ArrowLeft');
    await press('ArrowLeft');
    expect(selected()).toBe('Presets');
    await press('Home');
    expect(selected()).toBe('Text');
    await press('End');
    expect(selected()).toBe('Presets');
    await openTab('Colors');
    expect(selected()).toBe('Colors');
    expect(host.querySelector('[role="tabpanel"]')!.getAttribute('aria-labelledby')).toBe(
      tab('Colors').id,
    );
  });

  it('remembers the chosen category and tab while the window is open', async () => {
    await openAppearance('Colors');
    await act(async () => (nav('General') as HTMLElement).click());
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    await act(async () => (nav('Appearance') as HTMLElement).click());
    expect(tab('Colors').getAttribute('aria-selected')).toBe('true');
  });

  it('gives every category a title and a panel; only the Quick messages list scrolls', async () => {
    await mount();
    for (const name of ['General', 'Output', 'Controls', 'Notifications', 'Network']) {
      await act(async () => (nav(name) as HTMLElement).click());
      expect(host.querySelector('.pf-head h2')!.textContent).toBe(name);
      expect(host.querySelector('.pf-panel')).not.toBeNull();
    }
    expect(host.querySelectorAll('[data-scrolls]')).toHaveLength(0);
    await openTab('Quick messages');
    const scrolling = host.querySelectorAll('[data-scrolls]');
    expect(scrolling).toHaveLength(1);
    expect(scrolling[0]!.querySelector('[aria-label="Quick message 1"]')).not.toBeNull();
  });

  it('sets the Reading line position with a slider, and the sample shows it', async () => {
    const m = await openAppearance('Reading line');
    expect(field('Reading line position').value).toBe('25');
    await setValue(field('Reading line position'), '60');
    expect(m.core.getState().appearance.readingLineY).toBeCloseTo(0.6, 5);
    const triangle = host.querySelector<HTMLElement>('[data-testid="sample-reading-line"]')!;
    expect(triangle.style.top).toBe('60%');
  });

  it('switches the Reading line and the mirror through the core', async () => {
    const { core, dispatched } = await openAppearance('Reading line');
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
  const setFontSize = async (value: string) => {
    await openTab('Text');
    await setValue(field('Font size'), value);
    await openTab('Presets');
  };

  it('saves the current Appearance under a name and selects it', async () => {
    const { core } = await openAppearance();
    await setFontSize('90');
    await setValue(field('Preset name'), 'Large text');
    await act(async () => button('Save Preset').click());
    expect(core.getState().presets).toEqual(['Large text']);
    expect(core.getState().activePreset).toBe('Large text');
    expect(field('Preset name').value).toBe('');
  });

  it('loads a Preset chosen from the list', async () => {
    const { core } = await openAppearance();
    await setFontSize('90');
    await act(async () => core.dispatch({ type: 'savePreset', name: 'Big' }));
    await setFontSize('30');
    await setValue(field('Preset'), 'Big');
    expect(core.getState().appearance.fontSize).toBe(90);
    expect(core.getState().activePreset).toBe('Big');
  });

  it('deletes the selected Preset', async () => {
    const { core } = await openAppearance();
    await openTab('Presets');
    await act(async () => core.dispatch({ type: 'savePreset', name: 'Big' }));
    await act(async () => button('Delete Preset').click());
    expect(core.getState().presets).toEqual([]);
  });

  it('cannot delete when no Preset is selected', async () => {
    await openAppearance();
    await openTab('Presets');
    expect((button('Delete Preset') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('General', () => {
  it('switches the theme and applies it to this window', async () => {
    const { core, dispatched } = await mount();
    await setValue(field('Theme'), 'light');
    expect(dispatched).toContainEqual({ type: 'setTheme', theme: 'light' });
    expect(core.getState().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('chooses the mode the app opens in', async () => {
    const { core } = await mount();
    expect(field('Open in').value).toBe('last');
    await setValue(field('Open in'), 'run');
    expect(core.getState().openInMode).toBe('run');
  });

  it('shows the app version on the General page', async () => {
    await mount();
    expect(host.querySelector('[data-testid="app-version"]')?.textContent).toBe(
      'NeoPrompter version 1.2.3',
    );
  });

  it('shows the Watched folder as Off, then chooses one and clears it', async () => {
    await mount();
    expect(field('Watched folder').textContent).toBe('Off');
    expect(button('Clear')).toBeUndefined();
    await act(async () => button('Choose…').click());
    expect(field('Watched folder').textContent).toBe('/Scripts/Drop');
    await act(async () => button('Clear').click());
    expect(field('Watched folder').textContent).toBe('Off');
  });

  it('shows what the last automatic Import said under the folder', async () => {
    await mount(
      {},
      {
        watched: {
          path: '/Scripts/Drop',
          lastResult: 'Imported "Sunday" from the Watched folder.',
        },
      },
    );
    expect(host.querySelector('[data-testid="watched-folder-result"]')!.textContent).toBe(
      'Imported "Sunday" from the Watched folder.',
    );
  });

  it('says in plain words when the folder is gone', async () => {
    await mount({}, { watched: { path: '/Scripts/Drop', missing: true } });
    expect(host.textContent).toContain('This folder is not there any more');
  });

  it('shows no status line before anything has happened', async () => {
    await mount({}, { watched: { path: '/Scripts/Drop' } });
    expect(host.querySelector('[data-testid="watched-folder-result"]')).toBeNull();
    expect(host.textContent).not.toContain('not there any more');
  });
});

describe('Output', () => {
  async function openOutput(view: Partial<OutputWindowView> = {}) {
    const m = await mount(view);
    await act(async () => (nav('Output') as HTMLElement).click());
    return m;
  }

  it('lists the connected displays and shows the chosen one', async () => {
    await openOutput();
    const options = Array.from(field('Monitor').querySelectorAll('option'), (o) =>
      o.textContent?.trim(),
    );
    expect(options).toContain('Built-in display (this screen)');
    expect(options).toContain('Prompter monitor');
    expect(field('Monitor').value).toBe('b');
  });

  it('chooses another monitor', async () => {
    const { chosen } = await openOutput();
    await setValue(field('Monitor'), 'a');
    expect(chosen).toEqual(['a']);
  });

  it('says when the remembered monitor is not connected', async () => {
    await openOutput({ chosenMonitorId: 'gone', blocked: 'missing-monitor' });
    expect(host.querySelector('main')!.textContent).toContain('not connected');
  });

  it('turns Windowed Output on', async () => {
    const { windowedCalls } = await openOutput();
    await act(async () => field('Windowed Output').click());
    expect(windowedCalls).toEqual([true]);
    expect(field('Windowed Output').getAttribute('aria-checked')).toBe('true');
  });
});

describe('Notifications', () => {
  async function openNotifications() {
    const m = await mount();
    await act(async () => (nav('Notifications') as HTMLElement).click());
    return m;
  }

  it('shows the time in seconds beside the slider', async () => {
    await openNotifications();
    expect(field('Notification time').value).toBe('8');
    expect(host.querySelector('.pf-value')!.textContent).toBe('8 s');
  });

  it('sets the time in milliseconds and shows the new seconds', async () => {
    const { core } = await openNotifications();
    await setValue(field('Notification time'), '15');
    expect(core.getState().notificationDurationMs).toBe(15000);
    expect(host.querySelector('.pf-value')!.textContent).toBe('15 s');
  });
});

/** Commit a text field the way a person does: type, then leave the field. */
async function typeAndLeave(el: HTMLInputElement, value: string) {
  await setValue(el, value);
  await act(async () => {
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

describe('Controls', () => {
  async function openControls() {
    const m = await mount();
    await act(async () => (nav('Controls') as HTMLElement).click());
    return m;
  }

  it('shows the action of each of the five buttons by name', async () => {
    await openControls();
    expect(field('Button 1').value).toBe('playPause');
    expect(field('Button 4').value).toBe('none');
    const first = Array.from(field('Button 1').querySelectorAll('option'), (o) =>
      o.textContent?.trim(),
    );
    expect(first).toEqual([
      'Unassigned',
      'Play / Pause',
      'Back a Screen',
      'Forward a Screen',
      'Play start',
    ]);
  });

  it('remaps a button, which the main process saves', async () => {
    const { getMapping } = await openControls();
    await setValue(field('Button 4'), 'returnToPlayStart');
    expect(getMapping().mapping[4]).toBe('returnToPlayStart');
    expect(field('Button 4').value).toBe('returnToPlayStart');
  });

  it('follows a mapping changed in another window', async () => {
    const { getMapping } = await openControls();
    await setValue(field('Button 2'), 'none'); // another window would call the same thing
    expect(field('Button 2').value).toBe('none');
    expect(getMapping().mapping[2]).toBe('none');
  });

  it('cannot assign the mirror: it is not among the choices', async () => {
    await openControls();
    const values = Array.from(field('Button 1').querySelectorAll('option'), (o) => o.value);
    expect(values.some((v) => /mirror/i.test(v))).toBe(false);
  });

  it('shows the ring and the jog wheel as fixed', async () => {
    await openControls();
    const text = host.querySelector('main')!.textContent!;
    expect(text).toContain('Ring and jog wheel');
    expect(host.querySelectorAll('main select')).toHaveLength(5);
  });
});

describe('Network', () => {
  async function openNetwork(...args: Parameters<typeof mount>) {
    const m = await mount(...args);
    await act(async () => (nav('Network') as HTMLElement).click());
    return m;
  }
  async function openQuickMessages() {
    const m = await openNetwork();
    await openTab('Quick messages');
    return m;
  }

  it('has a Connection tab and a Quick messages tab', async () => {
    await openNetwork();
    expect(tabNames()).toEqual(['Connection', 'Quick messages']);
    expect(tab('Connection').getAttribute('aria-selected')).toBe('true');
    expect(field('Quick message 1')).toBeNull();
    await openTab('Quick messages');
    expect(field('Port')).toBeNull();
  });

  it('shows the port, the token and the Producer page address', async () => {
    await openNetwork();
    expect(field('Port').value).toBe('4780');
    expect(field('Access token').value).toBe('sekret');
    expect(field('Access token').type).toBe('password');
    expect(host.querySelector('main')!.textContent).toContain('http://192.168.1.20:4780/');
  });

  it('changes the port when the field is left, with no Save button', async () => {
    const { apiSaved } = await openNetwork();
    await typeAndLeave(field('Port'), '4900');
    expect(apiSaved).toEqual([{ port: 4900, token: 'sekret' }]);
    expect(button('Save')).toBeUndefined();
  });

  it('changes the token and keeps requiring one', async () => {
    const { apiSaved } = await openNetwork();
    await typeAndLeave(field('Access token'), 'newer');
    expect(apiSaved).toEqual([{ port: 4780, token: 'newer' }]);
    expect(host.querySelector('main')!.textContent).toContain('Needed to open the Producer page');
  });

  it('does nothing for a port that is not allowed', async () => {
    const { apiSaved } = await openNetwork();
    await typeAndLeave(field('Port'), '80');
    expect(apiSaved).toEqual([]);
    expect(host.querySelector('main')!.textContent).toContain('1024');
    expect(field('Port').value).toBe('4780');
  });

  it('says plainly when the Producer page could not start', async () => {
    await openNetwork({}, { api: { running: false, error: 'Port 4780 is in use.' } });
    expect(host.querySelector('[role="status"]')!.textContent).toContain('Port 4780 is in use');
  });

  it('lists the Quick messages', async () => {
    await openQuickMessages();
    expect(field('Quick message 1').value).toBe('Slow down');
    expect(field('Quick message 2').value).toBe('Wrap up');
  });

  it('adds a Quick message', async () => {
    const { quickSaved } = await openQuickMessages();
    await setValue(field('New Quick message'), 'Look at camera');
    await act(async () => button('Add').click());
    expect(quickSaved.at(-1)).toEqual([
      { text: 'Slow down', color: 'amber' },
      { text: 'Wrap up' },
      { text: 'Look at camera' },
    ]);
    expect(field('Quick message 3').value).toBe('Look at camera');
    expect(field('New Quick message').value).toBe('');
  });

  it('edits a Quick message when the field is left', async () => {
    const { quickSaved } = await openQuickMessages();
    await typeAndLeave(field('Quick message 2'), 'Wrap up now');
    expect(quickSaved.at(-1)).toEqual([
      { text: 'Slow down', color: 'amber' },
      { text: 'Wrap up now' },
    ]);
  });

  it('shows each Quick message color and changes or clears it', async () => {
    const { quickSaved } = await openQuickMessages();
    expect(field('Quick message 1 color').value).toBe('amber');
    expect(field('Quick message 2 color').value).toBe('');
    await setValue(field('Quick message 2 color'), 'red');
    expect(quickSaved.at(-1)).toEqual([
      { text: 'Slow down', color: 'amber' },
      { text: 'Wrap up', color: 'red' },
    ]);
    await setValue(field('Quick message 1 color'), '');
    expect(quickSaved.at(-1)).toEqual([{ text: 'Slow down' }, { text: 'Wrap up', color: 'red' }]);
  });

  it('removes a Quick message', async () => {
    const { quickSaved } = await openQuickMessages();
    await act(async () => field('Remove Quick message 1').click());
    expect(quickSaved.at(-1)).toEqual([{ text: 'Wrap up' }]);
    expect(field('Quick message 1').value).toBe('Wrap up');
  });

  it('does not add an empty Quick message', async () => {
    await openQuickMessages();
    expect((button('Add') as HTMLButtonElement).disabled).toBe(true);
  });
});
