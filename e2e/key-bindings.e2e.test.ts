// Key bindings in the running app: a saved table is read at startup, a real key press runs its
// action in Run mode, and the same key does nothing in Edit mode.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();

let app: ElectronApplication;
let operator: Page;
let userData: string;

async function windowTitled(part: string): Promise<Page> {
  for (let i = 0; i < 100; i++) {
    for (const w of app.windows()) if ((await w.title()).includes(part)) return w;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No window titled "${part}"`);
}

const key = (code: string) => ({ code, shift: false, ctrl: false, alt: false, meta: false });

beforeAll(async () => {
  mkdirSync(join(root, 'e2e', 'artifacts'), { recursive: true });
  userData = mkdtempSync(join(tmpdir(), 'neoprompter-e2e-'));
  writeFileSync(
    join(userData, 'output-settings.json'),
    JSON.stringify({ windowed: true, monitorBySetup: {} }),
  );
  // Play / Pause moved from Space to F5; every other action keeps its default keys.
  writeFileSync(join(userData, 'key-bindings.json'), JSON.stringify({ playPause: [key('F5')] }));
  app = await electron.launch({
    args: [root],
    env: {
      ...process.env,
      NEOPROMPTER_USER_DATA: userData,
      NEOPROMPTER_NO_UPDATE_CHECK: '1',
      NEOPROMPTER_NO_AUTO_WINDOWED: '1',
    },
  });
  operator = await windowTitled('Operator view');
});

afterAll(async () => {
  await app?.close();
  rmSync(userData, { recursive: true, force: true });
});

const state = () =>
  operator.evaluate(async () => {
    const s = await (window as any).neoprompter.getState();
    return { playing: s.playing as boolean, speedLevel: s.speedLevel as number };
  });
const setMode = (mode: 'edit' | 'run') =>
  operator.evaluate(
    (m) => (window as any).neoprompter.dispatch({ type: 'setMode', mode: m }),
    mode,
  );
const settle = () => new Promise((r) => setTimeout(r, 300));

describe('Key bindings in the running app', () => {
  it('runs a bound key in Run mode, and not the key that was moved away', async () => {
    await setMode('run');
    await settle();
    await operator.bringToFront();
    await operator.keyboard.press('Space');
    await settle();
    expect((await state()).playing).toBe(false);
    await operator.keyboard.press('F5');
    await settle();
    expect((await state()).playing).toBe(true);
    await operator.keyboard.press('F5');
    await settle();
    expect((await state()).playing).toBe(false);
  });

  it('still runs the default keys of the other actions', async () => {
    const before = (await state()).speedLevel;
    await operator.keyboard.press('ArrowUp');
    await settle();
    expect((await state()).speedLevel).toBeGreaterThan(before);
  });

  it('does nothing in Edit mode', async () => {
    await setMode('edit');
    await settle();
    await operator.keyboard.press('F5');
    await settle();
    expect((await state()).playing).toBe(false);
  });
});
