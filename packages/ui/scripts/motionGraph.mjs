import {readFileSync} from 'node:fs';

export const motionModule = id => /^(?:motion|framer-motion|motion-dom|motion-utils)\//.test(id);
const normalize = id => id.replaceAll('\\', '/').split('/node_modules/').pop().replace(/^.*\/packages\/([^/]+)\//, (_match, workspace) => workspace === 'ui' ? '' : `workspace/${workspace}/`);

export function assertFeatureLedger(graph, ledger) {
  const known = new Map();
  for (const feature of ledger.features) {
    for (const module of feature.modules) {
      const exports = known.get(module.id) ?? new Set();
      module.exports.forEach(name => exports.add(name));
      known.set(module.id, exports);
    }
  }
  for (const module of graph.modules.filter(module => module.bytes > 0 && motionModule(module.id))) {
    if (!known.has(module.id)) throw new Error(`Unledgered motion feature module: ${module.id}`);
    for (const name of module.exports) {
      // Intrinsic tags share the already-seeded renderer, not new features.
      const key = module.id === 'framer-motion/dist/es/render/components/m/elements.mjs' && /^Motion[A-Z]/.test(name) ? 'MotionElement' : name;
      if (!known.get(module.id).has(key)) throw new Error(`Unledgered motion feature export: ${module.id}#${name}`);
    }
  }
}

/** Feature rows retain their historical whole-IIFE costs. Only the measured
 * non-Motion shrinkage window may separate the last row from today's artifact.
 * Exact Motion bytes and module/export coverage prevent that window from
 * becoming an allowance for new Motion features.
 */
export function assertLedgerEndpoint(graph, bytes, ledger) {
  assertFeatureLedger(graph, ledger);
  const motionBytes = graph.modules.filter(module => motionModule(module.id)).reduce((sum, module) => sum + module.bytes, 0);
  if (motionBytes !== ledger.endpoint.motionRenderedBytes) {
    throw new Error(`ledger endpoint: Motion rendered bytes ${motionBytes} != ${ledger.endpoint.motionRenderedBytes}`);
  }
  const historical = ledger.features.at(-1).afterRawBytes;
  const minimum = historical - ledger.endpoint.nonMotionShrinkageBytes;
  const maximum = historical + ledger.endpoint.nonMotionGrowthBytes;
  if (bytes < minimum || bytes > maximum) {
    throw new Error(`ledger endpoint: production bytes ${bytes} outside non-motion window ${minimum}..${maximum}`);
  }
}

export function assertBlockOwnBytes(graph, ledger) {
  const shared = new Set(ledger.sharedModules);
  const modules = new Map(graph.modules.map(module => [module.id, module]));
  for (const block of graph.modules.filter(module => module.adopter)) {
    const seen = new Set();
    function ownBytes(id, root = false) {
      if (seen.has(id) || motionModule(id) || (!root && shared.has(id))) return 0;
      seen.add(id);
      const module = modules.get(id);
      return module ? module.bytes + module.imports.reduce((sum, next) => sum + ownBytes(next), 0) : 0;
    }
    const bytes = ownBytes(block.id, true);
    if (bytes > ledger.blockOwnBytesCeiling) throw new Error(`Block own bytes ${block.id}: ${bytes} > ${ledger.blockOwnBytesCeiling}`);
  }
}

/** Non-Motion rows itemize consumption; they never re-anchor the window. */
export function assertEndpointConsumers(bytes, ledger, graph) {
  if (graph) assertEndpointOwnership(graph, ledger);
  const names = new Set();
  const total = ledger.endpointConsumers.reduce((sum, row) => {
    if (names.has(row.name) || !Number.isSafeInteger(row.rawCostBytes) || !row.measuredAt || !row.mechanism) {
      throw new Error(`Invalid endpoint consumer: ${row.name}`);
    }
    names.add(row.name);
    return sum + row.rawCostBytes;
  }, 0);
  const coordinate = bytes - ledger.features.at(-1).afterRawBytes;
  if (total !== coordinate) throw new Error(`Endpoint consumers ${total} != measured coordinate ${coordinate}`);
}

/** Ownership is module space, NOT an allocation of final minified IIFE bytes.
 * Inherited infrastructure has an owner too, so subsequent consumers reference
 * shared modules through usesModules without charging their ownership twice. */
export function assertEndpointOwnership(graph, ledger) {
  const owners = new Map();
  for (const row of ledger.endpointConsumers) {
    for (const id of row.modules) {
      if (owners.has(id)) throw new Error(`Module ${id} claimed twice: ${owners.get(id)} and ${row.name}`);
      if (motionModule(id)) throw new Error(`Motion module ${id} cannot be owned by a non-Motion consumer`);
      owners.set(id, row.name);
    }
  }
  const missing = new Map();
  for (const module of graph.modules) if (module.bytes > 0 && !motionModule(module.id) && !owners.has(module.id)) {
    missing.set(module.id, (missing.get(module.id) ?? 0) + module.bytes);
  }
  if (missing.size) throw new Error([...missing].map(([id, bytes]) =>
    `Unclaimed module ${id}: ${bytes} rendered B (pre-final-minification); no consumer row claims it`).join('\n'));
  for (const row of ledger.endpointConsumers) for (const id of row.usesModules ?? []) {
    if (!owners.has(id)) throw new Error(`Consumer ${row.name} references unowned shared module ${id}`);
  }
}

/** 256KB chosen 2026-10-28, owner direct confirmation: protects shareability,
 * not subset purity. The 1.92MB raw/~500KB gz viewer is already shareable;
 * room for layout-class features (~48KB) does not change its order of magnitude.
 * Re-evaluate when transport expectations change. The ledger owns the number.
 */
export function assertViewerCeiling(bytes, ledger) {
  if (bytes - ledger.preAdoptionRawBytes > ledger.hardDeltaCeiling) {
    throw new Error(`viewer bundle exceeds the transportability ceiling (${ledger.hardDeltaCeiling / 1024}KB raw over baseline) — exports must stay small enough to share. Actual delta: ${bytes - ledger.preAdoptionRawBytes} raw bytes.`);
  }
}

/** Rolldown's emitted chunk modules exclude tree-shaken code. Feature identity
 * uses package-relative module paths plus rendered exports, not import spelling.
 * Own bytes are UTF-8 rendered module code plus new non-motion dependencies;
 * baseline shared modules and ledgered Motion machinery are accounted separately.
 */
export function motionGraph() {
  let shipped = false;
  return {
    name: 'openbook-motion-graph',
    enforce: 'post',
    configResolved(config) {
      shipped = config.mode === 'production' && String(config.build.lib.entry).endsWith('src/viewer/index.tsx');
    },
    generateBundle(_options, bundle) {
      const emitted = new Map(Object.values(bundle).filter(chunk => chunk.type === 'chunk').flatMap(chunk => Object.entries(chunk.modules)));
      // Keep zero-code re-export barrels as traversal edges: otherwise a new
      // helper imported through a tree-shaken facade could escape own-byte cost.
      const modules = [...this.getModuleIds()].map(id => {
        const module = emitted.get(id);
        const bytes = Buffer.byteLength(module?.code ?? '');
        const imports = this.getModuleInfo(id)?.importedIds ?? [];
        const local = normalize(id);
        // Amended 2026-10-29 (FluidHover: 3,977 own bytes): the 2,048 cap
        // tests marginality: cost of the NEXT block, our unit of repetition
        // (89 × 2KB). Chrome is singular infrastructure in the bundle, so
        // per-block charging asks a question chrome never poses. Chrome is
        // governed by assertFeatureLedger + assertViewerCeiling; both bite.
        // Direct adopters = src/blockeditor. Transitive helper charging stays:
        // block -> src/components helper -> new non-Motion code is charged;
        // Motion features remain separately ledgered, never free/exempt.
        return {id: local, exports: [...(module?.renderedExports ?? [])].sort(), bytes, imports: imports.map(normalize),
          adopter: bytes > 0 && /^src\/blockeditor\//.test(local) && imports.some(dep => motionModule(normalize(dep)))};
      }).sort((a, b) => a.id.localeCompare(b.id));
      const graph = {modules};
      if (shipped) {
        const ledger = JSON.parse(readFileSync(new URL('./motionFeatures.json', import.meta.url), 'utf8'));
        assertFeatureLedger(graph, ledger);
        assertBlockOwnBytes(graph, ledger);
        const bytes = Object.values(bundle).filter(chunk => chunk.type === 'chunk').reduce((sum, chunk) => sum + Buffer.byteLength(chunk.code), 0);
        assertViewerCeiling(bytes, ledger);
        this.info('feature ledger + block own-byte ceiling + hard ceiling passed');
      }
      this.emitFile({type: 'asset', fileName: 'motion-graph.json', source: JSON.stringify(graph, null, 2)});
    },
  };
}
