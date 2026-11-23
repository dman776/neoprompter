// The Watched folder in the running app: files already in the folder when the app starts are
// Imported into the library, and the files are moved or left as they should be.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeDocx, para, run } from '../src/import/fixtures';

const root = process.cwd();
const artifacts = join(root, 'e2e', 'artifacts');

let app: ElectronApplication;
let operator: Page;
let userData: string;
let drop: string;

async function windowTitled(part: string): Promise<Page> {
  for (let i = 0; i < 100; i++) {
    for (const w of app.windows()) if ((await w.title()).includes(part)) return w;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No window titled "${part}"`);
}

beforeAll(async () => {
  mkdirSync(artifacts, { recursive: true });
  userData = mkdtempSync(join(tmpdir(), 'neoprompter-e2e-'));
  drop = mkdtempSync(join(tmpdir(), 'neoprompter-drop-'));
  writeFileSync(
    join(userData, 'output-settings.json'),
    JSON.stringify({ windowed: true, monitorBySetup: {} }),
  );
  writeFileSync(join(userData, 'watched-folder.json'), JSON.stringify(drop));
  writeFileSync(
    join(drop, 'Sunday.docx'),
    makeDocx(para([run('Welcome everyone')]) + para([run('Let us pray')])),
  );
  writeFileSync(join(drop, 'Broken.doc'), 'this is not a Word file');
  writeFileSync(join(drop, 'notes.txt'), 'not a Word file');
  app = await electron.launch({
    args: [root],
    env: { ...process.env, NEOPROMPTER_USER_DATA: userData },
  });
  operator = await windowTitled('Operator view');
});

afterAll(async () => {
  await app?.close();
  rmSync(userData, { recursive: true, force: true });
  rmSync(drop, { recursive: true, force: true });
});

const libraryNames = () =>
  operator.evaluate(async () =>
    ((await (window as any).neoprompter.getState()).library as { name: string }[]).map(
      (s) => s.name,
    ),
  );

describe('the Watched folder in the running app', () => {
  it('Imports the Word file at startup and moves it into imported/', async () => {
    const library = await operator.evaluate(async () =>
      ((await (window as any).neoprompter.getState()).library as { name: string }[]).map(
        (s) => s.name,
      ),
    );
    expect(library).toEqual(['Sunday']);
    expect(existsSync(join(drop, 'Sunday.docx'))).toBe(false);
    expect(existsSync(join(drop, 'imported', 'Sunday.docx'))).toBe(true);
    await operator.screenshot({ path: join(artifacts, 'watched-folder-library.png') });
  });

  it('leaves a file that cannot be Imported, and other file types, where they are', () => {
    expect(existsSync(join(drop, 'Broken.doc'))).toBe(true);
    expect(existsSync(join(drop, 'notes.txt'))).toBe(true);
  });

  it('tells the Operator about the startup Import in the notice banner', async () => {
    const banner = operator.getByTestId('notice');
    await banner.waitFor({ timeout: 5000 });
    expect(await banner.textContent()).toContain('Imported "Sunday" from the Watched folder.');
    expect(await banner.textContent()).toContain('Broken.doc');
    await operator.screenshot({ path: join(artifacts, 'watched-folder-notice.png') });
  });

  it('shows the last result under the folder in Preferences', async () => {
    await app.evaluate(({ Menu }) => {
      Menu.getApplicationMenu()!
        .items.find((i) => i.label === 'File')!
        .submenu!.items.find((i) => i.label === 'Preferences')!
        .click();
    });
    const prefs = await windowTitled('Preferences');
    const result = prefs.getByTestId('watched-folder-result');
    await result.waitFor({ timeout: 5000 });
    expect(await result.textContent()).toContain('Imported "Sunday"');
    await prefs.screenshot({ path: join(artifacts, 'watched-folder-preferences.png') });
  });

  it('Imports a file dropped in while the app runs', async () => {
    writeFileSync(join(drop, 'Live.docx'), makeDocx(para([run('Dropped while running')])));
    await vi.waitFor(async () => expect(await libraryNames()).toContain('Live'), {
      timeout: 10_000,
      interval: 250,
    });
    expect(existsSync(join(drop, 'Live.docx'))).toBe(false);
    expect(existsSync(join(drop, 'imported', 'Live.docx'))).toBe(true);
    await operator.screenshot({ path: join(artifacts, 'watched-folder-live-drop.png') });
  });

  it('holds a file dropped in Run mode until the Operator is back in Edit mode', async () => {
    const mode = (m: 'run' | 'edit') =>
      operator.evaluate(
        (x) => (window as any).neoprompter.dispatch({ type: 'setMode', mode: x }),
        m,
      );
    await mode('run');
    writeFileSync(join(drop, 'Later.docx'), makeDocx(para([run('Dropped in Run mode')])));
    await new Promise((r) => setTimeout(r, 4000));
    expect(await libraryNames()).not.toContain('Later');
    expect(existsSync(join(drop, 'Later.docx'))).toBe(true);
    await mode('edit');
    await vi.waitFor(async () => expect(await libraryNames()).toContain('Later'), {
      timeout: 10_000,
      interval: 250,
    });
    expect(existsSync(join(drop, 'imported', 'Later.docx'))).toBe(true);
  });
});
