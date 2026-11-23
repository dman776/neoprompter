// Closing the windowed Output by hand must not break the app: state keeps being broadcast to the
// windows that are left, and nothing in the main process throws.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

beforeAll(async () => {
  userData = mkdtempSync(join(tmpdir(), 'neoprompter-e2e-'));
  writeFileSync(
    join(userData, 'output-settings.json'),
    JSON.stringify({ windowed: true, monitorBySetup: {} }),
  );
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
  // Any error the main process does not catch lands here instead of in a dialog.
  await app.evaluate(() => {
    const g = globalThis as { __uncaught?: string[] };
    g.__uncaught = [];
    process.on('uncaughtException', (e) => g.__uncaught!.push(String(e)));
  });
});

afterAll(async () => {
  await app?.close();
  rmSync(userData, { recursive: true, force: true });
});

const uncaught = () =>
  app.evaluate(() => (globalThis as { __uncaught?: string[] }).__uncaught ?? []);

describe('closing the windowed Output by hand', () => {
  it('throws nothing and keeps the Operator view updating', async () => {
    await app.evaluate(({ Menu }) => {
      Menu.getApplicationMenu()!
        .items.find((i) => i.label === 'Output')!
        .submenu!.items.find((i) => i.label === 'Output on')!
        .click();
    });
    const output = await windowTitled('Output');
    // Playing makes the main process broadcast on every tick, which is where it used to throw.
    await operator.evaluate(() => (window as any).neoprompter.dispatch({ type: 'play' }));
    await output.close();
    await new Promise((r) => setTimeout(r, 1500));
    expect(await uncaught()).toEqual([]);
    const before = await operator.evaluate(
      async () => (await (window as any).neoprompter.getState()).position,
    );
    await new Promise((r) => setTimeout(r, 700));
    const after = await operator.evaluate(
      async () => (await (window as any).neoprompter.getState()).position,
    );
    expect(after).toBeGreaterThan(before);
  });

  it('can be switched on again afterwards', async () => {
    const choose = () =>
      app.evaluate(({ Menu }) => {
        Menu.getApplicationMenu()!
          .items.find((i) => i.label === 'Output')!
          .submenu!.items.find((i) => i.label === 'Output on')!
          .click();
      });
    // The switch still says On after the window was closed by hand: Off, then On again.
    await choose();
    await choose();
    const output = await windowTitled('Output');
    expect(output.isClosed()).toBe(false);
    expect(await uncaught()).toEqual([]);
  });
});
