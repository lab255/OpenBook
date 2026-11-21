import config from './playwright.config';
import {defineConfig} from '@playwright/test';

// The approved production recipe binds IPv4 loopback explicitly. Assert the
// same host here so localhost's IPv6 resolution cannot select a stale server.
const url='http://127.0.0.1:3195';
export default defineConfig({...config,
  use:{...config.use,baseURL:url,screenshot:'off',trace:'off',video:'off'},
  webServer:{command:'pnpm --filter @book.dev/web exec next start -H 127.0.0.1 -p 3195',url,reuseExistingServer:true},
});
