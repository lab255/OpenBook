/** Real production schema/append path. Run the SAME script at the held and B
 * revisions. Measures document bytes only, never viewer-code bytes. */
import * as Y from 'yjs';
import {rootBlocks} from '../src/blockeditor/model';
import * as schema from '../src/blockeditor/canvas/schema';
import {createCanvasProps, createShape, readPressure} from '../src/blockeditor/canvas/schema';
import {CanvasHistory} from '../src/blockeditor/canvas/history';
import {appendPoints} from '../src/blockeditor/canvas/commands';
const reference = process.argv.includes('--scratch-reference');
const workloads = reference
  ? [[1,50],[1,100],[1,1000],[100,50],[500,50],[500,1000],[1,200],[1,2000],[500,200],[500,100]].map(([strokes,count])=>({strokes,count,batchSize:64}))
  : [50,250,1000,2000].flatMap(count=>[16,64].map(batchSize=>({strokes:100,count,batchSize})));
for (const {strokes,count,batchSize} of workloads) {
  const doc=new Y.Doc();doc.clientID=101;
  const props=createCanvasProps(),block=new Y.Map<unknown>();
  block.set('id','canvas');block.set('type','canvas');block.set('props',props);rootBlocks(doc).push([block]);
  const shapes=props.get('shapes') as Y.Map<Y.Map<unknown>>;
  const history=new CanvasHistory(doc);
  for(let s=0;s<strokes;s++) {
    doc.transact(()=>shapes.set(`shape-${s}`,createShape({id:`shape-${s}`,kind:'stroke',pressureMode:'variable'})));
    for(let i=0;i<count;i+=batchSize) {
      const n=Math.min(batchSize,count-i);
      // Fractional coordinates, integer quantized pressure, deterministic inputs.
      appendPoints(history,'canvas',`shape-${s}`,Array.from({length:n*2},(_,k)=>reference ? (i+Math.floor(k/2))*(k%2 ? 2 : 1) : (i*2+k)/10),Array.from({length:n},(_,k)=>reference ? (k*5)%256/255 : ((i+k)%256)/255));
    }
  }
  const update=Y.encodeStateAsUpdate(doc);
  const project = (schema as unknown as {projectCanvas?: (props:Y.Map<unknown>) => Record<string,unknown>}).projectCanvas;
  const projection=(project ? project(props) : props.toJSON()) as {shapes:Record<string,Record<string,unknown>>};
  for(const [id,shape] of project ? [] : shapes) {
    const p=readPressure(shape) as unknown as {batches?:{offset:number;q:number[]}[];q?:number[]};
    if(p.batches) projection.shapes[id].pressureBatches=p.batches;

  }
  const binaryBase64=Buffer.from(update).toString('base64');
  console.log(JSON.stringify({shapes:strokes,coordinates:reference?'integer':'fractional',pointsPerShape:count,batchSize,rawBytes:update.length,base64Bytes:binaryBase64.length,projectionBytes:Buffer.byteLength(JSON.stringify(projection)),combinedBytes:binaryBase64.length+Buffer.byteLength(JSON.stringify(projection))}));
  history.destroy();doc.destroy();
}
