/** Explicit measurement only; leaves production configs unchanged. Run from packages/ui. */
import {build} from 'vite';
import {writeFileSync,readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
const results=[];
for(const lane of ['viewer','app']) {
  await build({configFile:resolve(lane==='viewer'?'vite.viewer.config.js':'vite.config.js'),plugins:[{
    name:'canvas-measure-graph-inspection',
    generateBundle(){
      const modules=[...this.getModuleIds()].map(id=>id.replaceAll('\\','/'));
      const measurement=modules.filter(id=>id.includes('/scripts/canvas-measure/'));
      const canvas=modules.filter(id=>id.includes('/src/blockeditor/canvas/'));
      const remote=modules.filter(id=>id.endsWith('/src/blockeditor/remoteFrame.ts'));
      if(measurement.length||lane==='viewer'&&(canvas.length||remote.length))throw new Error('Canvas measurement/editing module crossed a production boundary');
      if(lane==='app'&&!canvas.some(id=>id.endsWith('/CanvasBlock.tsx')))throw new Error('App omitted CanvasBlock');
      results.push({lane,moduleCount:modules.length,measurement,canvas,remote,modules});
    }
  }]});
}
const path='src/export/vendor/openbook-viewer.js',bytes=statSync(path).size;
const viewerSource=readFileSync(path,'utf8');
const canvasCatalogueCost=bytes-1933155;
if(canvasCatalogueCost>100||viewerSource.includes('Canvas schema version.')||viewerSource.includes('Inline drawing canvas.'))throw new Error('Editing-grade canvas catalogue leaked into placeholder viewer');
const ledger=JSON.parse(readFileSync('scripts/motionFeatures.json','utf8'));
const coordinate=bytes-ledger.features.at(-1).afterRawBytes;
const result={buildMode:'production, unchanged Vite configs plus read-only graph inspection plugin',path,bytes,coordinate,canvasCatalogueCost,mtime:statSync(path).mtime.toISOString(),results};
writeFileSync(resolve(process.argv[2]??'../../_evidence-build4','production-graphs.json'),JSON.stringify(result,null,2)+'\n');
if(coordinate-Number(process.argv[3]??765)>300)throw new Error('Shared seam exceeded 300 B growth');
console.log(JSON.stringify({bytes,coordinate,lanes:results.map(({lane,moduleCount,measurement,canvas,remote})=>({lane,moduleCount,measurement,canvas,remote}))}));
