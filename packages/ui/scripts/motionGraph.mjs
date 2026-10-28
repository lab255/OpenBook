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
        return {id: local, exports: [...(module?.renderedExports ?? [])].sort(), bytes, imports: imports.map(normalize),
          adopter: bytes > 0 && /^src\/(?:blockeditor|components)\//.test(local) && imports.some(dep => motionModule(normalize(dep)))};
      }).sort((a, b) => a.id.localeCompare(b.id));
      const graph = {modules};
      if (shipped) {
        const ledger = JSON.parse(readFileSync(new URL('./motionFeatures.json', import.meta.url), 'utf8'));
        assertFeatureLedger(graph, ledger);
        assertBlockOwnBytes(graph, ledger);
        const bytes = Object.values(bundle).filter(chunk => chunk.type === 'chunk').reduce((sum, chunk) => sum + Buffer.byteLength(chunk.code), 0);
        if (bytes - ledger.preAdoptionRawBytes > ledger.hardDeltaCeiling) throw new Error(`Viewer motion hard ceiling exceeded: ${bytes - ledger.preAdoptionRawBytes} > ${ledger.hardDeltaCeiling}`);
        this.info('feature ledger + block own-byte ceiling + hard ceiling passed');
      }
      this.emitFile({type: 'asset', fileName: 'motion-graph.json', source: JSON.stringify(graph, null, 2)});
    },
  };
}
