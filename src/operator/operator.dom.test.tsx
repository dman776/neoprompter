// @vitest-environment jsdom
// Renderer seam: the real Operator view, driven by a real core, in a DOM. It checks what the
// Operator sees and the commands the view sends; real layout is covered by the Electron test.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock, type Command } from '../core';
import { App } from './App';
import type { CoreBridge } from './useCoreState';
import type { OutputWindowView } from '../output-window';
import type { ApiView } from '../api';
import type { UiAction } from '../window-host';

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

const shownView: OutputWindowView = {
  windowed: false,
  outputOn: true,
  blocked: null,
  chosenMonitorId: 'prompter',
  missingMonitorId: null,
  monitors: [],
};

const apiView: ApiView = { port: 4780, token: '', running: true, error: null, producerUrls: [] };

async function mount(
  outputView: OutputWindowView = shownView,
  api: ApiView = apiView,
  lines: string[] = ['alpha', 'beta', 'gamma'],
) {
  const clock = createFakeClock();
  const core = createCore({ clock, script: { name: 'Sunday', lines } });
  const dispatched: Command[] = [];
  const listeners: Array<(s: ReturnType<typeof core.getState>) => void> = [];
  const menuListeners: Array<(action: UiAction) => void> = [];
  const menu = (action: UiAction) => act(() => menuListeners.forEach((l) => l(action)));
  core.subscribe((s) => listeners.forEach((l) => act(() => l(s))));
  const bridge: CoreBridge = {
    getState: async () => core.getState(),
    dispatch: (c) => {
      dispatched.push(c);
      core.dispatch(c);
    },
    onState: (l) => listeners.push(l),
    getOutputView: async () => outputView,
    getApiView: async () => api,
    onMenuAction: (l) => menuListeners.push(l),
    chooseOutputMonitor: async () => outputView,
    setWindowedOutput: async () => outputView,
  };
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  return { core, clock, dispatched, menu };
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
    expect(dispatched).toContainEqual({ type: 'setMode', mode: 'run' });
    expect(core.getState().mode).toBe('run');
    expect(host.querySelector('main')!.getAttribute('data-mode')).toBe('run');
    expect(host.querySelector('footer')!.textContent).toContain('Run mode');
  });

  it('follows a mode change that came from somewhere else', async () => {
    const { core } = await mount();
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    expect(host.querySelector('main')!.getAttribute('data-mode')).toBe('run');
  });

  it('shows the Output switch Off, then On after the Operator presses it', async () => {
    const { core, dispatched } = await mount();
    const lamp = () => host.querySelector('header [role="switch"]')!;
    expect(lamp().getAttribute('aria-checked')).toBe('false');
    expect(lamp().textContent).toContain('Output');
    await act(async () => (lamp() as HTMLElement).click());
    // The mini Live view measures the Script while the Output is off; that is not the switch.
    expect(dispatched.filter((c) => c.type === 'setOutput')).toEqual([
      { type: 'setOutput', on: true },
    ]);
    expect(core.getState().outputOn).toBe(true);
    expect(lamp().getAttribute('aria-checked')).toBe('true');
    await act(async () => (lamp() as HTMLElement).click());
    expect(dispatched.filter((c) => c.type === 'setOutput').at(-1)).toEqual({
      type: 'setOutput',
      on: false,
    });
  });

  it('follows an Output switch that came from somewhere else', async () => {
    const { core } = await mount();
    await act(async () => core.dispatch({ type: 'setOutput', on: true }));
    expect(host.querySelector('header [role="switch"]')!.getAttribute('aria-checked')).toBe('true');
    expect(host.querySelector('footer')!.textContent).toContain('Output on');
  });

  it('says plainly why the Output stays closed when its monitor is not connected', async () => {
    const { core } = await mount({ ...shownView, blocked: 'missing-monitor' });
    expect(host.querySelector('[role="alert"]')).toBeNull();
    await act(async () => core.dispatch({ type: 'setOutput', on: true }));
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('not connected');
  });

  it('uses the dark theme', async () => {
    await mount();
    expect(document.documentElement.getAttribute('data-theme') ?? 'dark').toBe('dark');
  });
});

describe('the right-hand column', () => {
  const side = () => host.querySelector('.run-side');
  const toggle = () =>
    host.querySelector<HTMLButtonElement>('header [data-testid="toggle-column"]')!;

  it('collapses and restores from the header button in Run mode', async () => {
    const { core, dispatched } = await mount();
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    expect(side()).not.toBeNull();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    await act(async () => toggle().click());
    expect(dispatched.at(-1)).toEqual({ type: 'setRightColumnCollapsed', collapsed: true });
    expect(side()).toBeNull();
    expect(host.querySelector('.run')!.getAttribute('data-collapsed')).toBe('true');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe('Show right column');
    await act(async () => toggle().click());
    expect(side()).not.toBeNull();
  });

  it('collapses from the View menu item', async () => {
    const { core, menu } = await mount();
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    await menu('toggle-right-column');
    expect(core.getState().rightColumnCollapsed).toBe(true);
    expect(side()).toBeNull();
    await menu('toggle-right-column');
    expect(core.getState().rightColumnCollapsed).toBe(false);
    expect(side()).not.toBeNull();
  });

  it('stays collapsed when the mode changes, and the button still shows it', async () => {
    const { core } = await mount();
    await act(async () => core.dispatch({ type: 'setRightColumnCollapsed', collapsed: true }));
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    expect(side()).toBeNull();
    await act(async () => core.dispatch({ type: 'setMode', mode: 'edit' }));
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    expect(side()).toBeNull();
  });
});

describe('the theme', () => {
  const theme = () => document.documentElement.getAttribute('data-theme');
  const toggle = () =>
    host.querySelector<HTMLButtonElement>('header [data-testid="toggle-theme"]')!;

  it('switches to light and back from the header button', async () => {
    const { core, dispatched } = await mount();
    expect(theme()).toBe('dark');
    await act(async () => toggle().click());
    expect(dispatched.at(-1)).toEqual({ type: 'setTheme', theme: 'light' });
    expect(core.getState().theme).toBe('light');
    expect(theme()).toBe('light');
    await act(async () => toggle().click());
    expect(theme()).toBe('dark');
  });

  it('switches from the View menu item', async () => {
    const { core, menu } = await mount();
    await menu('toggle-theme');
    expect(core.getState().theme).toBe('light');
    expect(theme()).toBe('light');
  });

  it('follows a theme that came from somewhere else', async () => {
    const { core } = await mount();
    await act(async () => core.dispatch({ type: 'setTheme', theme: 'light' }));
    expect(theme()).toBe('light');
  });
});

describe('Notification overlays', () => {
  it('shows a Notification with its text, its source and a Dismiss button, outside the layout flow', async () => {
    const { core } = await mount();
    await act(async () => core.dispatch({ type: 'notify', text: 'Wrap up in two minutes' }));
    const overlay = host.querySelector('[data-testid="notifications"]')!;
    expect(overlay.textContent).toContain('Wrap up in two minutes');
    expect(overlay.textContent).toContain('Producer');
    expect(overlay.querySelector('button')!.textContent).toBe('Dismiss');
    // Not a child of the layout grid, so it cannot move or resize anything.
    expect(host.querySelector('main')!.contains(overlay)).toBe(false);
    expect(host.querySelector('header')!.contains(overlay)).toBe(false);
  });

  it('dismisses the Notification through the core', async () => {
    const { core, dispatched } = await mount();
    await act(async () => core.dispatch({ type: 'notify', text: 'Hello' }));
    const id = core.getState().notifications[0]!.id;
    await act(async () => button('Dismiss').click());
    expect(dispatched).toContainEqual({ type: 'dismissNotification', id });
    expect(host.querySelector('[data-testid="notifications"]')!.textContent).not.toContain('Hello');
  });

  it('stacks several Notifications and shows them in both modes', async () => {
    const { core } = await mount();
    await act(async () => {
      core.dispatch({ type: 'notify', text: 'First' });
      core.dispatch({ type: 'notify', text: 'Second' });
      core.dispatch({ type: 'setMode', mode: 'run' });
    });
    const items = host.querySelectorAll('[data-testid="notifications"] [role="status"]');
    expect(items).toHaveLength(2);
  });
});

describe('Run mode: the Live view', () => {
  const runMode = async (view?: OutputWindowView, api?: ApiView) => {
    const m = await mount(view, api);
    await act(async () => m.core.dispatch({ type: 'setMode', mode: 'run' }));
    return m;
  };
  const live = () => host.querySelector('[data-testid="live-view"]')!;
  const paragraphs = () =>
    Array.from(live().querySelectorAll('[data-live="text"] > div'), (p) => p.textContent?.trim());

  it('shows the Script as the Talent sees it, with the Reading line and Progress bar', async () => {
    await runMode();
    expect(paragraphs()).toEqual(['alpha', 'beta', 'gamma']);
    expect(live().querySelector('[data-live="reading-line"]')).not.toBeNull();
    expect(live().querySelector('[data-live="progress"]')).not.toBeNull();
  });

  it('stays in step with the Output after a Script edit and a Preset change', async () => {
    const { core } = await runMode();
    await act(async () => core.dispatch({ type: 'setUnlocked', unlocked: true }));
    await act(async () => core.dispatch({ type: 'liveFix', line: 1, text: 'BETA' }));
    expect(paragraphs()).toEqual(['alpha', 'BETA', 'gamma']);
    await act(async () => core.dispatch({ type: 'setAppearance', changes: { mirror: true } }));
    expect((live().querySelector('[data-live="surface"]') as HTMLElement).style.transform).toBe(
      'scaleX(-1)',
    );
  });

  it('moves the text with the reading position', async () => {
    const m = await mount(
      shownView,
      apiView,
      Array.from({ length: 80 }, (_, i) => `line ${i}`),
    );
    await act(async () => m.core.dispatch({ type: 'setMode', mode: 'run' }));
    const { core, clock } = m;
    const shift = () => (live().querySelector('[data-live="text"]') as HTMLElement).style.transform;
    const before = shift();
    await act(async () => {
      core.dispatch({ type: 'play' });
      clock.advance(1000);
      core.dispatch({ type: 'setSpeed', level: core.getState().speedLevel });
    });
    expect(shift()).not.toBe(before);
  });

  it('says whether the Output is on or off', async () => {
    const { core } = await runMode();
    const badge = () => live().querySelector('[data-testid="live-badge"]')!.textContent;
    expect(badge()).toBe('Output off');
    await act(async () => core.dispatch({ type: 'setOutput', on: true }));
    expect(badge()).toBe('Output on');
  });

  it('measures the Script itself only while the Output is not showing', async () => {
    const { core, dispatched } = await runMode();
    expect(dispatched.some((c) => c.type === 'setViewport')).toBe(true);
    expect(dispatched.some((c) => c.type === 'setLineExtents')).toBe(true);
    dispatched.length = 0;
    await act(async () => core.dispatch({ type: 'setOutput', on: true }));
    await act(async () => core.dispatch({ type: 'editLine', line: 0, text: 'changed' }));
    expect(dispatched.filter((c) => c.type !== 'setOutput' && c.type !== 'editLine')).toEqual([]);
  });
});

describe('Run mode: transport', () => {
  const runMode = async () => {
    const m = await mount(
      shownView,
      apiView,
      Array.from({ length: 80 }, (_, i) => `line ${i}`),
    );
    await act(async () => m.core.dispatch({ type: 'setMode', mode: 'run' }));
    m.dispatched.length = 0;
    return m;
  };
  const key = (name: string) =>
    host.querySelector<HTMLButtonElement>(
      `[data-testid="transport"] button[aria-label="${name}"]`,
    )!;

  it('plays and pauses with the same commands as every other surface', async () => {
    const { core, dispatched } = await runMode();
    await act(async () => key('Play').click());
    expect(dispatched).toEqual([{ type: 'play' }]);
    expect(core.getState().playing).toBe(true);
    await act(async () => key('Pause').click());
    expect(dispatched.at(-1)).toEqual({ type: 'pause' });
    expect(core.getState().playing).toBe(false);
  });

  it('jumps a Screen back or forward and returns to Play start', async () => {
    const { dispatched } = await runMode();
    await act(async () => key('Back a Screen').click());
    await act(async () => key('Forward a Screen').click());
    await act(async () => key('Play start').click());
    expect(dispatched).toEqual([
      { type: 'jumpBack' },
      { type: 'jumpForward' },
      { type: 'returnToPlayStart' },
    ]);
  });

  it('shows time left and position, and they update while playing', async () => {
    const { core, clock } = await runMode();
    const read = (id: string) => host.querySelector(`[data-testid="${id}"]`)!.textContent;
    await act(async () => core.dispatch({ type: 'setSpeed', level: 2 }));
    const left = read('time-left');
    expect(left).toMatch(/^\d+:\d\d$/);
    expect(read('position')).toBe('0%');
    await act(async () => {
      core.dispatch({ type: 'play' });
      clock.advance(3000);
      core.dispatch({ type: 'setSpeed', level: 2 });
    });
    expect(read('time-left')).not.toBe(left);
    expect(read('position')).not.toBe('0%');
  });

  it('shows no time left while the speed is zero', async () => {
    const { core } = await runMode();
    await act(async () => core.dispatch({ type: 'setSpeed', level: 0 }));
    expect(host.querySelector('[data-testid="time-left"]')!.textContent).toBe('--:--');
  });
});

describe('Run mode: status panel', () => {
  const status = () => host.querySelector('[data-testid="status-panel"]')!;
  const item = (name: string) =>
    Array.from(status().querySelectorAll('[data-status]')).find(
      (el) => el.getAttribute('data-status') === name,
    )!.textContent;

  it('shows the state of Output, monitor, ShuttleXPress, Producer page and Preset', async () => {
    const m = await mount({
      ...shownView,
      monitors: [{ id: 'prompter', label: 'Prompter monitor', isOperatorDisplay: false }],
    });
    await act(async () => {
      m.core.dispatch({ type: 'savePreset', name: 'Pastor Dan' });
      m.core.dispatch({ type: 'setMode', mode: 'run' });
    });
    expect(item('output')).toContain('Off');
    expect(item('monitor')).toContain('Prompter monitor');
    expect(item('shuttle')).toContain('Not connected');
    expect(item('producer')).toContain('Listening');
    expect(item('preset')).toContain('Pastor Dan');
    await act(async () => m.core.dispatch({ type: 'setOutput', on: true }));
    expect(item('output')).toContain('On');
  });

  it('says plainly when the Producer page could not start', async () => {
    const m = await mount(shownView, { ...apiView, running: false, error: 'Port 4780 is in use' });
    await act(async () => m.core.dispatch({ type: 'setMode', mode: 'run' }));
    expect(item('producer')).toContain('Port 4780 is in use');
  });
});

describe('Run mode: speed meter, dial and arrow keys', () => {
  const runMode = async () => {
    const m = await mount(
      shownView,
      apiView,
      Array.from({ length: 100 }, (_, i) => `l${i}`),
    );
    await act(async () => m.core.dispatch({ type: 'setMode', mode: 'run' }));
    await act(async () => m.core.dispatch({ type: 'setSpeed', level: 3.4 }));
    return m;
  };
  const readout = () => host.querySelector('[data-testid="speed-readout"]')!.textContent;
  const fills = () =>
    Array.from(host.querySelectorAll('[data-slot="speed-meter"] [data-fill]'), (s) =>
      Number(s.getAttribute('data-fill')),
    );
  const dial = () => host.querySelector('[role="slider"]')!;
  const pointer = (el: Element, type: string, clientY: number) =>
    act(async () => {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientY, button: 0 }));
    });
  const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
    act(async () => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
      );
    });

  it('shows lines per second to two decimals, matching the core', async () => {
    const { core } = await runMode();
    expect(core.getState().speed).toBeCloseTo(1.7);
    expect(readout()).toBe('1.70');
    await act(async () => core.dispatch({ type: 'setSpeed', level: 0.7 }));
    expect(readout()).toBe('0.35');
  });

  it('lights whole segments and shows the partial level in the last lit one', async () => {
    await runMode();
    const f = fills();
    expect(f).toHaveLength(10);
    expect(f.slice(0, 3)).toEqual([1, 1, 1]);
    expect(f[3]).toBeCloseTo(0.4);
    expect(f.slice(4)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('the dial reports the level as a slider value', async () => {
    await runMode();
    expect(dial().getAttribute('aria-valuenow')).toBe('3.4');
    expect(dial().getAttribute('aria-valuemax')).toBe('10');
  });

  it('dragging the dial up raises the speed continuously, and down lowers it', async () => {
    const { core } = await runMode();
    await pointer(dial(), 'pointerdown', 200);
    await pointer(dial(), 'pointermove', 158);
    expect(core.getState().speedLevel).toBeCloseTo(6.4);
    await pointer(dial(), 'pointermove', 242);
    expect(core.getState().speedLevel).toBeCloseTo(0.4);
    await pointer(dial(), 'pointerup', 242);
    await pointer(dial(), 'pointermove', 100);
    expect(core.getState().speedLevel).toBeCloseTo(0.4);
  });

  it('arrow keys nudge the speed, Shift nudges more, while playing', async () => {
    const { core } = await runMode();
    await act(async () => core.dispatch({ type: 'play' }));
    await press('ArrowUp');
    expect(core.getState().speedLevel).toBe(3.5);
    await press('ArrowDown', { shiftKey: true });
    expect(core.getState().speedLevel).toBe(3);
    expect(core.getState().playing).toBe(true);
  });

  it('arrow keys do nothing while typing in a text field', async () => {
    const { core } = await runMode();
    const input = document.createElement('input');
    host.append(input);
    await press('ArrowUp', {}, input);
    expect(core.getState().speedLevel).toBe(3.4);
    const ce = document.createElement('div');
    Object.defineProperty(ce, 'isContentEditable', { value: true });
    host.append(ce);
    await press('ArrowUp', {}, ce);
    expect(core.getState().speedLevel).toBe(3.4);
  });

  it('arrow keys do not change the speed in Edit mode', async () => {
    const { core } = await runMode();
    await act(async () => core.dispatch({ type: 'setMode', mode: 'edit' }));
    await press('ArrowUp');
    expect(core.getState().speedLevel).toBe(3.4);
  });
});
