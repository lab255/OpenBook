import {expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ledger from './motionFeatures.json';
import baseline from './viewerMotionBaseline.json';
import {assertFeatureLedger, assertBlockOwnBytes, assertViewerCeiling, assertLedgerEndpoint, assertEndpointConsumers, assertEndpointOwnership, motionModule} from './motionGraph.mjs';

const readGraph = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const productionGraph = readGraph('src/export/vendor/motion-graph.json');
it('itemizes the measured non-Motion coordinate with zero tolerance without moving the anchor', () => {
  const bytes = readFileSync('src/export/vendor/openbook-viewer.js').byteLength;
  expect(ledger.features.at(-1)!.afterRawBytes).toBe(1932375);
  assertEndpointConsumers(bytes, ledger, productionGraph);
  expect(() => assertEndpointConsumers(bytes + 1, ledger)).toThrow('measured coordinate');
  expect(() => assertEndpointConsumers(bytes - 1, ledger)).toThrow('measured coordinate');
  const missing = {...ledger, endpointConsumers: ledger.endpointConsumers.slice(1)};
  expect(() => assertEndpointConsumers(bytes, missing)).toThrow('measured coordinate');
  // Signed recovery rows are legal; offsetting itemization must preserve the sum.
  assertEndpointConsumers(bytes, {...ledger, endpointConsumers: [...ledger.endpointConsumers,
    {name: 'control-growth', rawCostBytes: 1, measuredAt: 'fixture', mechanism: 'control'},
    {name: 'control-recovery', rawCostBytes: -1, measuredAt: 'fixture', mechanism: 'control'},
  ]});
});
it('diagnoses module ownership in rendered units and counts shared modules once', () => {
  const first = {name:'first',modules:['shared'],usesModules:[]};
  const second = {name:'second',modules:['consumer'],usesModules:['shared']};
  const rows = {endpointConsumers:[first,second]};
  const graph = {modules:[{id:'shared',bytes:73},{id:'consumer',bytes:41}]};
  assertEndpointOwnership(graph,rows);
  assertEndpointOwnership({modules:[...graph.modules,{id:'shared',bytes:29}]},rows);
  expect(() => assertEndpointOwnership({modules:[{id:'unclaimed',bytes:3},{id:'unclaimed',bytes:7}]},rows))
    .toThrow('Unclaimed module unclaimed: 10 rendered B (pre-final-minification)');
  expect(() => assertEndpointOwnership({...graph,modules:[...graph.modules,{id:'new-viewer-module',bytes:83}]},rows))
    .toThrow('Unclaimed module new-viewer-module: 83 rendered B (pre-final-minification)');
  expect(() => assertEndpointOwnership(graph,{endpointConsumers:[first,{...second,modules:['consumer','shared']}]}))
    .toThrow('Module shared claimed twice: first and second');
  expect(() => assertEndpointOwnership(graph,{endpointConsumers:[first,{...second,usesModules:['unknown']}]}))
    .toThrow('references unowned shared module unknown');
  // Tree-shaken modules have no rendered contribution; no invented byte charge.
  assertEndpointOwnership({modules:[...graph.modules,{id:'discarded',bytes:0}]},rows);
});
it('requires a ledger row for every emitted Motion module and export', () => {
  assertFeatureLedger(productionGraph, ledger);
  expect(() => assertFeatureLedger(productionGraph, {...ledger, features: ledger.features.filter(feature => feature.name !== 'renderer')})).toThrow('Unledgered motion feature');
  const bytes = readFileSync('src/export/vendor/openbook-viewer.js').byteLength;
  expect(ledger.preAdoptionRawBytes).toBe(baseline.rawBytes);
  expect(ledger.preAdoptionRawBytes).toBe(1846513);
  expect(ledger.blockOwnBytesCeiling).toBe(2048);
  expect(ledger.hardDeltaCeiling).toBe(262144);
  expect(ledger.calibration.seededProductionRawBytes).toBe(1922068);
  assertViewerCeiling(bytes, ledger);
  expect(() => assertViewerCeiling(1846513 + 262144 + 1, ledger)).toThrow('transportability ceiling');
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
    const block = graph.modules.find((module: {adopter: boolean}) => module.adopter && module.id.includes('MotionBudget'));
    expect(block, 'calibration block must be recognized as an adopter').toBeTruthy();
    assertBlockOwnBytes(graph, ledger);
    if (mode === 'ordinary') assertFeatureLedger(graph, ledger);
    else {
      expect(() => assertFeatureLedger(graph, ledger)).toThrow('Unledgered motion feature');
      // Even if non-motion savings hid the raw growth inside the window,
      // this genuine eager/layout build must fail feature authorization.
      expect(() => assertLedgerEndpoint(graph, ledger.features.at(-1)!.afterRawBytes - 506, ledger)).toThrow('Unledgered motion feature');
    }
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

it('records the tree-shaken eager-import gap after the policy change', () => {
  execFileSync('pnpm', ['exec', 'vite', 'build', '--config', 'vite.motion-calibration.config.js', '--mode', 'treeShaken'], {env: {...process.env, NODE_ENV: 'production'}});
  const directory = '../web/e2e-viewer/generated/calibration-treeShaken';
  const graph = readGraph(`${directory}/motion-graph.json`);
  assertFeatureLedger(graph, ledger);
  const bytes = readFileSync(`${directory}/openbook-viewer.js`).byteLength;
  expect(bytes).toBe(readFileSync('src/export/vendor/openbook-viewer.js').byteLength);
  process.stdout.write(`TREE-SHAKEN GAP unchanged: unused eager import emitted no additional bytes (${bytes}); no feature-ledger failure, intentionally recorded\n`);
}, 30000);

// Build:viewer runs before this test in verify; inspect its real bundled chrome,
// not a synthetic graph that omits shared select/dropdown/command dependencies.
it('checks the complete emitted Motion closure transitively reachable from the viewer entry, including chrome', () => {
  const byId = new Map<string, {id: string; imports: string[]; bytes: number; exports: string[]}>(productionGraph.modules.map((module: {id: string}) => [module.id, module]));
  const reached = new Set<string>();
  function visit(id: string) {
    if (reached.has(id)) return;
    reached.add(id);
    byId.get(id)?.imports.forEach(visit);
  }
  visit('src/viewer/index.tsx');
  expect(reached.has('src/components/ui/fluid-hover.tsx')).toBe(true);
  // Editing registrations belong to the app wrapper, never the viewer graph.
  expect(reached.has('src/blockeditor/reactiveCore.tsx')).toBe(true);
  const readOnlyCanvas = new Set(['src/blockeditor/canvas/schema.ts','src/blockeditor/canvas/geometry.ts','src/blockeditor/canvas/strokeCurve.ts']);
  expect(productionGraph.modules.some((module: {id: string}) =>
    module.id === 'src/blockeditor/reactiveBlocks.tsx' || (module.id.startsWith('src/blockeditor/canvas/') && !readOnlyCanvas.has(module.id)))).toBe(false);
  const schema = productionGraph.modules.find((module: {id:string}) => module.id === 'src/blockeditor/canvas/schema.ts');
  for(const authoring of ['createShape','createCanvasProps','constructCanvasProps','isEditableCanvas','isEditableShape','pointData'])expect(schema.exports).not.toContain(authoring);
  expect(productionGraph.modules.some((module:{id:string;bytes:number}) => module.id === 'src/export/canvasStatic.ts' && module.bytes > 0)).toBe(false);
  for (const module of productionGraph.modules.filter((module: {id: string; bytes: number}) => module.bytes > 0 && /^(motion|framer-motion|motion-dom|motion-utils)\//.test(module.id))) {
    expect(reached.has(module.id), module.id).toBe(true);
    // Every emitted module is independently covered; deleting its authorization
    // must fail even if it arrived through an arbitrary shared-chrome helper.
    const missing = {...ledger, features: ledger.features.map(feature => ({...feature, modules: feature.modules.filter(row => row.id !== module.id)}))};
    expect(() => assertFeatureLedger(productionGraph, missing), module.id).toThrow('Unledgered motion feature');
  }
  const fluid = productionGraph.modules.find((module: {id: string}) => module.id === 'src/components/ui/fluid-hover.tsx');
  expect(fluid.adopter).toBe(false); // Chrome infrastructure, not a block.
  assertFeatureLedger(productionGraph, ledger);
  for (const name of ['useMotionValue', 'useReducedMotion', 'animate']) {
    expect(() => assertFeatureLedger(productionGraph, {...ledger, features: ledger.features.filter(feature => feature.name !== name)})).toThrow('Unledgered motion feature');
    process.stdout.write(`CHROME SEAM ${name}: removed row RED; measured production graph GREEN\n`);
  }
  expect(productionGraph.modules.filter((module: {id: string; bytes: number}) => module.bytes > 0 && module.id.includes('/render/components/motion/'))).toEqual([]);
});

it('keeps historical rows continuous and bounds non-motion drift at the measured endpoint', () => {
  const measured = readFileSync('src/export/vendor/openbook-viewer.js').byteLength;
  const assertChain = (rows: readonly {name: string; beforeRawBytes: number; afterRawBytes: number}[]) => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].beforeRawBytes, 'ledger chain: baseline').toBe(ledger.preAdoptionRawBytes);
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i].afterRawBytes, `ledger chain: ${rows[i].name} -> ${rows[i + 1].name}`).toBe(rows[i + 1].beforeRawBytes);
    }
  };
  const broken = ledger.features.map(row => row.name === 'fluidHover' ? {...row, afterRawBytes: row.afterRawBytes + 1} : row);
  expect(() => assertChain(broken)).toThrow('ledger chain: fluidHover -> useMotionValue');
  assertChain(ledger.features);
  assertLedgerEndpoint(productionGraph, measured, ledger);
  process.stdout.write(`LEDGER CHAIN broken fluidHover endpoint 1925112 RED; baseline ${ledger.preAdoptionRawBytes} -> all adjacent rows -> bounded measured ${measured} GREEN\n`);
});

it('accepts only the authorized non-motion window, never unledgered Motion or extra Motion bytes', () => {
  const historical = ledger.features.at(-1)!.afterRawBytes;
  expect(ledger.endpoint.nonMotionShrinkageBytes).toBe(506);
  expect(ledger.endpoint.nonMotionGrowthBytes).toBe(9413);
  for (const bytes of [historical, historical - 506, historical + 9413]) {
    expect(() => assertLedgerEndpoint(productionGraph, bytes, ledger)).not.toThrow();
  }
  for (const bytes of [historical + 9414, historical - 507]) {
    expect(() => assertLedgerEndpoint(productionGraph, bytes, ledger)).toThrow('outside non-motion window');
  }
  const changed = {modules: productionGraph.modules.map((module: {id: string; bytes: number}) =>
    motionModule(module.id) && module.bytes > 0 ? {...module, bytes: module.bytes + 1} : module)};
  expect(() => assertLedgerEndpoint(changed, historical - 506, ledger)).toThrow('Motion rendered bytes');
  // Real emitted module, removed authorization: even a bundle inside the
  // allowed window must still reject an unledgered Motion feature.
  const missing = {...ledger, features: ledger.features.map(feature => feature.name === 'animate' ? {...feature, modules: []} : feature)};
  expect(() => assertLedgerEndpoint(productionGraph, historical - 506, missing)).toThrow('Unledgered motion feature');
  process.stdout.write(`ENDPOINT ${historical - 506} and ${historical + 9413} GREEN; ${historical + 9414} and ${historical - 507} RED; changed Motion bytes RED; unledgered animate within window RED\n`);
});
