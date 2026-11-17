// Explicit measurement-only server. Never imported by either product build.
import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const uiRoot=fileURLToPath(new URL('../../',import.meta.url));
const workspace=fileURLToPath(new URL('../../../../',import.meta.url));
export default defineConfig({
  root:uiRoot,
  define:{__OB_SAFE_EXPORT_VIEWER__:'false'},
  resolve:{alias:[{find:'@',replacement:fileURLToPath(new URL('../../src',import.meta.url))}],dedupe:['react','react-dom']},
  optimizeDeps:{entries:['scripts/canvas-measure/index.html']},
  server:{host:'127.0.0.1',port:5184,strictPort:true,fs:{allow:[workspace]}},
});
