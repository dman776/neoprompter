// Takes the README screenshots of the built app into docs/screenshots/.
// Run `npm run build` first, then `node scripts/readme-screenshots.mjs`.
// It uses a throwaway data folder, so it never touches your real library.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron } from 'playwright-core';

const root = process.cwd();
const out = join(root, 'docs', 'screenshots');
mkdirSync(out, { recursive: true });
const userData = mkdtempSync(join(tmpdir(), 'neoprompter-shots-'));
writeFileSync(
  join(userData, 'output-settings.json'),
  JSON.stringify({ windowed: true, monitorBySetup: {} }),
);

// A Watched folder that is already chosen (and empty), so Preferences shows it set up.
const drop = join(userData, 'Scripts');
mkdirSync(drop);
writeFileSync(join(userData, 'watched-folder.json'), JSON.stringify(drop));

const app = await electron.launch({
  args: [root],
  env: {
    ...process.env,
    NEOPROMPTER_USER_DATA: userData,
    NEOPROMPTER_NO_UPDATE_CHECK: '1',
    NEOPROMPTER_NO_AUTO_WINDOWED: '1',
  },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function windowTitled(part) {
  for (let i = 0; i < 100; i++) {
    for (const w of app.windows()) if ((await w.title()).includes(part)) return w;
    await sleep(100);
  }
  throw new Error(`No window titled "${part}"`);
}
const menu = (top, label) =>
  app.evaluate(
    ({ Menu }, [top, label]) => {
      Menu.getApplicationMenu()
        .items.find((i) => i.label === top)
        .submenu.items.find((i) => i.label.startsWith(label))
        .click();
    },
    [top, label],
  );
const resize = (title, width, height) =>
  app.evaluate(
    ({ BrowserWindow }, [title, width, height]) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes(title));
      win.setMinimumSize(0, 0);
      win.setContentSize(width, height);
    },
    [title, width, height],
  );

try {
  const operator = await windowTitled('Operator view');
  const dispatch = (c) => operator.evaluate((c) => window.neoprompter.dispatch(c), c);
  const state = () => operator.evaluate(() => window.neoprompter.getState());
  await resize('Operator', 1360, 980);

  const p = (text) => ({ runs: [{ text }] });
  const h = (text) => ({ heading: 2, runs: [{ text }] });
  const b = (text) => ({ runs: [{ text, bold: true }] });
  const service = [
    h('Welcome'),
    p('Good morning, everyone, and welcome to Grace Community Church.'),
    p('If this is your first time with us, we are so glad you are here.'),
    '',
    b('Please silence your phones, and stand with us as we sing.'),
    '',
    h('Announcements'),
    p('Next Sunday is our potluck lunch right after the service. Bring a dish to share.'),
    p('Sign-up sheets for the fall small groups are in the lobby.'),
    p('The youth group meets Wednesday at 7 pm. Bring a friend.'),
    '',
    h('Offering'),
    p('Giving is a way we worship. You can give in the baskets, or online at our website.'),
    p('Thank you for your generosity.'),
    '',
    h('Message'),
    p('Please open your Bibles to the book of Luke, chapter fifteen.'),
    p('Today we are looking at three stories about something lost, and found.'),
    p('A sheep. A coin. A son. And a Father who never stops looking.'),
    '',
    h('Closing prayer'),
    p('Let us pray together. Father, thank you for finding us. Amen.'),
  ];
  const text = (lines) => lines.map((l) => (typeof l === 'string' ? l : l.runs[0].text)).join('\n');
  const day = (d, hr, min = 0) => Date.UTC(2026, 10, d, hr, min);
  const source = (method, file, type, size, d) => ({
    method,
    filePath: file,
    fileType: type,
    fileSize: size,
    fileModifiedMs: day(d, 9, 15),
  });
  const library = [
    ['Wedding ceremony', ['Welcome and prayer', 'Vows', 'Rings', 'Pronouncement'], null],
    [
      'Christmas Eve',
      ['Candle lighting', 'Carols', 'Reading: Luke 2'],
      source('manual', '/Users/Operator/Documents/Christmas Eve.docx', 'docx', 18_432, 20),
    ],
    [
      'Easter Sunday',
      ['He is risen!', 'Reading: Matthew 28'],
      source('watched', '/Users/Operator/Scripts/imported/Easter Sunday.pdf', 'pdf', 92_160, 22),
    ],
  ];
  for (const [name, lines, src] of library) {
    await dispatch({
      type: 'saveScript',
      name,
      text: lines.join('\n'),
      ...(src && { source: src }),
    });
  }
  await dispatch({
    type: 'saveScript',
    name: 'Sunday service',
    text: text(service),
    lines: service,
    source: source(
      'watched',
      '/Users/Operator/Scripts/imported/Sunday service.docx',
      'docx',
      24_576,
      23,
    ),
  });
  const entry = (await state()).library.find((e) => e.name === 'Sunday service');
  await dispatch({ type: 'loadScript', id: entry.id });
  await sleep(300);
  await dispatch({ type: 'setAppearance', changes: { fontSize: 72 } });

  // Edit mode: the editor, the Scripts list with its icons, and the details popup.
  await sleep(600);
  await operator
    .locator('.lib-item', { hasText: 'Easter Sunday' })
    .getByRole('button', { name: 'Script details', exact: true })
    .click();
  await sleep(300);
  await operator.screenshot({ path: join(out, 'edit-mode.png') });
  await operator
    .locator('.lib-item', { hasText: 'Easter Sunday' })
    .getByRole('button', { name: 'Script details', exact: true })
    .click();

  // A New script added Notification (the Watched folder raises these).
  await dispatch({
    type: 'notify',
    text: 'New script added: Easter Sunday',
    durationMs: 60_000,
  });
  await sleep(500);
  await operator.screenshot({ path: join(out, 'new-script-notification.png') });
  await dispatch({ type: 'dismissNotification' });

  // Run mode, playing, with the Output on.
  await operator.getByRole('switch', { name: 'Output' }).click();
  const output = await windowTitled('Output');
  await resize('Output', 1280, 720);
  await dispatch({ type: 'setMode', mode: 'run' });
  await dispatch({ type: 'scrollBy', lines: 2 });
  await dispatch({ type: 'play' });
  await dispatch({ type: 'adjustSpeed', levels: -2 });
  await sleep(2500);
  await dispatch({ type: 'notify', text: 'Wrap up in two minutes', durationMs: 60_000 });
  await sleep(500);
  await operator.screenshot({ path: join(out, 'run-mode.png') });
  await output.screenshot({ path: join(out, 'output.png') });
  await dispatch({ type: 'pause' });
  await dispatch({ type: 'dismissNotification' });

  // Presets: one saved look per Talent.
  await dispatch({ type: 'setMode', mode: 'edit' });
  await dispatch({ type: 'setAppearance', changes: { fontSize: 96, lineSpacing: 1.5 } });
  await dispatch({ type: 'savePreset', name: 'Pastor (large)' });
  await dispatch({
    type: 'setAppearance',
    changes: { fontSize: 64, textColor: '#ffe8a3', backgroundColor: '#101820' },
  });
  await dispatch({ type: 'savePreset', name: 'Worship leader (warm)' });
  await dispatch({
    type: 'setAppearance',
    changes: { fontSize: 72, textColor: '#ffffff', backgroundColor: '#000000' },
  });
  await dispatch({ type: 'savePreset', name: 'Guest speaker' });

  // Preferences: General (the Watched folder) and Appearance, Presets.
  await menu('File', 'Preferences');
  const prefs = await windowTitled('Preferences');
  await resize('Preferences', 900, 560);
  await sleep(500);
  // Show a friendly example path instead of this run's throwaway folder.
  await prefs.evaluate((dir) => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent === dir) {
        el.textContent = '/Users/Operator/Scripts';
      }
    }
  }, drop);
  await prefs.screenshot({ path: join(out, 'preferences-watched-folder.png') });
  await prefs.getByText('Appearance', { exact: true }).first().click();
  await sleep(300);
  await prefs.getByRole('tab', { name: 'Presets' }).click();
  await sleep(400);
  await prefs.screenshot({ path: join(out, 'preferences-presets.png') });
  console.log('Screenshots written to docs/screenshots/');
} finally {
  await app.close();
  rmSync(userData, { recursive: true, force: true });
}
