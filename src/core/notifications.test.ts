import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemorySessionStore } from './session';
import { DEFAULT_NOTIFICATION_MS, outputState } from './types';

function setup() {
  const clock = createFakeClock();
  const sessionStore = createMemorySessionStore();
  return { clock, sessionStore, core: createCore({ clock, sessionStore }) };
}
const texts = (core: ReturnType<typeof createCore>) =>
  core.getState().notifications.map((n) => n.text);

describe('Notifications', () => {
  it('shows a Notification and auto-dismisses it after the default time', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'notify', text: 'Hello' });
    expect(texts(core)).toEqual(['Hello']);
    clock.advance(DEFAULT_NOTIFICATION_MS - 1);
    expect(texts(core)).toEqual(['Hello']);
    clock.advance(1);
    expect(texts(core)).toEqual([]);
  });

  it('the default display time is 8 seconds', () => {
    expect(setup().core.getState().notificationDurationMs).toBe(8000);
  });

  it('uses the configurable display time', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'setNotificationDuration', ms: 2000 });
    core.dispatch({ type: 'notify', text: 'x' });
    clock.advance(2000);
    expect(texts(core)).toEqual([]);
  });

  it('a per-message durationMs overrides the setting', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'notify', text: 'x', durationMs: 500 });
    clock.advance(500);
    expect(texts(core)).toEqual([]);
  });

  it('ignores blank text and invalid durations fall back to the setting', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'notify', text: '   ' });
    expect(texts(core)).toEqual([]);
    core.dispatch({ type: 'notify', text: 'x', durationMs: -5 });
    clock.advance(DEFAULT_NOTIFICATION_MS - 1);
    expect(texts(core)).toEqual(['x']);
  });

  it('clamps the setting to a sane range', () => {
    const { core } = setup();
    core.dispatch({ type: 'setNotificationDuration', ms: 0 });
    expect(core.getState().notificationDurationMs).toBe(1000);
    core.dispatch({ type: 'setNotificationDuration', ms: 10 ** 9 });
    expect(core.getState().notificationDurationMs).toBe(60000);
  });

  it('stacks several, newest first, each with its own timer', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'notify', text: 'first' });
    clock.advance(3000);
    core.dispatch({ type: 'notify', text: 'second' });
    expect(texts(core)).toEqual(['second', 'first']);
    clock.advance(5000);
    expect(texts(core)).toEqual(['second']);
    clock.advance(3000);
    expect(texts(core)).toEqual([]);
  });

  it('keeps at most 5, dropping the oldest', () => {
    const { core } = setup();
    for (let i = 1; i <= 7; i++) core.dispatch({ type: 'notify', text: `n${i}` });
    expect(texts(core)).toEqual(['n7', 'n6', 'n5', 'n4', 'n3']);
  });

  it('dismiss removes the newest visible Notification', () => {
    const { core } = setup();
    core.dispatch({ type: 'notify', text: 'a' });
    core.dispatch({ type: 'notify', text: 'b' });
    core.dispatch({ type: 'dismissNotification' });
    expect(texts(core)).toEqual(['a']);
    core.dispatch({ type: 'dismissNotification' });
    core.dispatch({ type: 'dismissNotification' });
    expect(texts(core)).toEqual([]);
  });

  it('dismiss skips Notifications that already expired', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'notify', text: 'old' });
    core.dispatch({ type: 'notify', text: 'short', durationMs: 100 });
    clock.advance(200);
    core.dispatch({ type: 'dismissNotification' });
    expect(texts(core)).toEqual([]);
  });

  it('can dismiss a specific Notification by id', () => {
    const { core } = setup();
    core.dispatch({ type: 'notify', text: 'a' });
    core.dispatch({ type: 'notify', text: 'b' });
    const a = core.getState().notifications[1];
    core.dispatch({ type: 'dismissNotification', id: a.id });
    expect(texts(core)).toEqual(['b']);
  });

  it('notifies subscribers', () => {
    const { core } = setup();
    let last: string[] = [];
    core.subscribe((s) => (last = s.notifications.map((n) => n.text)));
    core.dispatch({ type: 'notify', text: 'ping' });
    expect(last).toEqual(['ping']);
  });

  it('never appears in Output-facing state', () => {
    const { core } = setup();
    core.dispatch({ type: 'notify', text: 'secret cue' });
    const out = outputState(core.getState());
    expect(JSON.stringify(out)).not.toContain('secret cue');
    expect(out).not.toHaveProperty('notifications');
    expect(out).not.toHaveProperty('notificationDurationMs');
    expect(out.script).toBeDefined();
  });

  it('persists the display time but not Notifications across restarts', () => {
    const { clock, sessionStore, core } = setup();
    core.dispatch({ type: 'setNotificationDuration', ms: 3000 });
    core.dispatch({ type: 'notify', text: 'x' });
    const again = createCore({ clock, sessionStore });
    expect(again.getState().notificationDurationMs).toBe(3000);
    expect(again.getState().notifications).toEqual([]);
  });
});
