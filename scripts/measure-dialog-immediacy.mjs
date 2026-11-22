import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir, platform, arch, cpus} from 'node:os';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = join(root, '_captures/ff-immediacy-dialog', new Date().toISOString().replaceAll(':', '-'));
mkdirSync(output, {recursive: true});
const env = {...process.env, CI: 'true', SINGLE_PROCESS: '1', TMPDIR: process.env.TMPDIR ?? tmpdir()};
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit'});
  if (result.error) throw result.error;
  return result.status ?? 1;
};
// --built is for a repeated measurement of the SAME already-built revision.
// The default is the complete reviewer command, including production build.
if (!process.argv.includes('--built')) {
  const commands = [
    ['install', '--ignore-scripts'],
    ['--filter', '@book.dev/sdk', 'build'],
    ['--filter', '@book.dev/ui', 'build:viewer'],
    ['--filter', '@book.dev/server', 'build'],
    ['--filter', '@book.dev/mcp', 'build'],
    ['--filter', '@book.dev/ui', 'build'],
    ['--filter', '@book.dev/web', 'build'],
  ];
  for (const args of commands) if (run('pnpm', args)) process.exit(1);
}
const sha = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).stdout.trim();
writeFileSync(join(output, 'environment.json'), JSON.stringify({sha, platform: platform(), arch: arch(),
  cpu: cpus()[0]?.model, node: process.version, built: process.argv.includes('--built')}, null, 2));
let failures = 0;
for (const width of [1280, 390]) {
  // One test per process, exactly as the committed sandbox harness requires.
  failures += Number(run('pnpm', ['exec', 'playwright', 'test', '-c', 'playwright.immediacy.config.ts',
    '--workers=1', '--retries=0', '--grep', `at ${width}$`, '--reporter=list', '--output', join(output, String(width))],
  join(root, 'packages/web')) !== 0);
}
console.log(`Immediacy artifacts: ${output}\n${failures} viewport gate(s) failed. Review every filmstrip before clearing this card.`);
process.exitCode = failures ? 1 : 0;
