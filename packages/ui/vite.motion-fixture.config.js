import {mergeConfig} from 'vite';
import {resolve} from 'node:path';
import viewer from './vite.viewer.config.js';
export default mergeConfig(viewer, {
  build: {outDir: '../../packages/web/e2e-viewer/generated', lib: {entry: resolve(import.meta.dirname, 'src/viewer/__fixtures__/entry.ts'), fileName: () => 'motion-fixture.js'}},
});
