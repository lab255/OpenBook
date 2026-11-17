/** Run with tsx from packages/ui. Compares deterministic document bytes against
 * the audited base, independently of the viewer-code ledger. */
import * as Y from 'yjs';
import * as current from '../src/blockeditor/canvas/schema';
import {writeFileSync, unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const base='229927603c5a9c51a69a25ee7f89f0e73d9ea443';
const temporary=resolve('scripts/.build4-base-schema.ts');
writeFileSync(temporary,execFileSync('git',['show',`${base}:packages/ui/src/blockeditor/canvas/schema.ts`]));
try {
  const old=await import(pathToFileURL(temporary).href) as typeof current;
  const rows=[];
  for(const kind of ['rect','ellipse','arrow','text','stroke','pressure']) {
    const bytes=(schema:typeof current,violation=false)=>{const doc=new Y.Doc();doc.clientID=42;const props=schema.createCanvasProps();doc.getMap('root').set('canvas',props);const variable=kind==='pressure';const shape=schema.createShape({id:'s',kind:variable?'stroke':kind,pressureMode:variable?'variable':'constant',pointArity:variable?3:2,points:variable?[0,0,51,10,20,204]:kind==='stroke'?[0,0,10,20]:[]});(props.get('shapes') as Y.Map<unknown>).set('s',shape);if(violation)shape.set('pointArity',variable?3:2);return Y.encodeStateAsUpdate(doc);};
    const before=bytes(old),after=bytes(current),negative=bytes(current,true),equal=Buffer.from(before).equals(Buffer.from(after));
    rows.push({kind,before:before.length,after:after.length,delta:after.length-before.length,equal,negativeControlDelta:negative.length-after.length,sha256:createHash('sha256').update(after).digest('hex')});
  }
  writeFileSync('../../_evidence-build4/document-byte-equivalence.json',JSON.stringify({base,axis:'document bytes only, deterministic v1 seed shapes',negativeControl:'Deliberately persist JSON-only pointArity on each shape',rows},null,2)+'\n');
  console.log(rows);if(rows.some(r=>!r.equal||r.negativeControlDelta<=0))process.exitCode=1;
}finally{unlinkSync(temporary);}
