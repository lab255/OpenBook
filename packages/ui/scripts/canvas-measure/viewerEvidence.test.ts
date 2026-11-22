import {expect,test} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertViewerEvidence,writeViewerEvidence} from './viewerEvidence.mjs';

test('viewer evidence matches artifact; stale coordinate/hash controls fail and leave no stale output',()=>{
  const dir=mkdtempSync(join(tmpdir(),'canvas-viewer-evidence-'));
  try{
    const artifact=join(dir,'viewer.js'),output=join(dir,'viewer.json'),baseline=100;
    writeFileSync(artifact,'a'.repeat(952));
    const args={artifact,output,baseline,coordinate:852};
    const record=writeViewerEvidence(args);
    expect(JSON.parse(readFileSync(output,'utf8'))).toEqual(record);
    expect(()=>assertViewerEvidence(record,artifact,baseline)).not.toThrow();
    // This is the shipped defect: an old coordinate beside new artifact bytes.
    expect(()=>writeViewerEvidence({...args,coordinate:878})).toThrow(/coordinate/);
    expect(existsSync(output)).toBe(false);
    writeViewerEvidence(args);expect(existsSync(output)).toBe(true);
    // Equal-size artifact replacement must also fail: byte length alone is insufficient.
    writeFileSync(artifact,'b'.repeat(952));
    expect(()=>assertViewerEvidence(record,artifact,baseline)).toThrow(/hash/);
    const refreshed=writeViewerEvidence(args);expect(refreshed.sha256).not.toBe(record.sha256);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
