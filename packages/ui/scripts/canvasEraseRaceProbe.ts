/** Diagnostic for the reviewer-reported D3 erase/edit race; raw state, no defaults. */
import * as Y from 'yjs';
import {rootBlocks} from '../src/blockeditor/model';
import {CanvasHistory} from '../src/blockeditor/canvas/history';
import {eraseShape} from '../src/blockeditor/canvas/commands';
import {createCanvasProps, createShape, readCanvas} from '../src/blockeditor/canvas/schema';
for (const ids of [[10,20],[20,10]]) {
  const seed = new Y.Doc(); seed.clientID = 1;
  const block = new Y.Map<unknown>(), props = createCanvasProps();
  block.set('id','canvas');block.set('type','canvas');block.set('props',props);rootBlocks(seed).push([block]);
  (props.get('shapes') as Y.Map<unknown>).set('s',createShape({id:'s'}));
  const bytes = Y.encodeStateAsUpdate(seed);
  const peers = ids.map(id=>{
    const doc = new Y.Doc();doc.clientID=id;Y.applyUpdate(doc,bytes);
    const props = rootBlocks(doc).get(0).get('props') as Y.Map<unknown>;
    const shapes = props.get('shapes') as Y.Map<Y.Map<unknown>>;
    const history = new CanvasHistory(doc);
    const observed: unknown[]=[];
    doc.on('afterTransaction',()=>observed.push(shapes.toJSON()));
    return {doc,props,shapes,history,observed};
  });
  const [a,b]=peers;
  const exchange=()=>{const au=Y.encodeStateAsUpdate(a.doc),bu=Y.encodeStateAsUpdate(b.doc);Y.applyUpdate(a.doc,bu,'net');Y.applyUpdate(b.doc,au,'net');};
  eraseShape(a.history,'canvas','s');
  b.history.commitCanvasCommand('Move',[{blockId:'canvas',shapeId:'s',values:{x:55}}]);
  exchange(); const result=a.history.undo();exchange();
  process.stdout.write(JSON.stringify({ids,seed:Array.from(bytes),operations:['A erase s','B concurrent x=55','exchange','A undo erase','exchange'],result,replicas:peers.map(p=>({state:p.shapes.toJSON(),editable:readCanvas(p.props).editable,diagnostics:readCanvas(p.props).diagnostics,observed:p.observed}))})+'\n');
}
