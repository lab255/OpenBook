import {mergeConfig} from 'vite';
import {resolve} from 'node:path';
import viewer from './vite.viewer.config.js';

// Ordered one-time feature measurements. Does not update the committed ledger.
export default ({mode}) => mergeConfig(viewer, {
  plugins: [{
    name: 'motion-calibration', enforce: 'pre',
    transform(code, id) {
      // Test-only ordered FF-4/FF-6 seam measurements; never used in production.
      if (id.endsWith('/src/components/ui/fluid-hover.tsx') && mode.startsWith('ff46-')) {
        if (mode === 'ff46-before') return {code: 'export function FluidHover() { return null; }', map: null};
        if (mode === 'ff46-eager') return {code: code.replace("import * as m from 'motion/react-m';", "import {motion as m} from 'motion/react';"), map: null};
        if (['ff46-shell', 'ff46-values', 'ff46-reduced'].includes(mode)) {
          code = code.replace('return animate(value, next, spring.moderate);', 'value.jump(next); return;');
          if (mode !== 'ff46-reduced') code = code.replace('const reduced = useReducedMotion();', 'const reduced = false;');
          if (mode === 'ff46-shell') code = code.replaceAll('useMotionValue(0)', 'React.useMemo(() => ({jump() {}}), [])').replace('zIndex: -1, x, y, width, height, opacity:', 'zIndex: -1, opacity:');
        }
        return {code, map: null};
      }
      if (id.endsWith('/src/viewer/index.tsx') && mode === 'treeShaken') return {code: code + "\nimport {motion as unusedMotion} from 'motion/react';", map: null};
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
