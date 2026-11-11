// Local prototype accounting; no network, no hard point cap.
import * as Y from 'yjs';
import {writeFileSync} from 'node:fs';
import {createDoc,rootBlocks,encodeSnapshot} from '../src/blockeditor/model';
import {newCanvas,newShape,appendPoints} from '../src/blockeditor/canvas/state';
import {CanvasHistory} from '../src/blockeditor/canvas/history';
const rows=[];
for(const [strokes,points] of [[10,10],[25,25],[50,50],[100,50],[100,100],[100,250],[500,50],[500,100],[500,1000]]) {
  const doc=createDoc([newCanvas()]);const shapes=rootBlocks(doc).get(0).get('props').get('shapes') as Y.Map<Y.Map<unknown>>;const history=new CanvasHistory(doc,rootBlocks(doc));let traffic=0;doc.on('update',(u:Uint8Array)=>traffic+=u.length);
  for(let n=0;n<strokes;n++){const id=crypto.randomUUID();history.structural('stroke',()=>{const s=newShape('stroke',{id,name:'試験 café',x:n%20*25,y:Math.floor(n/20)*10,w:1,h:1,pressureMode:'variable'});shapes.set(id,s);appendPoints(s,Array.from({length:points},(_,i)=>[i*.13,Math.sin(i*.1)*30]).flat(),Array.from({length:points},(_,i)=>.5+.4*Math.sin(i*.03)));});}
  const first=[...shapes.keys()][0];history.commitCanvasCommand('move',[{target:shapes.get(first)!,resolve:()=>shapes.get(first),values:{x:20,y:30}}]);
  const before=Y.encodeStateAsUpdate(doc).length,snapshot=encodeSnapshot(doc),jsonBytes=Buffer.byteLength(JSON.stringify(snapshot));
  const ids=[...shapes.keys()].slice(0,Math.floor(strokes/2));history.structural('erase',()=>ids.forEach(id=>shapes.delete(id)));
  const after=Y.encodeStateAsUpdate(doc).length;history.undo();
  rows.push({strokes,pointsPerStroke:points,pressure:'packed <=64 pairs per metadata batch, one pointerup transaction',rawBeforeErase:before,base64Bytes:snapshot.update.length,fullSnapshotBytes:jsonBytes,trafficIncludingMoveEraseUndo:traffic,rawAfterEraseWithUndoRetention:after,rawAfterEraseUndo:Y.encodeStateAsUpdate(doc).length,journalEntries:history.past.length});history.destroy();doc.destroy();
}
writeFileSync('../../_evidence-canvas5/storage.json',JSON.stringify({note:'Synthetic corpus distribution; not a population median. Fractional coordinates, random UUIDs, UTF-8 names, pressure and retained history included. No time-flushed publication in prototype.',rows},null,2));
