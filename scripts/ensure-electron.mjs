// npm can skip Electron's install script, leaving no binary. Install it when it is missing.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('node_modules/electron/path.txt')) {
  console.log('Electron binary missing: installing it');
  execFileSync(process.execPath, ['node_modules/electron/install.js'], { stdio: 'inherit' });
}

// On macOS the menu bar and Dock name an app after its bundle, and Electron's own says "Electron".
// A packaged build is named by `productName`; this names the one `npm start` runs, to match.
const plist = 'node_modules/electron/dist/Electron.app/Contents/Info.plist';
if (process.platform === 'darwin' && existsSync(plist)) {
  for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
    execFileSync('plutil', ['-replace', key, '-string', 'NeoPrompter', plist]);
  }
}
