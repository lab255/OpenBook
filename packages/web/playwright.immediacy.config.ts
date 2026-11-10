import {defineConfig} from '@playwright/test';
import base from './playwright.config';

const port = Number(process.env.OPENBOOK_WEB_PORT ?? 3100);
if (process.env.SINGLE_PROCESS !== '1') throw new Error('Use SINGLE_PROCESS=1 for the immediacy audit');
export default defineConfig(base, {
  metadata: {productionImmediacy: true},
  testMatch: 'immediacy-dialog.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  use: {
    baseURL: `http://localhost:${port}`, trace: 'off',
    // Reuse the committed sandbox flags; startup arming is required for the
    // screenshot category to activate in this single-process Chromium build.
    launchOptions: {args: [...(base.use?.launchOptions?.args ?? []),
      '--trace-startup=disabled-by-default-devtools.screenshot,devtools.timeline,cc,viz']},
  },
  webServer: {
    command: `pnpm --filter @book.dev/web exec next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
