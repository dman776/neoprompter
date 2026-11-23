// @vitest-environment jsdom
// Renderer seam: the Update notice shows in Edit mode only, and its two actions reach the main process.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCore, createFakeClock, createMemoryLibraryStorage } from '../core';
import { App } from './App';
import type { UpdateView } from '../updates';
import { createFakeBridge, quietUpdateView } from './fakeBridge';

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

const offered: UpdateView = {
  ...quietUpdateView,
  current: '0.2.0',
  available: {
    version: '0.3.0',
    url: 'https://github.com/dman776/neoprompter/releases/tag/v0.3.0',
  },
};

async function mount(view = offered) {
  const core = createCore({
    clock: createFakeClock(),
    libraryStorage: createMemoryLibraryStorage(),
  });
  const openUpdatePage = vi.fn();
  const skipUpdate = vi.fn(async () => quietUpdateView);
  const { bridge } = createFakeBridge(core, {
    getUpdateView: async () => view,
    openUpdatePage,
    skipUpdate,
  });
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  return { core, openUpdatePage, skipUpdate };
}

const notice = () => host.querySelector<HTMLElement>('[data-testid="update-notice"]');
const click = (label: string) =>
  act(async () =>
    [...notice()!.querySelectorAll('button')]
      .find((b) => b.textContent?.includes(label) || b.getAttribute('aria-label') === label)!
      .dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );

describe('Update notice', () => {
  it('says a newer version is available, in Edit mode', async () => {
    await mount();
    expect(notice()!.textContent).toContain('Update 0.3.0 available');
    expect(notice()!.closest('header')).not.toBeNull();
  });

  it('shows nothing when there is nothing to offer', async () => {
    await mount(quietUpdateView);
    expect(notice()).toBeNull();
  });

  it('never shows in Run mode', async () => {
    const { core } = await mount();
    await act(async () => core.dispatch({ type: 'setMode', mode: 'run' }));
    expect(notice()).toBeNull();
  });

  it('opens the release page and skips the version', async () => {
    const { openUpdatePage, skipUpdate } = await mount();
    await click('Update 0.3.0');
    expect(openUpdatePage).toHaveBeenCalled();
    await click('Skip this version');
    expect(skipUpdate).toHaveBeenCalled();
  });
});
