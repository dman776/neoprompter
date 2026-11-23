import { describe, expect, it } from 'vitest';
import { createCore, createFakeClock } from '../core';
import {
  createInputMapper,
  createInputService,
  normalizeButtonMapping,
  defaultButtonMapping,
  keyToAction,
  wheelToLines,
  JOG_WRAP,
} from './index';

function setup() {
  const clock = createFakeClock();
  const core = createCore({
    clock,
    script: { name: 't', lines: Array.from({ length: 500 }, (_, i) => `l${i}`) },
  });
  core.dispatch({ type: 'setViewport', lines: 10 });
  const mapper = createInputMapper(core);
  return { clock, core, mapper };
}

describe('input mapping', () => {
  it('ring events deflect the core ring and release returns to the prior play state', () => {
    const { clock, core, mapper } = setup();
    mapper.handle({ kind: 'ring', deflection: 1 });
    clock.advance(500);
    expect(core.getState().position).toBeGreaterThan(-core.getState().leadIn + 5);
    mapper.handle({ kind: 'ring', deflection: 0 });
    expect(core.getState().playing).toBe(false);
    const p = core.getState().position;
    clock.advance(1000);
    expect(core.getState().position).toBe(p);
  });

  it('jog wheel turns set speed from stopped to fast, clamped, with wraparound', () => {
    const { core, mapper } = setup();
    mapper.handle({ kind: 'jog', position: 10 }); // baseline, no change
    const base = core.getState().speedLevel;
    mapper.handle({ kind: 'jog', position: 12 });
    expect(core.getState().speedLevel).toBe(base + 2);
    mapper.handle({ kind: 'jog', position: 100 });
    expect(core.getState().speedLevel).toBe(10);
    mapper.handle({ kind: 'jog', position: 100 - 50 });
    expect(core.getState().speedLevel).toBe(0);
    // wrap: 255 -> 1 is a step of +2
    mapper.handle({ kind: 'jog', position: JOG_WRAP - 1 });
    mapper.handle({ kind: 'jog', position: 1 });
    expect(core.getState().speedLevel).toBe(2);
  });

  it('default buttons: 1 play/pause, 2 back a Screen, 3 forward a Screen, 4 none, 5 dismiss', () => {
    expect(defaultButtonMapping).toEqual({
      1: 'playPause',
      2: 'jumpBack',
      3: 'jumpForward',
      4: 'none',
      5: 'dismissNotification',
    });
    const { core, mapper } = setup();
    mapper.handle({ kind: 'button', button: 1, pressed: true });
    expect(core.getState().playing).toBe(true);
    mapper.handle({ kind: 'button', button: 1, pressed: false });
    expect(core.getState().playing).toBe(true);
    mapper.handle({ kind: 'button', button: 1, pressed: true });
    expect(core.getState().playing).toBe(false);
    mapper.handle({ kind: 'button', button: 3, pressed: true });
    expect(core.getState().position).toBe(-core.getState().leadIn + 9);
    mapper.handle({ kind: 'button', button: 2, pressed: true });
    expect(core.getState().position).toBe(-core.getState().leadIn);
  });

  it('buttons 4 and 5 do nothing harmful by default', () => {
    const { core, mapper } = setup();
    const before = core.getState();
    mapper.handle({ kind: 'button', button: 4, pressed: true });
    mapper.handle({ kind: 'button', button: 5, pressed: true });
    expect(core.getState()).toEqual(before);
  });

  it('buttons are remappable, and mirror cannot be mapped', () => {
    const { core, mapper } = setup();
    expect(mapper.setButton(4, 'returnToPlayStart')).toBe(true);
    expect(mapper.getMapping()[4]).toBe('returnToPlayStart');
    core.dispatch({ type: 'scrollBy', lines: 20 });
    mapper.handle({ kind: 'button', button: 4, pressed: true });
    expect(core.getState().position).toBe(-core.getState().leadIn);
    expect(mapper.setButton(4, 'toggleMirror')).toBe(false);
    expect(mapper.setButton(4, 'mirror')).toBe(false);
    expect(mapper.getMapping()[4]).toBe('returnToPlayStart');
    expect(mapper.availableActions()).not.toContain('toggleMirror');
    expect(mapper.availableActions()).not.toContain('mirror');
    mapper.handle({ kind: 'button', button: 1, pressed: true });
    expect(core.getState().appearance.mirror).toBe(false);
  });

  it('a new action can be registered the dismiss action without changing the mapper', () => {
    const { mapper } = setup();
    let dismissed = 0;
    mapper.registerAction('dismissNotification', () => dismissed++);
    mapper.handle({ kind: 'button', button: 5, pressed: true });
    expect(dismissed).toBe(1);
  });

  it('button 5 dismisses the newest Notification by default', () => {
    const { core, mapper } = setup();
    core.dispatch({ type: 'notify', text: 'a' });
    core.dispatch({ type: 'notify', text: 'b' });
    mapper.handle({ kind: 'button', button: 5, pressed: true });
    expect(core.getState().notifications.map((n) => n.text)).toEqual(['a']);
  });

  it('speed up and speed down actions move the speed level', () => {
    const { core, mapper } = setup();
    const base = core.getState().speedLevel;
    mapper.runAction('speedUp');
    expect(core.getState().speedLevel).toBe(base + 1);
    mapper.runAction('speedDown');
    mapper.runAction('speedDown');
    expect(core.getState().speedLevel).toBe(base - 1);
  });
});

describe('keyboard and mouse', () => {
  it('keys cover play/pause, speed up/down, back and forward a Screen', () => {
    expect(keyToAction(' ')).toBe('playPause');
    expect(keyToAction('ArrowUp')).toBe('speedUp');
    expect(keyToAction('ArrowDown')).toBe('speedDown');
    expect(keyToAction('PageUp')).toBe('jumpBack');
    expect(keyToAction('PageDown')).toBe('jumpForward');
    expect(keyToAction('x')).toBeNull();
  });

  it('keyboard actions go through the same command path as the buttons', () => {
    const { core, mapper } = setup();
    mapper.runAction(keyToAction(' ')!);
    expect(core.getState().playing).toBe(true);
  });

  it('wheel scrolling converts pixels to lines, down moves forward', () => {
    expect(wheelToLines(40)).toBeGreaterThan(0);
    expect(wheelToLines(-40)).toBeLessThan(0);
    expect(wheelToLines(80)).toBeCloseTo(2 * wheelToLines(40));
    // line-mode wheels (deltaMode 1) already count lines
    expect(wheelToLines(3, 1)).toBe(3);
  });

  it('wheel input repositions the Script via the core', () => {
    const { core, mapper } = setup();
    mapper.handle({ kind: 'scroll', lines: 5 });
    expect(core.getState().position).toBe(-core.getState().leadIn + 5);
  });
});

describe('jog wheel continuity', () => {
  it('fractional positions give fractional speed and a rebase sets a new baseline without a jump', () => {
    const { core, mapper } = setup();
    mapper.handle({ kind: 'jog', position: 0 });
    const base = core.getState().speedLevel;
    mapper.handle({ kind: 'jog', position: 0.25 });
    expect(core.getState().speedLevel).toBeCloseTo(base + 0.25, 3);
    mapper.handle({ kind: 'jog', position: 100, rebase: true });
    expect(core.getState().speedLevel).toBeCloseTo(base + 0.25, 3);
    mapper.handle({ kind: 'jog', position: 100.5 });
    expect(core.getState().speedLevel).toBeCloseTo(base + 0.75, 3);
  });
});

describe('the input service', () => {
  function service(saved: Partial<Record<number, string>> | null = null) {
    const { core } = setup();
    const writes: Array<Record<number, string>> = [];
    const svc = createInputService(core, {
      load: () => saved as never,
      save: (m) => writes.push(m),
    });
    return { core, svc, writes };
  }

  it('starts from the saved mapping and falls back to the defaults', () => {
    expect(service().svc.getMapping()).toEqual(defaultButtonMapping);
    const { svc } = service({ 4: 'speedUp' });
    expect(svc.getMapping()[4]).toBe('speedUp');
    expect(svc.getMapping()[1]).toBe('playPause');
  });

  it('persists a remap, tells listeners, and refuses mirror', () => {
    const { svc, writes } = service();
    const seen: string[] = [];
    svc.subscribe((view) => seen.push(view.mapping[4]));
    expect(svc.setButton(4, 'returnToPlayStart')).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0][4]).toBe('returnToPlayStart');
    expect(seen).toEqual(['returnToPlayStart']);
    expect(svc.setButton(4, 'mirror')).toBe(false);
    expect(writes).toHaveLength(1);
  });

  it('turns device events into core commands', () => {
    const { core, svc } = service();
    svc.handle({ kind: 'button', button: 1, pressed: true });
    expect(core.getState().playing).toBe(true);
  });

  it('the view lists the actions that can be chosen, without mirror', () => {
    const { svc } = service();
    expect(svc.getView().actions).toContain('dismissNotification');
    expect(svc.getView().actions).not.toContain('mirror');
  });
});

describe('normalizeButtonMapping', () => {
  it('keeps known buttons with string actions and drops the rest', () => {
    expect(normalizeButtonMapping({ 1: 'speedUp', 9: 'x', 2: 5 })).toEqual({ 1: 'speedUp' });
    expect(normalizeButtonMapping('nope')).toBeNull();
    expect(normalizeButtonMapping(null)).toBeNull();
  });
});
