import {defineConfig, devices} from '@playwright/test';
import {singleProcessConfig} from './e2e/single-process';

const port = Number(process.env.OPENBOOK_WEB_PORT ?? 3210);
export default defineConfig({
  testDir: './e2e', testMatch: 'slash-polish.spec.ts',
  workers: 1, retries: 0, timeout: 90_000,
  use: {baseURL: `http://localhost:${port}`, ...devices['Desktop Chrome'],
    video: {mode: 'on', size: {width: 1280, height: 800}}},
  webServer: {
    command: `pnpm exec next dev -p ${port}`,
    url: `http://localhost:${port}/editor-lab`, reuseExistingServer: true,
  },
}, singleProcessConfig());
