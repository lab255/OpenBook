/** Controlled production-build ablation; no product or SDK-dist files modified.
 * Run from packages/ui. Restores full canvas entries only in the build
 * transform before ablating them; works with the final fence in place. */
import {build} from 'vite';
import {writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const modes=['before','data-only','schema-only','full'];
if(!process.argv[2])for(const mode of modes)execFileSync(process.execPath,[fileURLToPath(import.meta.url),mode],{stdio:'inherit'});
const rows=[];
for(const mode of (process.argv[2]?[process.argv[2]]:[])){
  const removed=[];
  const output=await build({configFile:'vite.viewer.config.js',build:{write:false},plugins:[{
    name:'canvas-catalogue-ablation',enforce:'pre',
    transform(code,id){
      const catalogue=id.endsWith('/sdk/dist/blockCatalogue.js'),schema=id.endsWith('/sdk/dist/blockPropSchemas.js');
      if(catalogue)code=code.replace(/^([ \t]*)typeof __OB_SAFE_EXPORT_VIEWER__[^\n]*\n[^\n]*\?[^\n]*\n[ \t]*: (\{ type: 'canvas',[^\n]*\n)/m,'$1$2');
      if(schema)code=code.replace(/canvas: typeof __OB_SAFE_EXPORT_VIEWER__[^\n]*?\? \{\} : /,'canvas: ');
      if(catalogue&&(mode==='before'||mode==='schema-only')||schema&&(mode==='before'||mode==='data-only')){
        const pattern=catalogue?/^.*\{ type: 'canvas',.*\n/m:/^.*canvas: \{ canvasVersion:.*\n/m;
        const match=code.match(pattern);if(!match)throw new Error(`Missing expected canvas line: ${id}`);
        removed.push({id,line:match[0]});return code.replace(pattern,'');
      }
      if(catalogue||schema)return code;
    }
  }]});
  const files=(Array.isArray(output)?output:[output]).flatMap(o=>o.output);
  const chunk=files.find(f=>f.type==='chunk'&&f.isEntry);
  const graph=JSON.parse(files.find(f=>f.fileName==='motion-graph.json').source);
  const modules=Object.entries(chunk.modules).filter(([id])=>/sdk\/dist\/block(Catalogue|PropSchemas)\.js$/.test(id)).map(([id,m])=>({id,code:m.code,bytes:Buffer.byteLength(m.code??'')}));
  rows.push({mode,bytes:Buffer.byteLength(chunk.code),coordinate:Buffer.byteLength(chunk.code)-1932375,removed,modules,graph});
}
if(process.argv[2]){writeFileSync(`../../_evidence-build4/catalogue-${process.argv[2]}-modules.json`,JSON.stringify(rows[0],null,2)+'\n');process.exit(0);}
for(const mode of modes)rows.push(JSON.parse(readFileSync(`../../_evidence-build4/catalogue-${mode}-modules.json`,'utf8')));
const baseline=rows[0];
// Normalization can give distinct installed copies the same id; compare their
// byte multisets rather than pairing every copy with the first matching id.
const totals=row=>{const map=new Map();for(const m of row.graph.modules)map.set(m.id,(map.get(m.id)??0)+m.bytes);return map;};
const baseTotals=totals(baseline);
const differences=rows.slice(1).map(row=>({mode:row.mode,rawDelta:row.bytes-baseline.bytes,newModules:row.graph.modules.filter(m=>!baseTotals.has(m.id)).map(m=>m.id),moduleDeltas:[...totals(row)].map(([id,after])=>({id,before:baseTotals.get(id)??0,after,delta:after-(baseTotals.get(id)??0)})).filter(m=>m.delta)}));
writeFileSync('../../_evidence-build4/catalogue-ablation.json',JSON.stringify({method:'Same production Vite config, write:false, single-line SDK-dist transform ablations; files on disk untouched',rows,differences},null,2)+'\n');
console.log(JSON.stringify(differences,null,2));
