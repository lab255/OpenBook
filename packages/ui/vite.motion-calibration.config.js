import {mergeConfig} from 'vite';
import {resolve} from 'node:path';
import viewer from './vite.viewer.config.js';

// Ordered one-time feature measurements. Does not update the committed ledger.
export default ({mode}) => mergeConfig(viewer, {
  plugins: [{
    name: 'motion-calibration', enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/src/viewer/index.tsx') && ['ordinary', 'layout'].includes(mode)) {
        const name = mode === 'ordinary' ? 'MotionBudgetOrdinary' : 'MotionBudgetLayout';
        return {code: code + `\nimport '../blockeditor/__fixtures__/${name}';`, map: null};
      }
      if (!id.endsWith('/src/viewer/MotionProvider.tsx')) return;
      if (mode === 'lazyRuntime') return {code: "import {LazyMotion} from 'motion/react'; export function MotionProvider({children}) { return <LazyMotion features={{}}>{children}</LazyMotion>; }", map: null};
      if (mode === 'domAnimation') return {code: "import {LazyMotion, domAnimation} from 'motion/react'; export function MotionProvider({children}) { return <LazyMotion features={domAnimation}>{children}</LazyMotion>; }", map: null};
      return {code, map: null};
    },
  }],
  build: {outDir: resolve(import.meta.dirname, `../web/e2e-viewer/generated/calibration-${mode}`)},
});
