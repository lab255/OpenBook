import {expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ledger from './motionFeatures.json';
import baseline from './viewerMotionBaseline.json';
import {assertFeatureLedger, assertBlockOwnBytes} from './motionGraph.mjs';

const readGraph = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const productionGraph = readGraph('src/export/vendor/motion-graph.json');
it('requires a ledger row for every emitted Motion module and export', () => {
  assertFeatureLedger(productionGraph, ledger);
  expect(() => assertFeatureLedger(productionGraph, {...ledger, features: ledger.features.filter(feature => feature.name !== 'renderer')})).toThrow('Unledgered motion feature');
  const bytes = readFileSync('src/export/vendor/openbook-viewer.js').byteLength;
  expect(ledger.hardDeltaCeiling).toBe(baseline.maxDeltaBytes);
  expect(bytes - ledger.preAdoptionRawBytes, 'ledger changes must still respect the total ceiling').toBeLessThanOrEqual(ledger.hardDeltaCeiling);
  for (const feature of ledger.features) expect(feature.afterRawBytes - feature.beforeRawBytes).toBe(feature.rawCostBytes);
  process.stdout.write('FEATURE LEDGER removed renderer row RED; emitted module/export inventory GREEN\n');
});

it('calibrates actual ordinary and eager/layout additions independently of own bytes', () => {
  const results: Record<string, {bytes: number; ownBytes: number}> = {};
  for (const mode of ['ordinary', 'layout']) {
    execFileSync('pnpm', ['exec', 'vite', 'build', '--config', 'vite.motion-calibration.config.js', '--mode', mode], {env: {...process.env, NODE_ENV: 'production'}});
    const directory = `../web/e2e-viewer/generated/calibration-${mode}`;
    const graph = readGraph(`${directory}/motion-graph.json`);
    const bytes = readFileSync(`${directory}/openbook-viewer.js`).byteLength;
    const block = graph.modules.find((module: {adopter: boolean}) => module.adopter);
    expect(block, 'calibration block must be recognized as an adopter').toBeTruthy();
    assertBlockOwnBytes(graph, ledger);
    if (mode === 'ordinary') assertFeatureLedger(graph, ledger);
    else expect(() => assertFeatureLedger(graph, ledger)).toThrow('Unledgered motion feature');
    results[mode] = {bytes, ownBytes: block.bytes};
  }
  // Marginal calibration uses today's production bytes, not historical costs.
  const seeded = readFileSync('src/export/vendor/openbook-viewer.js').byteLength;
  expect(results.ordinary.bytes - seeded).toBeLessThan(2048);
  expect(results.layout.bytes - seeded).toBeGreaterThan(2048);
  process.stdout.write(`CALIBRATION seeded=${seeded}; ordinary=${results.ordinary.bytes} marginal=${results.ordinary.bytes - seeded} own=${results.ordinary.ownBytes}; eager/layout=${results.layout.bytes} marginal=${results.layout.bytes - seeded} own=${results.layout.ownBytes}; ordinary ledger GREEN, eager/layout unledgered RED\n`);
}, 30000);

it('charges newly imported non-motion helpers to a block, not shared machinery', () => {
  const block = {id: 'src/blockeditor/new.tsx', exports: [], bytes: 100, imports: ['large-helper'], adopter: true};
  const facade = {id: 'facade', exports: [], bytes: 0, imports: ['large-helper'], adopter: false};
  const helper = {id: 'large-helper', exports: [], bytes: 1948, imports: [], adopter: false};
  expect(() => assertBlockOwnBytes({modules: [block, helper]}, ledger)).not.toThrow();
  expect(() => assertBlockOwnBytes({modules: [block, {...helper, bytes: 1949}]}, ledger)).toThrow('Block own bytes src/blockeditor/new.tsx: 2049 > 2048');
  expect(() => assertBlockOwnBytes({modules: [{...block, imports: ['facade']}, facade, {...helper, bytes: 1949}]}, ledger)).toThrow('2049 > 2048');
  process.stdout.write('BLOCK OWN BYTES 2048 GREEN; imported helper raises total to 2049 RED\n');
});
