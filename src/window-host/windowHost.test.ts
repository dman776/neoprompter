import { describe, expect, it } from 'vitest';
import { createWindowHost, type HostWindow, type WindowKind } from './index';

function setup() {
  const created: FakeWindow[] = [];
  class FakeWindow implements HostWindow {
    focused = 0;
    private listeners: (() => void)[] = [];
    constructor(readonly kind: WindowKind) {}
    focus() {
      this.focused++;
    }
    onClosed(listener: () => void) {
      this.listeners.push(listener);
    }
    close() {
      this.listeners.forEach((l) => l());
    }
  }
  const host = createWindowHost({
    create: (kind) => {
      const w = new FakeWindow(kind);
      created.push(w);
      return w;
    },
  });
  return { host, created };
}

describe('window host', () => {
  it('opens nothing at launch, so the Virtual shuttle is closed', () => {
    const { host, created } = setup();
    expect(created).toHaveLength(0);
    expect(host.isOpen('shuttle')).toBe(false);
    expect(host.isOpen('preferences')).toBe(false);
  });

  it('opens one window per kind', () => {
    const { host, created } = setup();
    host.open('shuttle');
    host.open('preferences');
    expect(created.map((w) => w.kind)).toEqual(['shuttle', 'preferences']);
    expect(host.isOpen('shuttle')).toBe(true);
  });

  it('focuses the existing window on a second request', () => {
    const { host, created } = setup();
    host.open('shuttle');
    host.open('shuttle');
    expect(created).toHaveLength(1);
    expect(created[0].focused).toBe(1);
  });

  it('opens a new window after the old one was closed', () => {
    const { host, created } = setup();
    host.open('preferences');
    created[0].close();
    expect(host.isOpen('preferences')).toBe(false);
    host.open('preferences');
    expect(created).toHaveLength(2);
  });
});
