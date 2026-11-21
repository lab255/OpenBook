// Run with node --import tsx. A counterfactual disables ONLY lattice partitioning.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const sourcePath=fileURLToPath(new URL('../../src/blockeditor/canvas/decimation.ts',import.meta.url));
const source=readFileSync(sourcePath,'utf8'),bench=readFileSync(new URL('../canvasDecimationBench.ts',import.meta.url),'utf8');
assert.equal(source.split('if(lattice){').length,2);
const directory=mkdtempSync(join(tmpdir(),'build5-float-partition-'));
try{
 const control=source.replace('if(lattice){','if(false&&lattice){').replaceAll("'./strokeCurve'",JSON.stringify(fileURLToPath(new URL('../../src/blockeditor/canvas/strokeCurve.ts',import.meta.url)))).replaceAll("'./geometry'",JSON.stringify(fileURLToPath(new URL('../../src/blockeditor/canvas/geometry.ts',import.meta.url))));
 writeFileSync(join(directory,'control.ts'),control);
 const fixtures=bench.slice(bench.indexOf('const fixtures='),bench.indexOf('// Independent chronological segment check'));
 assert.ok(fixtures.includes('const classes='));
 writeFileSync(join(directory,'fixtures.ts'),`import {simplifyStroke} from ${JSON.stringify(sourcePath)};\n${fixtures}\nexport default [...samples,...representative,...lattice.filter(s=>s.name.startsWith('float-control'))];`);
 const {simplifyStroke:before}=await import(pathToFileURL(join(directory,'control.ts')).href);
 const {default:rows}=await import(pathToFileURL(join(directory,'fixtures.ts')).href);
 assert.equal(rows.length,46);
 const results=rows.map(s=>{const baseline=before(s.points,s.arity);assert.deepEqual(s.result,baseline);return {name:s.name,arity:s.arity,retained:s.result.retained,exactTupleIdentity:true};});
 writeFileSync(new URL('../../../../_evidence-build5/round3-float-partition.json',import.meta.url),JSON.stringify({scope:'46 float fixtures from the actual benchmark, before/after ONLY quantization-aware endpoint partitioning; exact retained tuple identity, stronger than byte noise. F1 corrected rendering verification is enabled in BOTH arms; differences from round 2 are separately reported as corrected fidelity enforcement.',sourceHash:createHash('sha256').update(source).digest('hex'),results},null,2));
 console.log(`Float partition mirror: ${results.length} exact matches`);
}finally{rmSync(directory,{recursive:true,force:true});}
