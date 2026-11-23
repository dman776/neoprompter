// @vitest-environment jsdom
// Renderer seam: the real Virtual shuttle in a DOM with a fake bridge. It checks the device events
// it sends; the mapping of events to commands is tested in src/input.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock } from '../core';
import { defaultButtonMapping, type ButtonMappingView, type DeviceEvent } from '../input';
import { VirtualShuttle, type ShuttleBridge } from './VirtualShuttle';

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

async function mount(view: ButtonMappingView = { mapping: defaultButtonMapping, actions: [] }) {
  const core = createCore({ clock: createFakeClock(), script: { name: 's', lines: ['a'] } });
  const sent: DeviceEvent[] = [];
  const mappingListeners: Array<(v: ButtonMappingView) => void> = [];
  const bridge: ShuttleBridge = {
    getState: async () => core.getState(),
    onState: () => {},
    sendDeviceEvent: (e) => sent.push(e),
    getButtonMapping: async () => view,
    onButtonMapping: (l) => mappingListeners.push(l),
  };
  root = createRoot(host);
  await act(async () => root.render(<VirtualShuttle bridge={bridge} />));
  return { sent, mappingListeners };
}

const fire = (el: Element, type: string, x = 0, y = 0) =>
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
  });
const byId = (id: string) => host.querySelector(`[data-testid="${id}"]`)!;

describe('the Virtual shuttle', () => {
  it('rebases the jog counter when it opens, so a new window causes no speed jump', async () => {
    const { sent } = await mount();
    expect(sent).toContainEqual({ kind: 'jog', position: 0, rebase: true });
  });

  it('the ring deflects as it is dragged and springs back to 0 on release', async () => {
    const { sent } = await mount();
    const ring = byId('ring');
    await fire(ring, 'pointerdown', 100, 0); // 0 degrees
    await fire(ring, 'pointermove', 0, 100); // 90 degrees, past the travel: clamps to 1
    await fire(ring, 'pointerup');
    const rings = sent.filter((e) => e.kind === 'ring');
    expect(rings[0]).toEqual({ kind: 'ring', deflection: 1 });
    expect(rings[rings.length - 1]).toEqual({ kind: 'ring', deflection: 0 });
  });

  it('the jog wheel reports a continuous counter, not whole steps', async () => {
    const { sent } = await mount();
    const jog = byId('jog');
    await fire(jog, 'pointerdown', 100, 0);
    // 7.5 degrees: half a step
    const a = (7.5 * Math.PI) / 180;
    await fire(jog, 'pointermove', 100 * Math.cos(a), 100 * Math.sin(a));
    const jogs = sent.filter((e) => e.kind === 'jog' && !e.rebase) as Array<{ position: number }>;
    expect(jogs).toHaveLength(1);
    expect(jogs[0].position).toBeCloseTo(0.5, 5);
  });

  it('turning the jog wheel the other way wraps the counter below zero', async () => {
    const { sent } = await mount();
    const jog = byId('jog');
    await fire(jog, 'pointerdown', 100, 0);
    const a = (-15 * Math.PI) / 180;
    await fire(jog, 'pointermove', 100 * Math.cos(a), 100 * Math.sin(a));
    const last = sent.filter((e) => e.kind === 'jog').pop() as { position: number };
    expect(last.position).toBeCloseTo(255, 5);
  });

  it('shows five buttons labelled by the mapping and sends presses and releases', async () => {
    const { sent } = await mount();
    const buttons = Array.from(host.querySelectorAll('button.shuttle-button'));
    expect(buttons).toHaveLength(5);
    expect(buttons[0].getAttribute('aria-label')).toBe('Button 1, Play / Pause');
    expect(buttons[3].getAttribute('aria-label')).toBe('Button 4, Unassigned');
    expect(buttons[4].getAttribute('aria-label')).toBe('Button 5, Dismiss Notification');
    await fire(buttons[4], 'pointerdown');
    await fire(buttons[4], 'pointerup');
    expect(sent.filter((e) => e.kind === 'button')).toEqual([
      { kind: 'button', button: 5, pressed: true },
      { kind: 'button', button: 5, pressed: false },
    ]);
  });

  it('follows a mapping change made elsewhere', async () => {
    const { mappingListeners } = await mount();
    await act(async () =>
      mappingListeners.forEach((l) =>
        l({ mapping: { ...defaultButtonMapping, 4: 'speedUp' }, actions: [] }),
      ),
    );
    expect(host.querySelectorAll('button.shuttle-button')[3].getAttribute('aria-label')).toBe(
      'Button 4, Speed up',
    );
  });
});
