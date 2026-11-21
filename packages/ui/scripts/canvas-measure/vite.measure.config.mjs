// Explicit measurement-only server. Never imported by either product build.
import {sourceStamp} from './sourceStamp.mjs';
import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const uiRoot=fileURLToPath(new URL('../../',import.meta.url));
const workspace=fileURLToPath(new URL('../../../../',import.meta.url));
export default defineConfig({
  root:uiRoot,
  plugins:[{name:'canvas-measure-source',configureServer(server){server.middlewares.use('/__canvas-source',(_req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({stamp:sourceStamp()}));});}}],
  define:{__OB_SAFE_EXPORT_VIEWER__:'false',__CANVAS_SOURCE_STAMP__:JSON.stringify(sourceStamp())},
  resolve:{alias:[{find:'@',replacement:fileURLToPath(new URL('../../src',import.meta.url))}],dedupe:['react','react-dom']},
  optimizeDeps:{entries:['scripts/canvas-measure/index.html']},
  server:{host:'127.0.0.1',port:5184,strictPort:true,fs:{allow:[workspace]}},
});
