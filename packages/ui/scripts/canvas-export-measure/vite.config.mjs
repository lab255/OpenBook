import {defineConfig} from 'vite';
import {motionGraph} from '../motionGraph.mjs';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sources=['../../src/viewer/CanvasViewer.tsx','../../src/viewer/canvasPaint.ts','../../src/viewer/canvasCamera.ts','../../src/viewer/canvasScene.ts','../../src/export/canvasStatic.ts','../../src/export/canvasPdf.ts','../../src/export/toHtml.ts','../../src/export/vendor/openbook-viewer.js','../../src/export/staticMarker.ts','../../src/export/exportLedgerReports.ts','../../src/export/canvasMarkdown.ts','../../src/export/documentModel.ts','../../src/blockeditor/exportBlocks.ts','../../src/screens/BlockPageDocument.tsx','./exportFixture.ts','./interop.ts','../../src/export/toPdf.ts'];
const stamp=Object.fromEntries(sources.map(path=>[path,createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex')]));
export default defineConfig({plugins:[motionGraph()],define:{__OB_SAFE_EXPORT_VIEWER__:'false',__CANVAS_EXPORT_BUILD__:JSON.stringify(stamp)},root:fileURLToPath(new URL('./',import.meta.url)),resolve:{alias:{'@':fileURLToPath(new URL('../../src',import.meta.url))}},build:{outDir:'dist',emptyOutDir:true},server:{host:'127.0.0.1',port:5186,strictPort:true},preview:{host:'127.0.0.1',port:5186,strictPort:true}});
