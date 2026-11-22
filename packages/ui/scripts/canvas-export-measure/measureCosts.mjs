import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../../',import.meta.url)),output=process.env.BUILD6_COST_OUTPUT;
const measure=()=>{const bytes=readFileSync(`${cwd}src/export/vendor/openbook-viewer.js`),graph=JSON.parse(readFileSync(`${cwd}src/export/vendor/motion-graph.json`));return {rawBytes:bytes.length,coordinate:bytes.length-1932375,sha256:createHash('sha256').update(bytes).digest('hex'),motionRenderedBytes:graph.modules.filter(m=>/^(motion|motion-dom|motion-utils|framer-motion)\//.test(m.id)).reduce((sum,m)=>sum+m.bytes,0)};};
const build=(mode)=>{
 for(const name of ['openbook-viewer.js','motion-graph.json'])rmSync(`${cwd}src/export/vendor/${name}`,{force:true});
 const log=execFileSync('pnpm',['exec','vite','build','--config',mode?'vite.build6-cost.config.mjs':'vite.viewer.config.js'],{cwd,env:{...process.env,NODE_ENV:'production',BUILD6_COST_MODE:mode??''},encoding:'utf8'});
 writeFileSync(`${output}.${mode??'full'}.log`,log);writeFileSync(`${output}.${mode??'full'}.graph.json`,readFileSync(`${cwd}src/export/vendor/motion-graph.json`));return measure();
};
const full=build(),controls=[];
try{for(const mode of ['projection','quarantine','fidelity','handoff','interaction','static-only','precompute-envelope','clipboard-route']){const row=build(mode);controls.push({mode,...row,marginalRawBytes:full.rawBytes-row.rawBytes});}}
finally{assert.deepEqual(build(),full,'Restored full build drifted');}
assert.equal(full.motionRenderedBytes,211511);
const report={scope:'Clean production whole-IIFE UTF-8 costs. Independent removal controls against SAME full candidate, not additive feature prices. Fidelity control removes retained-point curves AND pressure subdivisions; quarantine control trusts committed shapes. None is export-legal. Full source restored and byte-identical.',full,controls};
writeFileSync(output,JSON.stringify(report,null,2));assert.deepEqual(JSON.parse(readFileSync(output,'utf8')),report);console.log(JSON.stringify(report,null,2));
