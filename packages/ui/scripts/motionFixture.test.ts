import {expect, it, vi} from 'vitest';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

// Substitute only the bundled viewer bytes. The real toHtml assembler, static
// projection, source island, CSP hashing and boot script are all exercised.
vi.mock('../src/export/vendor/openbook-viewer.js?raw', () => {
  execFileSync('pnpm', ['exec', 'vite', 'build', '--config', 'vite.motion-fixture.config.js'], {env: {...process.env, NODE_ENV: 'production'}});
  return {default: readFileSync('../web/e2e-viewer/generated/motion-fixture.js', 'utf8')};
});
import {toHtml} from '../src/export/toHtml';

it('emits the full test-only block chain through toHtml', () => {
  const snapshot = {editor: 'blocks' as const, blockdoc: {v: 1 as const, blocks: [{id: 'ff6', type: 'ff6/fixture', text: [{t: 'FF6 fixture'}]}]}};
  const html = toHtml(snapshot, 'FF6 fixture', '');
  expect(html).toContain('data-block-type="ff6/fixture"');
  expect(html).toContain('Move fixture');
  expect(html).toContain('data-ob-hydrated');
  mkdirSync('../web/e2e-viewer/generated', {recursive: true});
  writeFileSync('../web/e2e-viewer/generated/motion.html', html);
});
