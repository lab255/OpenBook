import type {PlaywrightTestConfig} from '@playwright/test';

/**
 * Multi-process Chromium cannot bootstrap its Mach-port rendezvous under the
 * macOS sandbox. SINGLE_PROCESS=1 is for agent/reviewer runs, not CI: it loses
 * parallel workers. Use --workers=1 --retries=0 and one test per --grep invocation
 * because closing a context can terminate the single-process browser.
 * Playwright creates its browser profile under TMPDIR; set that to a writable
 * directory if the sandbox's default temporary directory is not writable.
 * For a private Chromium copy, set PLAYWRIGHT_BROWSERS_PATH to a writable cache
 * containing chromium_headless_shell-1223 copied from the host Playwright cache.
 * Run e2e/run-single-process.mjs to apply the one-test-per-invocation constraint;
 * both environment paths are inherited by discovery and every test invocation.
 */
export function singleProcessConfig(): PlaywrightTestConfig {
  return process.env.SINGLE_PROCESS === '1' ? {
    workers: 1,
    retries: 0,
    use: {launchOptions: {args: ['--single-process', '--no-zygote']}},
  } : {};
}
