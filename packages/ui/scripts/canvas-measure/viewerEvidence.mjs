import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,statSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';

/** Validate the evidence against fresh artifact bytes, not another evidence file. */
export function assertViewerEvidence(record,artifact,baseline){
 const bytes=readFileSync(artifact);
 assert.equal(record.rawBytes,bytes.length,'Viewer evidence raw bytes disagree with artifact');
 assert.equal(record.coordinate,bytes.length-baseline,'Viewer evidence coordinate disagrees with artifact');
 assert.equal(record.sha256,createHash('sha256').update(bytes).digest('hex'),'Viewer evidence hash disagrees with artifact');
}

/** Publish and read back the measured record; failure invalidates this output so
 * a stale success cannot remain on disk after a failed evidence emission. */
export function writeViewerEvidence({artifact,baseline,output,coordinate}){
 try{
  const bytes=readFileSync(artifact);
  const record={path:resolve(artifact),mtime:statSync(artifact).mtime.toISOString(),buildMode:'production',rawBytes:bytes.length,coordinate,sha256:createHash('sha256').update(bytes).digest('hex')};
  assertViewerEvidence(record,artifact,baseline);
  writeFileSync(output,JSON.stringify(record,null,2)+'\n');
  assertViewerEvidence(JSON.parse(readFileSync(output,'utf8')),artifact,baseline);
  return record;
 }catch(error){rmSync(output,{force:true});throw error;}
}
