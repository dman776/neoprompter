// Smoke test: launches the real built app (run `npm run build` first; `npm run test:e2e` does),
// with a throwaway data directory and the Windowed Output, and checks what the Operator and the
// Talent would actually see. Screenshots land in e2e/artifacts/ for a human or agent to look at.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const artifacts = join(root, 'e2e', 'artifacts');
const LONG = 'This is a long paragraph that will wrap over several visual lines. '.repeat(8).trim();

let app: ElectronApplication;
let operator: Page;
let output: Page;
let userData: string;

async function windowTitled(part: string): Promise<Page> {
  for (let i = 0; i < 100; i++) {
    for (const w of app.windows()) if ((await w.title()).includes(part)) return w;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No window titled "${part}"`);
}

/** Runs a core command from the Operator view, exactly as its buttons do. */
const dispatch = (command: object) =>
  operator.evaluate((c) => (window as any).neoprompter.dispatch(c), command);
const state = () => operator.evaluate(() => (window as any).neoprompter.getState());
const outputLines = () =>
  output.evaluate(() =>
    Array.from(document.querySelectorAll('#text > div'), (el) => el.textContent?.trim()),
  );

beforeAll(async () => {
  mkdirSync(artifacts, { recursive: true });
  userData = mkdtempSync(join(tmpdir(), 'neoprompter-e2e-'));
  writeFileSync(
    join(userData, 'output-settings.json'),
    JSON.stringify({ windowed: true, monitorBySetup: {} }),
  );
  app = await electron.launch({
    args: [root],
    env: { ...process.env, NEOPROMPTER_USER_DATA: userData },
  });
  operator = await windowTitled('Operator view');
  output = await windowTitled('Output');
  await dispatch({ type: 'confirmOutput' });
  await dispatch({
    type: 'saveScript',
    name: 'Smoke',
    text: ['First line', LONG, 'Closing line'].join('\n'),
  });
  const id = (await state()).library.find((e: { name: string }) => e.name === 'Smoke').id;
  await dispatch({ type: 'loadScript', id });
  await dispatch({ type: 'confirmOutput' });
});

afterAll(async () => {
  await app?.close();
  rmSync(userData, { recursive: true, force: true });
});

describe('the running app', () => {
  it('shows the loaded Script on the Output', async () => {
    await expect.poll(outputLines).toEqual(['First line', LONG, 'Closing line']);
    await output.screenshot({ path: join(artifacts, 'output-loaded.png') });
  });

  it('shows a live edit on the Output right away', async () => {
    await dispatch({ type: 'editLine', line: 0, text: 'First line, edited' });
    await expect.poll(async () => (await outputLines())[0]).toBe('First line, edited');
  });

  it('counts a wrapped paragraph as several visual lines', async () => {
    const heights = await output.evaluate(() => {
      const lineHeight = parseFloat(getComputedStyle(document.getElementById('text')!).lineHeight);
      return Array.from(document.querySelectorAll('#text > div'), (el) =>
        Math.round((el as HTMLElement).offsetHeight / lineHeight),
      );
    });
    expect(heights[1]).toBeGreaterThan(1);
  });

  it('can scroll to the very end so the last line is fully on screen', async () => {
    await dispatch({ type: 'scrollBy', lines: 10_000 });
    await expect
      .poll(async () =>
        output.evaluate(() => {
          const last = document.querySelector('#text > div:last-child')!.getBoundingClientRect();
          return last.top >= 0 && last.bottom <= window.innerHeight + 1;
        }),
      )
      .toBe(true);
    // The Progress bar agrees: at the end of the Script it is full.
    await expect.poll(async () => (await state()).progress).toBeGreaterThan(0.99);
    await output.screenshot({ path: join(artifacts, 'output-end.png') });
  });

  it('keeps the Operator view visible and usable', async () => {
    await operator.screenshot({ path: join(artifacts, 'operator.png') });
    expect(await operator.title()).toContain('Operator view');
  });
});
