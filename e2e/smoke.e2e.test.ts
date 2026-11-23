// Smoke test: launches the real built app (run `npm run build` first; `npm run test:e2e` does),
// with a throwaway data directory and the Windowed Output, and checks what the Operator and the
// Talent would actually see. Screenshots land in e2e/artifacts/ for a human or agent to look at.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

const outputWindows = async () =>
  (await Promise.all(app.windows().map((w) => w.title()))).filter((t) => t.includes('Output'))
    .length;

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
  // The Output starts Off: no Output window until the Operator switches it On.
  expect((await state()).outputOn).toBe(false);
  expect(await outputWindows()).toBe(0);
  await operator.getByRole('switch', { name: 'Output' }).click();
  output = await windowTitled('Output');
  await dispatch({
    type: 'saveScript',
    name: 'Smoke',
    text: ['First line', LONG, 'Closing line'].join('\n'),
  });
  const id = (await state()).library.find((e: { name: string }) => e.name === 'Smoke').id;
  await dispatch({ type: 'loadScript', id });
});

afterAll(async () => {
  await app?.close();
  rmSync(userData, { recursive: true, force: true });
});

describe('the running app', () => {
  it('opens the Virtual shuttle as its own single window from the Window menu', async () => {
    const titles = async () =>
      (await Promise.all(app.windows().map((w) => w.title()))).filter((t) =>
        t.includes('Virtual shuttle'),
      );
    expect(await titles()).toHaveLength(0);
    const choose = () =>
      app.evaluate(({ Menu }) => {
        Menu.getApplicationMenu()!
          .items.find((i) => i.label === 'Window')!
          .submenu!.items.find((i) => i.label === 'Virtual shuttle')!
          .click();
      });
    await choose();
    const shuttle = await windowTitled('Virtual shuttle');
    await shuttle.screenshot({ path: join(artifacts, 'virtual-shuttle.png') });
    await choose();
    expect(await titles()).toHaveLength(1);

    // Its buttons, ring and jog wheel drive the real core through the main-process mapper.
    await shuttle.getByRole('button', { name: /^Button 1,/ }).click();
    await vi.waitFor(async () => expect((await state()).playing).toBe(true));
    await shuttle.getByRole('button', { name: /^Button 1,/ }).click();
    await vi.waitFor(async () => expect((await state()).playing).toBe(false));
    const speedBefore = (await state()).speedLevel;
    const jog = (await shuttle.getByTestId('jog').boundingBox())!;
    const cx = jog.x + jog.width / 2;
    const cy = jog.y + jog.height / 2;
    await shuttle.mouse.move(cx, cy - 40);
    await shuttle.mouse.down();
    await shuttle.mouse.move(cx + 20, cy - 35, { steps: 4 });
    await shuttle.mouse.up();
    await vi.waitFor(async () => expect((await state()).speedLevel).toBeGreaterThan(speedBefore));
    expect(Number.isInteger((await state()).speedLevel * 4)).toBe(false);
    const ring = (await shuttle.getByTestId('ring').boundingBox())!;
    await shuttle.mouse.move(ring.x + ring.width / 2, ring.y + 12);
    await shuttle.mouse.down();
    await shuttle.mouse.move(ring.x + ring.width / 2 + 60, ring.y + 30, { steps: 4 });
    await vi.waitFor(async () => expect((await state()).ringDeflection).toBeGreaterThan(0));
    await shuttle.screenshot({ path: join(artifacts, 'virtual-shuttle-active.png') });
    await shuttle.mouse.up();
    await vi.waitFor(async () => expect((await state()).ringDeflection).toBe(0));
    await dispatch({ type: 'setSpeed', level: speedBefore });
    await shuttle.close();
  });

  it('opens Preferences as its own window and applies an Appearance change at once', async () => {
    const choose = () =>
      app.evaluate(({ Menu }) => {
        Menu.getApplicationMenu()!
          .items.find((i) => i.label === 'File')!
          .submenu!.items.find((i) => i.label === 'Preferences')!
          .click();
      });
    await choose();
    const prefs = await windowTitled('Preferences');
    await choose();
    expect(
      (await Promise.all(app.windows().map((w) => w.title()))).filter((t) =>
        t.includes('Preferences'),
      ),
    ).toHaveLength(1);
    await prefs.getByRole('button', { name: 'Appearance' }).click();
    await prefs.screenshot({ path: join(artifacts, 'preferences-appearance.png') });
    const before = (await state()).appearance.fontSize;
    await prefs.getByLabel('Font size').fill(String(before + 20));
    await expect.poll(async () => (await state()).appearance.fontSize).toBe(before + 20);
    await dispatch({ type: 'setAppearance', changes: { fontSize: before } });

    await prefs.getByRole('button', { name: 'General' }).click();
    await prefs.screenshot({ path: join(artifacts, 'preferences-general.png') });
    await prefs.getByLabel('Theme').selectOption('light');
    await expect.poll(async () => (await state()).theme).toBe('light');
    await prefs.screenshot({ path: join(artifacts, 'preferences-general-light.png') });
    await prefs.getByLabel('Theme').selectOption('dark');
    await expect.poll(async () => (await state()).theme).toBe('dark');

    await prefs.getByRole('button', { name: 'Output' }).click();
    await expect
      .poll(() => prefs.getByLabel('Windowed Output').getAttribute('aria-checked'))
      .toBe('true');
    await prefs.screenshot({ path: join(artifacts, 'preferences-output.png') });

    await prefs.getByRole('button', { name: 'Notifications' }).click();
    await prefs.getByLabel('Notification time').fill('20');
    await expect.poll(async () => (await state()).notificationDurationMs).toBe(20000);
    await expect.poll(() => prefs.locator('.pf-value').textContent()).toBe('20 s');
    await prefs.screenshot({ path: join(artifacts, 'preferences-notifications.png') });
    await dispatch({ type: 'setNotificationDuration', ms: 8000 });

    // Controls: a remap is saved by the main process, which every window reads.
    const mapping = () =>
      operator.evaluate(() => (window as any).neoprompter.getButtonMapping()) as Promise<{
        mapping: Record<string, string>;
      }>;
    await prefs.getByRole('button', { name: 'Controls' }).click();
    await prefs.getByLabel('Button 5').waitFor();
    await prefs.screenshot({ path: join(artifacts, 'preferences-controls.png') });
    await prefs.getByLabel('Button 4').selectOption('returnToPlayStart');
    await expect.poll(async () => (await mapping()).mapping['4']).toBe('returnToPlayStart');
    await prefs.getByLabel('Button 4').selectOption('none');
    await expect.poll(async () => (await mapping()).mapping['4']).toBe('none');

    // Network: a Quick message added here is on the Producer page's list.
    await prefs.getByRole('button', { name: 'Network' }).click();
    await expect.poll(() => prefs.locator('.pf-address code').count()).toBeGreaterThan(0);
    await prefs.getByLabel('New Quick message').fill('Eyes up');
    await prefs.getByRole('button', { name: 'Add', exact: true }).click();
    const quick = async () =>
      (await operator.evaluate(() => (window as any).neoprompter.getQuickMessages())) as string[];
    await expect.poll(quick).toContain('Eyes up');
    await prefs.locator('main').evaluate((el) => (el.scrollTop = 0));
    await prefs.screenshot({ path: join(artifacts, 'preferences-network.png') });
    await prefs.getByLabel('Remove Quick message 6').click();
    await expect.poll(quick).not.toContain('Eyes up');
    await prefs.close();
  });

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

  it('switches the Operator view between Edit mode and Run mode', async () => {
    await operator.getByRole('radio', { name: 'Run' }).click();
    await expect.poll(async () => (await state()).mode).toBe('run');
    await expect.poll(() => operator.locator('main').getAttribute('data-mode')).toBe('run');
    await operator.screenshot({ path: join(artifacts, 'operator-run.png') });
    await operator.getByRole('radio', { name: 'Edit' }).click();
    await expect.poll(() => operator.locator('main').getAttribute('data-mode')).toBe('edit');
  });

  it('shows the Output in the Run mode Live view and drives the transport', async () => {
    await dispatch({ type: 'scrollBy', lines: -10_000 });
    await operator.getByRole('radio', { name: 'Run' }).click();
    const live = operator.locator('[data-testid="live-view"]');
    await expect
      .poll(() => live.locator('[data-live="text"] > div').allTextContents())
      .toEqual(await outputLines());
    // The same picture: the Live view's text sits where the Output's does, scaled.
    const shift = (page: Page, sel: string) =>
      page.evaluate((s) => document.querySelector<HTMLElement>(s)!.style.transform, sel);
    await expect
      .poll(() => shift(operator, '[data-live="text"]'))
      .toBe(await shift(output, '#text'));
    await operator.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(async () => (await state()).playing).toBe(true);
    await expect
      .poll(() => operator.locator('[data-testid="position"]').textContent())
      .not.toBe('0%');
    await operator.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect.poll(async () => (await state()).playing).toBe(false);
    await operator.getByRole('button', { name: 'Play start' }).click();
    await expect.poll(async () => (await state()).progress).toBe(0);
    await operator.screenshot({ path: join(artifacts, 'operator-run-live.png') });
    // Speed: arrow keys nudge it, dragging the dial sets it, the readout follows.
    await dispatch({ type: 'setSpeed', level: 3 });
    await operator.keyboard.press('ArrowUp');
    await expect.poll(async () => (await state()).speedLevel).toBe(3.1);
    await operator.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => (await state()).speedLevel).toBe(2.6);
    const dial = await operator.locator('[role="slider"]').boundingBox();
    await operator.mouse.move(dial!.x + dial!.width / 2, dial!.y + dial!.height / 2);
    await operator.mouse.down();
    await operator.mouse.move(dial!.x + dial!.width / 2, dial!.y + dial!.height / 2 - 28);
    await operator.mouse.up();
    await expect.poll(async () => (await state()).speedLevel).toBeCloseTo(4.6, 1);
    await expect
      .poll(() => operator.locator('[data-testid="speed-readout"]').textContent())
      .toBe((await state()).speed.toFixed(2));
    await operator.screenshot({ path: join(artifacts, 'operator-run-speed.png') });
    await operator.getByRole('radio', { name: 'Edit' }).click();
  });

  it('collapses the right column and switches the theme, and the Live view fills the width', async () => {
    const liveWidth = () =>
      operator.evaluate(
        // The box the Live view fits itself into (the picture is also limited by height).
        () => document.querySelector<HTMLElement>('.live-fit')!.offsetWidth,
      );
    const theme = () => operator.evaluate(() => document.documentElement.dataset.theme);
    const sideCount = () => operator.locator('.run-side').count();
    await operator.getByRole('radio', { name: 'Run' }).click();
    await expect.poll(sideCount).toBe(1);
    const open = await liveWidth();

    await operator.getByTestId('toggle-theme').click();
    await expect.poll(theme).toBe('light');
    await expect.poll(async () => (await state()).theme).toBe('light');
    await new Promise((r) => setTimeout(r, 300)); // let the Live view rescale before the picture
    await operator.screenshot({ path: join(artifacts, 'operator-run-light.png') });
    await operator.getByTestId('toggle-column').click();
    await expect.poll(sideCount).toBe(0);
    await expect.poll(liveWidth).toBeGreaterThan(open);
    await operator.screenshot({ path: join(artifacts, 'operator-run-light-collapsed.png') });

    // The collapsed state survives a mode change.
    await operator.getByRole('radio', { name: 'Edit' }).click();
    await expect.poll(() => operator.locator('main').getAttribute('data-mode')).toBe('edit');
    expect((await state()).rightColumnCollapsed).toBe(true);
    await operator.getByRole('radio', { name: 'Run' }).click();
    await expect.poll(sideCount).toBe(0);

    await operator.getByTestId('toggle-theme').click();
    await expect.poll(theme).toBe('dark');
    await operator.screenshot({ path: join(artifacts, 'operator-run-collapsed.png') });
    await operator.getByTestId('toggle-column').click();
    await expect.poll(sideCount).toBe(1);
    await new Promise((r) => setTimeout(r, 300));
    await operator.screenshot({ path: join(artifacts, 'operator-run-dark.png') });
    await operator.getByRole('radio', { name: 'Edit' }).click();
  });

  it('blocks typing in Run mode, and unlocks for a one-paragraph live fix', async () => {
    await operator.getByRole('radio', { name: 'Run' }).click();
    await expect.poll(() => operator.locator('main').getAttribute('data-mode')).toBe('run');
    const before = (await state()).script.lines;
    // No surface can edit while locked: not a command from here, nor the editor (it is not shown).
    await dispatch({ type: 'editLine', line: 0, text: 'typed while locked' });
    await dispatch({ type: 'setScriptLines', lines: ['typed while locked'] });
    expect((await state()).script.lines).toEqual(before);
    expect(await operator.locator('.ProseMirror').count()).toBe(0);
    await operator.screenshot({ path: join(artifacts, 'operator-run-locked.png') });

    const lock = operator.locator('[data-slot="script-lock"]').getByRole('switch');
    await lock.click();
    await expect.poll(async () => (await state()).unlocked).toBe(true);
    const position = (await state()).position;
    const first = operator.locator('[data-testid="live-view"] [data-live="text"] > div').first();
    await first.dblclick();
    const box = operator.getByRole('textbox', { name: 'Fix this paragraph' });
    await box.fill('Fixed live');
    await operator.screenshot({ path: join(artifacts, 'operator-run-live-fix.png') });
    await box.press('Enter');
    await expect.poll(async () => (await outputLines())[0]).toBe('Fixed live');
    await expect.poll(() => first.textContent()).toBe('Fixed live');
    expect((await state()).position).toBe(position);

    await operator.getByRole('radio', { name: 'Edit' }).click();
    await expect.poll(async () => (await state()).unlocked).toBe(false);
    await dispatch({ type: 'editLine', line: 0, text: before[0] as string });
    await expect.poll(async () => (await outputLines())[0]).toBe(before[0]);
  });

  it('switches the Output Off and On from the lamp, keeping the reading position', async () => {
    const before = (await state()).position;
    const lamp = operator.getByRole('switch', { name: 'Output' });
    await operator.screenshot({ path: join(artifacts, 'operator-output-on.png') });
    await lamp.click();
    await expect.poll(outputWindows).toBe(0);
    expect((await state()).position).toBe(before);
    await operator.screenshot({ path: join(artifacts, 'operator-output-off.png') });
    await lamp.click();
    await expect.poll(outputWindows).toBe(1);
    output = await windowTitled('Output');
    await expect.poll(async () => (await outputLines()).length).toBe(3);
  });

  it('shows a Notification over the content without moving anything, and dismisses it', async () => {
    const rects = () =>
      operator.evaluate(() =>
        ['header', 'main', 'footer'].map((tag) => {
          const r = document.querySelector(tag)!.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height];
        }),
      );
    for (const mode of ['edit', 'run'] as const) {
      await dispatch({ type: 'setMode', mode });
      await expect.poll(() => operator.locator('main').getAttribute('data-mode')).toBe(mode);
      const before = await rects();
      await dispatch({ type: 'notify', text: 'Wrap up in two minutes', durationMs: 60_000 });
      await dispatch({ type: 'notify', text: 'Second message', durationMs: 60_000 });
      await expect.poll(() => operator.locator('.notification').count()).toBe(2);
      expect(await rects()).toEqual(before);
      await new Promise((r) => setTimeout(r, 400)); // let the slide-in finish before the picture
      await operator.screenshot({ path: join(artifacts, `operator-notification-${mode}.png`) });
      // Nothing reaches the Output.
      expect(await output.evaluate(() => document.body.innerText)).not.toContain('Wrap up');
      await operator.getByRole('button', { name: 'Dismiss' }).first().click();
      await expect.poll(() => operator.locator('.notification').count()).toBe(1);
      expect(await rects()).toEqual(before);
      await operator.getByRole('button', { name: 'Dismiss' }).click();
      await expect.poll(() => operator.locator('.notification').count()).toBe(0);
    }
    await dispatch({ type: 'setMode', mode: 'edit' });
  });

  it('shows the mini Live view and the Script library in Edit mode', async () => {
    const original = (await state()).script;
    await dispatch({ type: 'setMode', mode: 'edit' });
    await dispatch({ type: 'saveScript', name: 'Sunday service', text: 'Welcome\nPrayer' });
    await dispatch({ type: 'saveScript', name: 'Wedding', text: 'Dearly beloved' });
    const cards = operator.locator('[data-testid="library"] .lib-card');
    const sunday = cards.filter({ hasText: 'Sunday service' });
    await expect.poll(() => sunday.count()).toBe(1);
    expect(await sunday.locator('small').textContent()).toContain('Edited');

    // Loading from the library puts that Script in the editor and the mini Live view.
    await sunday.click();
    const mini = operator.locator('[data-testid="live-view"] [data-live="text"] > div');
    await expect.poll(() => mini.allTextContents()).toEqual(['Welcome', 'Prayer']);
    // The mini Live view follows typing in the editor.
    await operator.locator('.ProseMirror p').first().click();
    await operator.keyboard.press('End');
    await operator.keyboard.type(' amen');
    await expect.poll(() => mini.first().textContent()).toBe('Welcome amen');

    await operator.getByTestId('toggle-theme').click();
    await new Promise((r) => setTimeout(r, 300));
    await operator.screenshot({ path: join(artifacts, 'operator-edit-light.png') });
    await operator.getByTestId('toggle-theme').click();
    await new Promise((r) => setTimeout(r, 300));
    await operator.screenshot({ path: join(artifacts, 'operator-edit-dark.png') });

    // Collapsing hides the column; the state is the one Run mode uses.
    await operator.getByTestId('toggle-column').click();
    await expect.poll(() => operator.locator('[data-testid="edit-side"]').count()).toBe(0);
    expect((await state()).rightColumnCollapsed).toBe(true);
    await operator.screenshot({ path: join(artifacts, 'operator-edit-collapsed.png') });
    await operator.getByTestId('toggle-column').click();
    await expect.poll(() => operator.locator('[data-testid="edit-side"]').count()).toBe(1);

    // Put the Output back as the later tests expect it.
    for (const s of (await state()).library) {
      if (['Sunday service', 'Wedding'].includes(s.name)) {
        await dispatch({ type: 'deleteScript', id: s.id });
      }
    }
    await dispatch({ type: 'setScriptLines', lines: original.lines });
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
