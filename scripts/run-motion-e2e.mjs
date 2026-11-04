import {execFileSync} from 'node:child_process';

// Keep browser provisioning with this regression so any CI caller (including
// nightly verify) works without a separate workflow permission or local cache.
const run = args => execFileSync('pnpm', args, {stdio: 'inherit'});
if (process.env.CI) {
  run(['--filter', '@book.dev/web', 'exec', 'playwright', 'install', '--with-deps', 'chromium']);
}
run(['--filter', '@book.dev/ui', 'exec', 'vitest', 'run', 'scripts/motionFixture.test.ts']);
run(['--filter', '@book.dev/web', 'exec', 'playwright', 'test', '--config', 'playwright.viewer.config.ts', 'motion-infrastructure.spec.ts']);
