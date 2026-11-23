// The Import button in the running app. The native open dialog cannot be driven, so the test
// replaces it in the main process: it records the options and answers with a real file.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import electronPath from 'electron';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makePdf } from '../src/import/pdfFixtures';

const root = process.cwd();
const artifacts = join(root, 'e2e', 'artifacts');

let app: ElectronApplication;
let operator: Page;
let userData: string;
let files: string;
let appLog = '';

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
  files = mkdtempSync(join(tmpdir(), 'neoprompter-import-'));
  writeFileSync(
    join(userData, 'output-settings.json'),
    JSON.stringify({ windowed: true, monitorBySetup: {} }),
  );
  writeFileSync(join(files, 'Welcome.txt'), 'Good morning\r\n\r\nPlease stand');
  writeFileSync(
    join(files, 'Guide.pdf'),
    makePdf([
      [
        { text: 'Welcome to the service', y: 700 },
        { text: 'and thank you for coming', y: 686 },
        { text: 'Please stand', y: 658 },
      ],
    ]),
  );
  writeFileSync(join(files, 'Scan.pdf'), makePdf([[]]));
  app = await electron.launch({
    args: [root],
    env: {
      ...process.env,
      NEOPROMPTER_USER_DATA: userData,
      NEOPROMPTER_NO_UPDATE_CHECK: '1',
      NEOPROMPTER_NO_AUTO_WINDOWED: '1',
    },
  });
  app.process().stdout?.on('data', (d) => (appLog += d));
  app.process().stderr?.on('data', (d) => (appLog += d));
  operator = await windowTitled('Operator view');
});

afterAll(async () => {
  await app?.close();
  rmSync(userData, { recursive: true, force: true });
  rmSync(files, { recursive: true, force: true });
});

describe('the Import button in the running app', () => {
  it('offers text files with the Word files and Imports the one picked', async () => {
    await app.evaluate(
      ({ dialog }, file) => {
        const g = globalThis as unknown as { importDialogOptions?: unknown };
        dialog.showOpenDialog = (async (...args: unknown[]) => {
          g.importDialogOptions = args[args.length - 1];
          return { canceled: false, filePaths: [file] };
        }) as typeof dialog.showOpenDialog;
      },
      join(files, 'Welcome.txt'),
    );

    await operator.getByTestId('import').click();
    await operator.getByTestId('notice').waitFor({ timeout: 5000 });
    expect(await operator.getByTestId('notice').textContent()).toContain(
      'Imported "Welcome" into the library.',
    );

    const options = (await app.evaluate(
      () => (globalThis as unknown as { importDialogOptions: unknown }).importDialogOptions,
    )) as { filters: { name: string; extensions: string[] }[] };
    expect(options.filters[0].extensions).toEqual(['docx', 'doc', 'txt', 'pdf']);

    const lines = await operator.evaluate(async () => {
      const api = (window as any).neoprompter;
      const entry = ((await api.getState()).library as { id: string; name: string }[]).find(
        (e) => e.name === 'Welcome',
      );
      api.dispatch({ type: 'loadScript', id: entry!.id });
      return (await api.getState()).script.lines as string[];
    });
    expect(lines).toEqual(['Good morning', '', 'Please stand']);
    await operator.screenshot({ path: join(artifacts, 'import-text.png') });
  });

  it('Imports a PDF as paragraphs, and refuses one with no text', async () => {
    const pick = (file: string) =>
      app.evaluate(
        ({ dialog }, f) => {
          dialog.showOpenDialog = (async () => ({
            canceled: false,
            filePaths: [f],
          })) as typeof dialog.showOpenDialog;
        },
        join(files, file),
      );
    const notice = async () => {
      await operator.getByTestId('import').click();
      await operator.getByTestId('notice').waitFor({ timeout: 5000 });
      return operator.getByTestId('notice').textContent();
    };

    await operator.getByRole('button', { name: 'Dismiss' }).click();
    await pick('Guide.pdf');
    expect(await notice()).toContain('Imported "Guide" into the library.');
    const lines = await operator.evaluate(async () => {
      const api = (window as any).neoprompter;
      const entry = ((await api.getState()).library as { id: string; name: string }[]).find(
        (e) => e.name === 'Guide',
      );
      api.dispatch({ type: 'loadScript', id: entry!.id });
      return (await api.getState()).script.lines as string[];
    });
    expect(lines).toEqual(['Welcome to the service and thank you for coming', 'Please stand']);
    expect(appLog).not.toMatch(/Warning: Cannot/);
    await operator.screenshot({ path: join(artifacts, 'import-pdf.png') });

    await operator.getByRole('button', { name: 'Dismiss' }).click();
    await pick('Scan.pdf');
    expect(await notice()).toContain('"Scan.pdf" has no text to import');
  });

  it('starts without pdf.js warnings in the log', async () => {
    // Playwright attaches to the output late, so run Electron directly to see the first line.
    const dir = mkdtempSync(join(tmpdir(), 'neoprompter-log-'));
    const child = spawn(electronPath as unknown as string, [root], {
      env: { ...process.env, NEOPROMPTER_USER_DATA: dir, NEOPROMPTER_NO_UPDATE_CHECK: '1' },
    });
    let log = '';
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const exited = new Promise((resolve) => child.on('exit', resolve));
    child.kill();
    await exited;
    rmSync(dir, { recursive: true, force: true });
    expect(log).not.toMatch(/Warning: Cannot/);
  });
});
