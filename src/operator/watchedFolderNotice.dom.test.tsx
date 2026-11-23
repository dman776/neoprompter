// @vitest-environment jsdom
// Renderer seam: what the Operator view says about an automatic Import of the Watched folder.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCore, createFakeClock, createMemoryLibraryStorage } from '../core';
import { App } from './App';
import { createFakeBridge } from './fakeBridge';
import type { ImportOutcome } from './useCoreState';

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

async function mount(held: ImportOutcome | null = null) {
  const core = createCore({
    clock: createFakeClock(),
    libraryStorage: createMemoryLibraryStorage(),
  });
  let push: (o: ImportOutcome) => void = () => {};
  const { bridge } = createFakeBridge(core, {
    onWatchedFolderNotice: (l) => (push = l),
    takeWatchedFolderNotice: async () => held,
  });
  root = createRoot(host);
  await act(async () => root.render(<App bridge={bridge} />));
  return { push: (o: ImportOutcome) => act(async () => push(o)) };
}

const notice = () => host.querySelector<HTMLElement>('[data-testid="notice"]');

describe('Watched folder notices', () => {
  it('shows nothing until something is Imported', async () => {
    await mount();
    expect(notice()).toBeNull();
  });

  it('shows what an automatic Import did', async () => {
    const { push } = await mount();
    await push({ ok: true, message: 'Imported "Sunday" from the Watched folder.' });
    expect(notice()!.textContent).toContain('Imported "Sunday" from the Watched folder.');
    expect(notice()!.dataset.ok).toBe('true');
  });

  it('shows a failed file as a warning', async () => {
    const { push } = await mount();
    await push({ ok: false, message: '"Bad.doc" is password-protected.' });
    expect(notice()!.getAttribute('role')).toBe('alert');
    expect(notice()!.textContent).toContain('"Bad.doc" is password-protected.');
  });

  it('shows an Import that happened before the view opened', async () => {
    await mount({ ok: true, message: 'Imported "Sunday" from the Watched folder.' });
    expect(notice()!.textContent).toContain('Imported "Sunday"');
  });
});
