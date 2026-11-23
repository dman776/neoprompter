// The Watched folder in the running app: files already in the folder when the app starts are
// Imported into the library, and the files are moved or left as they should be.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
});
