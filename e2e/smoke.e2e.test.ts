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
// Long enough to scroll on the 1920x1080 Output (about 16 visual lines high).
const LONG = 'This is a long paragraph that will wrap over several visual lines. '
  .repeat(20)
  .trim();

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
/** The Operator window has drawn the Play key as Pause (playing) or Play (stopped). */
const shows = async (key: 'Pause' | 'Play') =>
  operator.getByRole('button', { name: key, exact: true }).waitFor({ timeout: 5000 });
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
    await prefs.screenshot({ path: join(artifacts, 'preferences-network-connection.png') });
    await prefs.getByRole('tab', { name: 'Quick messages' }).click();
    await prefs.getByLabel('New Quick message').fill('Eyes up');
    await prefs.getByRole('button', { name: 'Add', exact: true }).click();
    const quick = async () =>
      (await operator.evaluate(() => (window as any).neoprompter.getQuickMessages())) as string[];
    await expect.poll(quick).toContain('Eyes up');
    await prefs.screenshot({ path: join(artifacts, 'preferences-network-quick-messages.png') });
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
          const stage = document.getElementById('stage')!.getBoundingClientRect();
          return last.top >= stage.top - 1 && last.bottom <= stage.bottom + 1;
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
    // Speed: arrow keys nudge it, pressing the meter on the left sets it, the readout follows.
    await dispatch({ type: 'setSpeed', level: 3 });
    await operator.keyboard.press('ArrowUp');
    await expect.poll(async () => (await state()).speedLevel).toBe(3.1);
    await operator.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => (await state()).speedLevel).toBe(2.6);
    expect(await operator.locator('[data-slot="speed-dial"], .speed-dial').count()).toBe(0);
    const meter = (await operator.locator('[role="slider"][aria-label="Speed"]').boundingBox())!;
    // Half way up the meter is half speed; the top is the fastest.
    await operator.mouse.click(meter.x + meter.width / 2, meter.y + meter.height / 2);
    await expect.poll(async () => (await state()).speedLevel).toBeCloseTo(5, 0);
    await operator.mouse.click(meter.x + meter.width / 2, meter.y + 1);
    await expect.poll(async () => (await state()).speedLevel).toBeGreaterThan(9.5);
    await dispatch({ type: 'setSpeed', level: 4.6 });
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

  it('reports the mode and the Output state over the HTTP API status', async () => {
    const status = async () => (await fetch('http://127.0.0.1:4780/api/status')).json();
    expect(await status()).toMatchObject({ mode: (await state()).mode, outputOn: true });
    await operator.getByRole('switch', { name: 'Output' }).click();
    await expect.poll(async () => (await status()).outputOn).toBe(false);
    await operator.getByRole('switch', { name: 'Output' }).click();
    await expect.poll(async () => (await status()).outputOn).toBe(true);
    output = await windowTitled('Output');
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

  /** Clicks a native menu item by its label, as the Operator would. */
  const clickMenu = (label: string) =>
    app.evaluate(({ Menu }, label) => {
      const find = (items: Electron.MenuItem[]): Electron.MenuItem | undefined => {
        for (const item of items) {
          if (item.label === label && item.submenu === null) return item;
          const hit = item.submenu ? find(item.submenu.items) : undefined;
          if (hit) return hit;
        }
        return undefined;
      };
      find(Menu.getApplicationMenu()!.items)!.click();
    }, label);
  const menuItem = (id: string) =>
    app.evaluate(({ Menu }, id) => {
      const item = Menu.getApplicationMenu()!.getMenuItemById(id)!;
      return { enabled: item.enabled, checked: item.checked };
    }, id);

  it('has one Output menu item that follows the Output, Import only in Edit mode, and Undo that reaches the editor', async () => {
    const original = (await state()).script.lines;
    await dispatch({ type: 'setMode', mode: 'edit' });
    expect((await menuItem('import')).enabled).toBe(true);
    expect((await menuItem('output')).checked).toBe(true);
    await clickMenu('Output on');
    await expect.poll(async () => (await state()).outputOn).toBe(false);
    await expect.poll(async () => (await menuItem('output')).checked).toBe(false);
    await clickMenu('Output on');
    await expect.poll(async () => (await state()).outputOn).toBe(true);
    output = await windowTitled('Output');

    // Typing, then Edit > Undo from the native menu, takes the typing back out of the editor.
    await operator.bringToFront();
    await operator.locator('.ProseMirror p').first().click();
    await operator.keyboard.press('End');
    await operator.keyboard.type(' ZZZ');
    await expect.poll(() => operator.locator('.ProseMirror').textContent()).toContain('ZZZ');
    await clickMenu('Undo');
    await expect.poll(() => operator.locator('.ProseMirror').textContent()).not.toContain('ZZZ');
    await clickMenu('Redo');
    await expect.poll(() => operator.locator('.ProseMirror').textContent()).toContain('ZZZ');
    // Switching to Run mode at once keeps the typing (the editor saves it before the switch).
    await clickMenu('Run mode');
    await expect.poll(async () => (await state()).mode).toBe('run');
    expect((await state()).script.lines.map((l: unknown) => JSON.stringify(l)).join()).toContain(
      'ZZZ',
    );
    await expect.poll(async () => (await menuItem('import')).enabled).toBe(false);
    await dispatch({ type: 'setMode', mode: 'edit' });
    await expect.poll(async () => (await menuItem('import')).enabled).toBe(true);
    await dispatch({ type: 'setScriptLines', lines: original });
  });

  it('keeps the Run mode layout together at the minimum window size and in a small window', async () => {
    const resize = (width: number, height: number) =>
      app.evaluate(
        ({ BrowserWindow }, { width, height }) => {
          const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Operator'))!;
          win.setMinimumSize(0, 0);
          win.setSize(width, height);
        },
        { width, height },
      );
    const overlaps = () =>
      operator.evaluate(() => {
        const box = (sel: string) =>
          document.querySelector<HTMLElement>(sel)?.getBoundingClientRect();
        const center = box('.run-center');
        const side = box('.run-side');
        const transport = document.querySelector<HTMLElement>('[data-testid="transport"]')!;
        const problems: string[] = [];
        if (center && side && side.width > 0 && center.right > side.left + 1)
          problems.push('center over side');
        if (transport.scrollWidth > transport.clientWidth + 1) problems.push('transport too wide');
        const live = box('[data-testid="live-view"]');
        const bezel = box('.run-bezel');
        if (live && bezel && (live.right > bezel.right + 1 || live.bottom > bezel.bottom + 1)) {
          problems.push('live view outside bezel');
        }
        if (document.documentElement.scrollWidth > window.innerWidth + 1)
          problems.push('page scrolls sideways');
        return problems;
      });
    await dispatch({ type: 'setMode', mode: 'run' });
    await expect.poll(() => operator.locator('main').getAttribute('data-mode')).toBe('run');
    for (const [name, width, height] of [
      ['min', 1100, 640],
      ['small', 640, 480],
    ] as const) {
      await resize(width, height);
      await expect
        .poll(() => operator.evaluate(() => window.innerWidth))
        .toBeLessThanOrEqual(width);
      await new Promise((r) => setTimeout(r, 400));
      await operator.screenshot({ path: join(artifacts, `operator-run-${name}.png`) });
      expect(await overlaps()).toEqual([]);
      await dispatch({ type: 'setRightColumnCollapsed', collapsed: true });
      await new Promise((r) => setTimeout(r, 300));
      await operator.screenshot({ path: join(artifacts, `operator-run-${name}-collapsed.png`) });
      expect(await overlaps()).toEqual([]);
      await dispatch({ type: 'setRightColumnCollapsed', collapsed: false });
    }
    await resize(1200, 780);
    await dispatch({ type: 'setMode', mode: 'edit' });
  });

  it('shows the same lines, spacing and position on the Output and the Live view, at any Output window size', async () => {
    // The Output is always laid out as 1920x1080 and scaled to its window, so the Talent's top
    // line is the Operator's top line however big the window or monitor is.
    const topLine = (page: Page, sel: { text: string; stage: string }) =>
      page.evaluate((sel) => {
        const text = document.querySelector(sel.text)!;
        const stage = document.querySelector(sel.stage)!.getBoundingClientRect();
        const scale = stage.width / 1920;
        const words: { w: string; top: number; bottom: number }[] = [];
        const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
          const re = /\S+/g;
          for (let m = re.exec(n.data); m; m = re.exec(n.data)) {
            const range = document.createRange();
            range.setStart(n, m.index);
            range.setEnd(n, m.index + m[0].length);
            const r = range.getBoundingClientRect();
            words.push({
              w: m[0],
              top: (r.top - stage.top) / scale,
              bottom: (r.bottom - stage.top) / scale,
            });
          }
        }
        const shown = words.filter((x) => x.bottom > 0);
        const first = Math.min(...shown.map((x) => x.top));
        const row = shown.filter((x) => Math.abs(x.top - first) < 2);
        return {
          line: row.map((x) => x.w).join(' '),
          top: Math.round(first),
          stageWidth: Math.round(stage.width / scale),
        };
      }, sel);
    const setOutputSize = (width: number, height: number) =>
      app.evaluate(
        ({ BrowserWindow }, { width, height }) => {
          const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Output'))!;
          win.setContentSize(width, height);
        },
        { width, height },
      );
    await dispatch({ type: 'setMode', mode: 'run' });
    await operator.getByTestId('live-view').waitFor();
    await dispatch({ type: 'scrollBy', lines: -10_000 });
    for (const [width, height] of [
      [1920, 1080],
      [1280, 720],
      [1000, 900],
      [2560, 1080],
    ]) {
      await setOutputSize(width, height);
      // The visible line count (so a Screen jump and the end of the Script) is the 1080px stage's,
      // not the window's.
      await expect
        .poll(async () => {
          const s = await state();
          return (
            s.viewportLines - Math.floor(1080 / (s.appearance.fontSize * s.appearance.lineSpacing))
          );
        })
        .toBe(0);
      for (const step of [0, 1, 2, 1, 3, 1]) {
        await dispatch({ type: 'scrollBy', lines: step });
        await expect
          .poll(async () => {
            const talent = await topLine(output, { text: '#text', stage: '#stage' });
            const operatorView = await topLine(operator, {
              text: '[data-live="text"]',
              stage: '[data-live="surface"]',
            });
            return JSON.stringify([talent, operatorView]);
          })
          .toSatisfy((both: string) => {
            const [a, b] = JSON.parse(both);
            return (
              a.line === b.line && a.top === b.top && a.stageWidth === 1920 && b.stageWidth === 1920
            );
          });
      }
    }
    await output.screenshot({ path: join(artifacts, 'output-scaled.png') });
    await setOutputSize(1920, 1080);
  });

  it('drags the Reading line in the Live view and the Output shows it in the same place', async () => {
    await dispatch({ type: 'setMode', mode: 'run' });
    await dispatch({ type: 'setAppearance', changes: { readingLine: true, readingLineY: 0.25 } });
    const handle = operator.locator('[data-live="reading-line"]');
    await handle.waitFor();
    // Where a page puts the triangle, in 1920x1080 stage px, whatever the window or scale.
    const stagePosition = (page: Page, sel: { line: string; stage: string }) =>
      page.evaluate((sel) => {
        const stage = document.querySelector(sel.stage)!.getBoundingClientRect();
        const r = document.querySelector(sel.line)!.getBoundingClientRect();
        const scale = stage.width / 1920;
        return { centerY: (r.top + r.height / 2 - stage.top) / scale, height: r.height / scale };
      }, sel);
    const both = async () => ({
      talent: await stagePosition(output, { line: '#reading-line', stage: '#stage' }),
      operatorView: await stagePosition(operator, {
        line: '[data-live="reading-line"]',
        stage: '[data-live="surface"]',
      }),
    });
    const positionBefore = (await state()).position;
    const before = await both();
    expect(before.talent.centerY).toBeCloseTo(270, 0);
    expect(before.operatorView.centerY).toBeCloseTo(270, 0);

    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const view = (await operator.getByTestId('live-view').boundingBox())!;
    await operator.mouse.move(x, y);
    await operator.mouse.down();
    await operator.mouse.move(x, y + view.height * 0.3, { steps: 8 });
    await operator.screenshot({ path: join(artifacts, 'live-view-dragging-reading-line.png') });
    await operator.mouse.up();

    await expect.poll(async () => (await state()).appearance.readingLineY).toBeCloseTo(0.55, 1);
    const after = await both();
    expect(after.operatorView.centerY).toBeGreaterThan(before.operatorView.centerY + 250);
    expect(Math.abs(after.talent.centerY - after.operatorView.centerY)).toBeLessThan(1.5);
    expect(after.talent.height).toBeCloseTo(64, 0);
    // The text did not scroll with it.
    expect((await state()).position).toBe(positionBefore);
    await operator.screenshot({ path: join(artifacts, 'live-view-reading-line-moved.png') });
    await output.screenshot({ path: join(artifacts, 'output-reading-line-moved.png') });

    // The same at another window size, and mirrored (flips sideways only).
    await dispatch({ type: 'setAppearance', changes: { mirror: true } });
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle().includes('Output'))!
        .setContentSize(1000, 900);
    });
    await expect
      .poll(async () => {
        const { talent, operatorView } = await both();
        return Math.abs(talent.centerY - operatorView.centerY) < 1.5;
      })
      .toBe(true);
    await dispatch({ type: 'setAppearance', changes: { mirror: false } });
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle().includes('Output'))!
        .setContentSize(1920, 1080);
    });

    // The keyboard nudges it, and the switch hides it.
    await handle.focus();
    const keyed = (await state()).appearance.readingLineY;
    await operator.keyboard.press('ArrowUp');
    await expect
      .poll(async () => (await state()).appearance.readingLineY)
      .toBeCloseTo(keyed - 0.01, 3);
    await dispatch({ type: 'setAppearance', changes: { readingLine: false } });
    await expect.poll(() => handle.isHidden()).toBe(true);
    await dispatch({ type: 'setAppearance', changes: { readingLine: true } });
  });

  it('changes the Output text size from Run mode, and the Output follows', async () => {
    await dispatch({ type: 'setMode', mode: 'run' });
    const before = (await state()).appearance.fontSize;
    await operator.getByRole('button', { name: 'Larger text' }).click();
    await vi.waitFor(async () => expect((await state()).appearance.fontSize).toBe(before + 4));
    await expect
      .poll(() =>
        output.evaluate(() => getComputedStyle(document.getElementById('text')!).fontSize),
      )
      .toBe(`${before + 4}px`);
    await operator.getByRole('button', { name: 'Smaller text' }).click();
    await vi.waitFor(async () => expect((await state()).appearance.fontSize).toBe(before));
  });

  it('opens every window big enough that no option needs a resize to reach', async () => {
    const overflow = (page: Page) =>
      page.evaluate(() => ({
        v: document.documentElement.scrollHeight - window.innerHeight,
        h: document.documentElement.scrollWidth - window.innerWidth,
      }));
    const area = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().workAreaSize);
    // The Operator view fits the screen and shows both modes whole.
    for (const mode of ['edit', 'run']) {
      await dispatch({ type: 'setMode', mode });
      await operator.waitForTimeout(300);
      const o = await overflow(operator);
      expect(o.v).toBeLessThanOrEqual(0);
      expect(o.h).toBeLessThanOrEqual(0);
    }
    expect(await operator.evaluate(() => window.innerHeight)).toBeLessThanOrEqual(area.height);
    // Preferences: tabs replace scrolling. At 900x640 no tab of any category has a scrolling
    // region (but the Quick messages list), and every control in the tab is inside the window.
    await app.evaluate(({ Menu }) => {
      Menu.getApplicationMenu()!
        .items.find((i) => i.label === 'File')!
        .submenu!.items.find((i) => i.label.startsWith('Preferences'))!
        .click();
    });
    const prefs = await windowTitled('Preferences');
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Preferences'))!;
      win.setContentSize(900, 640);
    });
    await prefs.waitForTimeout(300);
    const tabsOf: Array<[string, string[]]> = [
      ['General', []],
      ['Appearance', ['Text', 'Colors', 'Reading line', 'Presets']],
      ['Output', []],
      ['Controls', []],
      ['Notifications', []],
      ['Network', ['Connection', 'Quick messages']],
    ];
    const fits = (label: string) =>
      prefs.evaluate((label) => {
        const problems: string[] = [];
        const view = { w: window.innerWidth, h: window.innerHeight };
        if (document.documentElement.scrollHeight > view.h) problems.push('page scrolls');
        if (document.documentElement.scrollWidth > view.w) problems.push('page scrolls sideways');
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('main, main *'))) {
          const style = getComputedStyle(el);
          const scrollable =
            /auto|scroll/.test(style.overflowY) || /auto|scroll/.test(style.overflowX);
          const overflows =
            el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
          if (scrollable && overflows && !el.classList.contains('pf-messages-list')) {
            problems.push(`${el.className || el.tagName} scrolls`);
          }
        }
        for (const el of Array.from(
          document.querySelectorAll<HTMLElement>(
            '.pf-panel input, .pf-panel select, .pf-panel button',
          ),
        )) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.left < 0 || r.top < 0 || r.right > view.w || r.bottom > view.h) {
            problems.push(
              `${el.getAttribute('aria-label') ?? el.textContent} is outside the window`,
            );
          }
        }
        return problems.map((p) => `${label}: ${p}`);
      }, label);
    for (const [category, tabs] of tabsOf) {
      await prefs.getByRole('button', { name: category, exact: true }).click();
      await prefs.waitForTimeout(250);
      for (const tabName of tabs.length ? tabs : [null]) {
        if (tabName) await prefs.getByRole('tab', { name: tabName }).click();
        await prefs.waitForTimeout(150);
        const label = tabName ? `${category} / ${tabName}` : category;
        expect(await fits(label)).toEqual([]);
        const shot = `preferences-fit-${category}${tabName ? `-${tabName}` : ''}`
          .toLowerCase()
          .replace(/\s+/g, '-');
        await prefs.screenshot({ path: join(artifacts, `${shot}.png`) });
      }
    }
    await prefs.close();
    // The Virtual shuttle shows the whole device.
    await app.evaluate(({ Menu }) => {
      Menu.getApplicationMenu()!
        .items.find((i) => i.label === 'Window')!
        .submenu!.items.find((i) => i.label === 'Virtual shuttle')!
        .click();
    });
    const shuttle = await windowTitled('Virtual shuttle');
    const s = await overflow(shuttle);
    expect(s.v).toBeLessThanOrEqual(0);
    expect(s.h).toBeLessThanOrEqual(0);
    await shuttle.close();
  });

  it('scrolls the Script with the mouse wheel and by dragging it, and the Output follows', async () => {
    await dispatch({ type: 'setMode', mode: 'run' });
    await dispatch({ type: 'scrollBy', lines: -10_000 });
    const box = (await operator.getByTestId('live-view').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const position = async () => (await state()).position;
    const outputOffset = () =>
      output.evaluate(() => {
        const t = document.getElementById('text')!;
        const lineHeight = parseFloat(getComputedStyle(t).lineHeight);
        return -new DOMMatrix(getComputedStyle(t).transform).m42 / lineHeight;
      });
    expect(await position()).toBeCloseTo(await outputOffset(), 1);

    // Wheel down moves forward, wheel up moves back.
    await operator.mouse.move(cx, cy);
    await operator.mouse.wheel(0, 240);
    await vi.waitFor(async () => expect(await position()).toBeGreaterThan(1));
    const afterWheel = await position();
    await operator.mouse.wheel(0, -120);
    await vi.waitFor(async () => expect(await position()).toBeLessThan(afterWheel));

    // Dragging the text up moves forward; the Output shows the same place.
    const beforeDrag = await position();
    await operator.mouse.move(cx, cy + 80);
    await operator.mouse.down();
    await operator.mouse.move(cx, cy, { steps: 6 });
    await operator.mouse.up();
    await vi.waitFor(async () => expect(await position()).toBeGreaterThan(beforeDrag + 1));
    await vi.waitFor(async () => expect(await outputOffset()).toBeCloseTo(await position(), 1));

    // Dragging down moves back. A plain click moves nothing.
    const beforeBack = await position();
    await operator.mouse.move(cx, cy);
    await operator.mouse.down();
    await operator.mouse.move(cx, cy + 100, { steps: 6 });
    await operator.mouse.up();
    await vi.waitFor(async () => expect(await position()).toBeLessThan(beforeBack));
    const beforeClick = await position();
    await operator.mouse.click(cx, cy);
    expect(await position()).toBeCloseTo(beforeClick, 5);
  });

  it('goes forward and back a Screen with the Right and Left arrow keys', async () => {
    await dispatch({ type: 'setMode', mode: 'run' });
    // Big text, so the Script is many Screens long and a Screen jump is not cut short by the end.
    const fontBefore = (await state()).appearance.fontSize;
    await dispatch({ type: 'setAppearance', changes: { fontSize: 96 } });
    await vi.waitFor(async () => expect((await state()).viewportLines).toBe(8));
    await dispatch({ type: 'scrollBy', lines: -10_000 });
    await operator.getByTestId('live-view').click();
    const position = async () => (await state()).position;
    const start = await position();
    // A Screen is the Output's visible height in lines, minus one.
    const screen = (await state()).viewportLines - 1;
    await operator.keyboard.press('ArrowRight');
    await vi.waitFor(async () => expect(await position()).toBeCloseTo(start + screen, 1));
    const forward = await position();
    // Still works with a button holding the focus (the Play key was just clicked in real use).
    await operator.getByRole('button', { name: /Forward a Screen/i }).focus();
    await operator.keyboard.press('ArrowRight');
    await vi.waitFor(async () => expect(await position()).toBeGreaterThan(forward));
    await operator.keyboard.press('ArrowLeft');
    await operator.keyboard.press('ArrowLeft');
    await vi.waitFor(async () => expect(await position()).toBeCloseTo(start, 1));
    await dispatch({ type: 'setAppearance', changes: { fontSize: fontBefore } });
  });

  it('runs the text to the edges of the Output and the Live view when the Margin is 0%', async () => {
    await dispatch({ type: 'setMode', mode: 'run' });
    await dispatch({ type: 'setAppearance', changes: { margin: 0 } });
    const gap = (page: Page, text: string, stage: string) =>
      page.evaluate(
        ({ text, stage }) => {
          const t = document.querySelector(text)!.getBoundingClientRect();
          const s = document.querySelector(stage)!.getBoundingClientRect();
          return {
            left: (t.left - s.left) / (s.width / 1920),
            right: (s.right - t.right) / (s.width / 1920),
          };
        },
        { text, stage },
      );
    await expect.poll(async () => (await gap(output, '#text', '#stage')).left).toBeLessThan(1);
    expect((await gap(output, '#text', '#stage')).right).toBeLessThan(1);
    const live = await gap(operator, '[data-live="text"]', '[data-live="surface"]');
    expect(live.left).toBeLessThan(1);
    expect(live.right).toBeLessThan(1);
    await dispatch({ type: 'setAppearance', changes: { margin: 10 } });
    await expect
      .poll(async () => Math.round((await gap(output, '#text', '#stage')).left))
      .toBe(192);
  });

  it('plays forward with Space and back with Shift+Space, shows the direction, and has a short bar', async () => {
    await dispatch({ type: 'setMode', mode: 'run' });
    const font = (await state()).appearance.fontSize;
    await dispatch({ type: 'setAppearance', changes: { fontSize: 96 } });
    await vi.waitFor(async () => expect((await state()).viewportLines).toBe(8));
    await dispatch({ type: 'pause' });
    await dispatch({ type: 'scrollBy', lines: -10_000 });
    await dispatch({ type: 'scrollBy', lines: 12 });
    await dispatch({ type: 'setSpeed', level: 3 });
    await operator.getByTestId('live-view').click();
    const direction = () => operator.getByTestId('direction').getAttribute('data-direction');
    expect(await direction()).toBe('forward');
    await operator.keyboard.press('Shift+Space');
    await vi.waitFor(async () => expect((await state()).direction).toBe('reverse'));
    expect((await state()).playing).toBe(true);
    await vi.waitFor(async () => expect(await direction()).toBe('reverse'));
    await vi.waitFor(async () =>
      expect(await operator.getByTestId('direction').textContent()).toContain('BACK'),
    );
    const moving = (await state()).position;
    await vi.waitFor(async () => expect((await state()).position).toBeLessThan(moving - 0.3));
    await operator.screenshot({ path: join(artifacts, 'operator-run-reverse.png') });
    // Space turns it round to forward, and then pauses.
    await operator.keyboard.press('Space');
    await vi.waitFor(async () => expect((await state()).direction).toBe('forward'));
    expect((await state()).playing).toBe(true);
    await vi.waitFor(async () => expect(await direction()).toBe('forward'));
    await shows('Pause');
    await operator.keyboard.press('Space');
    await vi.waitFor(async () => expect((await state()).playing).toBe(false));
    await vi.waitFor(async () => expect(await direction()).toBe('forward'));
    // The transport is a short single bar.
    const bar = (await operator.getByTestId('transport').boundingBox())!;
    expect(bar.height).toBeLessThan(86);
    await dispatch({ type: 'setAppearance', changes: { fontSize: font } });
  });

  it('Space plays even right after a button was clicked, and does not press that button again', async () => {
    await dispatch({ type: 'setMode', mode: 'run' });
    await dispatch({ type: 'pause' });
    await dispatch({ type: 'scrollBy', lines: -10_000 });
    await dispatch({ type: 'setSpeed', level: 3 });
    const font = (await state()).appearance.fontSize;
    // Click A+: the button keeps the focus, as a click leaves it.
    await operator.getByRole('button', { name: 'Larger text' }).click();
    await vi.waitFor(async () => expect((await state()).appearance.fontSize).toBe(font + 4));
    await operator.keyboard.press('Space');
    await vi.waitFor(async () => expect((await state()).playing).toBe(true));
    await shows('Pause');
    // The focused A+ was not pressed a second time.
    expect((await state()).appearance.fontSize).toBe(font + 4);
    await operator.keyboard.press('Space');
    await vi.waitFor(async () => expect((await state()).playing).toBe(false));
    await shows('Play');
    expect((await state()).appearance.fontSize).toBe(font + 4);
    // (The Output switch gets the same treatment; it is covered in the component test, because
    // switching the Output on puts its window over this one.)
    await dispatch({ type: 'setAppearance', changes: { fontSize: font } });
  });

  it('Esc on an Output that is already a window leaves it where it is', async () => {
    // (Full screen needs a second monitor; the module's tests cover Esc taking it out of full
    // screen. This checks the message is safe on the windowed Output this test uses.)
    const before = await outputWindows();
    expect(before).toBe(1);
    await output.keyboard.press('Escape');
    await output.waitForTimeout(400);
    expect(await outputWindows()).toBe(1);
    expect((await state()).outputOn).toBe(true);
    // Esc in the Operator view is not the Output's key.
    await operator.keyboard.press('Escape');
    await operator.waitForTimeout(200);
    expect(await outputWindows()).toBe(1);
  });

  it('Esc takes a windowed Output out of full screen that the Operator put it in themselves', async () => {
    // The green button (or a shortcut) can make any window full screen; Esc must leave it too.
    const outputState = () =>
      app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes('/output/'),
        );
        return win ? { fullScreen: win.isFullScreen() } : null;
      });
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('/output/'))!
        .setFullScreen(true);
    });
    await vi.waitFor(async () => expect((await outputState())?.fullScreen).toBe(true), {
      timeout: 10_000,
    });
    await output.waitForFunction(() => document.querySelectorAll('#text > div').length > 0);
    await output.keyboard.press('Escape');
    await vi.waitFor(async () => expect((await outputState())?.fullScreen).toBe(false), {
      timeout: 10_000,
      interval: 250,
    });
    // It is still the one Output, still on.
    expect(await outputWindows()).toBe(1);
    expect((await state()).outputOn).toBe(true);
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

describe('a full screen Output', () => {
  // The test pretends a second display exists (on top of the real one), so a genuine full screen
  // Output opens on a machine with one display. Each attempt launches its own app: opening and
  // closing full screen windows is heavy, and macOS sometimes refuses a new helper process, which
  // ends that app; a fresh one makes a retry meaningful.
  it(
    'goes full screen on the chosen monitor, Esc makes it an ordinary window, and Off then On goes full screen again',
    { retry: 3, timeout: 120_000 },
    async () => {
      const data = mkdtempSync(join(tmpdir(), 'neoprompter-e2e-fs-'));
      const second = await electron.launch({
        args: [root],
        env: { ...process.env, NEOPROMPTER_USER_DATA: data, NEOPROMPTER_FAKE_SECOND_DISPLAY: '1' },
      });
      try {
        let operatorPage: Page | undefined;
        await vi.waitFor(async () => {
          for (const w of second.windows()) {
            if ((await w.title()).includes('Operator view')) operatorPage = w;
          }
          expect(operatorPage).toBeDefined();
        });
        const operatorView = operatorPage!;
        const outputWindow = () =>
          second.evaluate(({ BrowserWindow }) => {
            const win = BrowserWindow.getAllWindows().find((w) =>
              w.webContents.getURL().includes('/output/'),
            );
            return win
              ? { fullScreen: win.isFullScreen(), width: win.getContentBounds().width }
              : null;
          });
        const send = (command: object) =>
          operatorView.evaluate((c) => (window as any).neoprompter.dispatch(c), command);
        const width = await second.evaluate(
          ({ screen }) => screen.getPrimaryDisplay().bounds.width,
        );

        await operatorView.evaluate(() =>
          (window as any).neoprompter.chooseOutputMonitor('fake-second'),
        );
        await send({ type: 'setOutput', on: true });
        await vi.waitFor(async () => expect((await outputWindow())?.fullScreen).toBe(true), {
          timeout: 15_000,
        });

        // Esc, pressed in the Output window itself, once its page is up. (The page is replaced,
        // so the key press may end early.)
        let page: Page | undefined;
        await vi.waitFor(() => {
          page = second.windows().find((w) => w.url().includes('/output/'));
          expect(page).toBeDefined();
        });
        await page!.waitForFunction(() => document.querySelectorAll('#text > div').length > 0);
        await page!.keyboard.press('Escape').catch(() => undefined);
        await vi.waitFor(
          async () => {
            const out = await outputWindow();
            expect(out).not.toBeNull();
            expect(out!.fullScreen).toBe(false);
            expect(out!.width).toBeLessThan(width);
          },
          { timeout: 20_000, interval: 250 },
        );
        // Still on: Esc changes how it shows, not whether it is on.
        expect(
          (await operatorView.evaluate(() => (window as any).neoprompter.getState())).outputOn,
        ).toBe(true);

        // Off, then On: back to full screen on the chosen monitor.
        await send({ type: 'setOutput', on: false });
        await vi.waitFor(async () => expect(await outputWindow()).toBeNull(), {
          timeout: 15_000,
        });
        await send({ type: 'setOutput', on: true });
        await vi.waitFor(async () => expect((await outputWindow())?.fullScreen).toBe(true), {
          timeout: 20_000,
          interval: 250,
        });
      } finally {
        await second.close().catch(() => undefined);
        rmSync(data, { recursive: true, force: true });
      }
    },
  );
});
