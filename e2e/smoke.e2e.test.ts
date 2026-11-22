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

  describe('the Producer page with a token set', () => {
    const port = 47811;
    const TOKEN = 'e2e-token';

    /** Opens the page in a second Chromium window that answers the browser's password prompt. */
    const openAs = (password: string | null) =>
      app.evaluate(
        async ({ BrowserWindow }, { port, password }) => {
          const win = new BrowserWindow({ show: false });
          // A different phone has no cached login: forget any earlier window's credentials.
          await win.webContents.session.clearAuthCache();
          let answered = false;
          win.webContents.on('login', (event, _request, _authInfo, callback) => {
            event.preventDefault();
            // Answer the prompt once; if it comes back (wrong token), the person gives up.
            if (password === null || answered) callback();
            else {
              answered = true;
              callback('', password);
            }
          });
          await win.loadURL(`http://127.0.0.1:${port}/`);
          // Give the page's own requests (the quick-message list) time to finish.
          for (let i = 0; i < 50; i++) {
            const buttons = await win.webContents.executeJavaScript(
              "document.querySelectorAll('#quick button').length",
            );
            if (buttons > 0) break;
            await new Promise((r) => setTimeout(r, 100));
          }
          const result = await win.webContents.executeJavaScript(
            "({ buttons: document.querySelectorAll('#quick button').length, text: document.body.innerText.slice(0, 200) })",
          );
          win.destroy();
          return result as { buttons: number; text: string };
        },
        { port, password },
      );

    beforeAll(async () => {
      await operator.evaluate((s) => (window as any).neoprompter.setApiSettings(s), {
        port,
        token: TOKEN,
      });
      // The server restarts on the new port; wait until it answers.
      for (let i = 0; i < 50; i++) {
        const status = await fetch(`http://127.0.0.1:${port}/api/status`).then(
          (r) => r.status,
          () => 0,
        );
        if (status === 401) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('The API did not restart on the new port');
    });

    it('shows the page, with its quick-message buttons, once the browser sends the token', async () => {
      const page = await openAs(TOKEN);
      expect(page.buttons).toBeGreaterThan(0);
    });

    it('does not show the page when the browser has no token to give', async () => {
      const page = await openAs(null);
      expect(page.buttons).toBe(0);
      expect(page.text).toContain('Missing or wrong token');
    });

    it('does not show the page for the wrong token', async () => {
      const page = await openAs('not-the-token');
      expect(page.buttons).toBe(0);
      expect(page.text).toContain('Missing or wrong token');
    });
  });
});
