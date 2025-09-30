import { spawnSync } from 'node:child_process';
import { env, exit, platform } from 'node:process';

if (env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1') {
  console.log('[postinstall] Skipping Playwright browser download because PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1');
  exit(0);
}

const npxBinary = platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['playwright', 'install'];

console.log('[postinstall] Installing Playwright browsers…');
const result = spawnSync(npxBinary, args, {
  stdio: 'inherit',
});

if (result.status === 0) {
  console.log('[postinstall] Playwright browsers installed successfully.');
  exit(0);
}

console.warn('[postinstall] Playwright browser installation failed.');
console.warn('[postinstall] You can retry manually with "npx playwright install" once network access is available.');
exit(0);
