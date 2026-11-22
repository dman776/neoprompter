// npm can skip Electron's install script, leaving no binary. Install it when it is missing.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('node_modules/electron/path.txt')) {
  console.log('Electron binary missing: installing it');
  execFileSync(process.execPath, ['node_modules/electron/install.js'], { stdio: 'inherit' });
}
