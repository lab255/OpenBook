import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Run from any directory, e.g. SINGLE_PROCESS=1 node
// packages/web/e2e/run-single-process.mjs --config playwright.viewer.config.ts motion-infrastructure.spec.ts
// Generate the motion fixture first with:
// pnpm --filter @book.dev/ui exec vitest run scripts/motionFixture.test.ts
// Each test gets its own browser process: single-process Chromium cannot reuse
// the browser after a context closes. Keep running after failures; skip nothing.
if (process.env.SINGLE_PROCESS !== '1') throw new Error('Set SINGLE_PROCESS=1 to use this reviewer runner.');
const cwd = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const run = (extra, stdio) => spawnSync('pnpm', ['exec', 'playwright', 'test', ...args, ...extra], {
  cwd, env: process.env, encoding: 'utf8', stdio,
});
const listed = run(['--list', '--reporter=json'], 'pipe');
if (listed.status !== 0) {
  process.stderr.write(listed.stderr ?? '');
  process.stdout.write(listed.stdout ?? '');
  process.exit(listed.status ?? 1);
}
const report = JSON.parse(listed.stdout);
if (report.errors?.length) throw new Error(JSON.stringify(report.errors));
const tests = [];
function collect(suites, parents = []) {
  for (const suite of suites) {
    const titles = [...parents, suite.title];
    for (const spec of suite.specs ?? []) for (const test of spec.tests) {
      tests.push({title: [...titles, spec.title].join(' '), project: test.projectName});
    }
    collect(suite.suites ?? [], titles);
  }
}
collect(report.suites);
if (!tests.length) throw new Error('No tests selected.');
let failed = 0;
for (const test of tests) {
  const escaped = test.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const result = run(['--project', test.project, '--grep', `${escaped}$`, '--workers=1', '--retries=0', '--reporter=list'], 'inherit');
  if (result.status !== 0) failed++;
}
console.log(`Single-process invocations: ${tests.length - failed} passed, ${failed} failed (${tests.length} total).`);
process.exitCode = failed ? 1 : 0;
