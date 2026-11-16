import * as Y from 'yjs';
import {expect, test} from 'vitest';
import {rootBlocks} from '../model';
import {CanvasHistory} from './history';
import {createCanvasProps, createShape, readCanvas, readPressure} from './schema';
import {appendPoints, eraseShape} from './commands';

function seed() {
  const doc = new Y.Doc(); doc.clientID = 1;
  const block = new Y.Map<unknown>();
  block.set('id', 'canvas'); block.set('type', 'canvas');
  const props = createCanvasProps(); block.set('props', props);
  rootBlocks(doc).push([block]);
  (props.get('shapes') as Y.Map<unknown>).set('s', createShape({id:'s', kind:'stroke', pressureMode:'variable', x:0,y:0,w:10,h:10}));
  return Y.encodeStateAsUpdate(doc);
}
function peer(bytes: Uint8Array, id: number) {
  const doc = new Y.Doc(); doc.clientID = id; Y.applyUpdate(doc, bytes, 'net');
  const props = rootBlocks(doc).get(0).get('props') as Y.Map<unknown>;
  const shapes = props.get('shapes') as Y.Map<Y.Map<unknown>>;
  const history = new CanvasHistory(doc);
  const states: unknown[] = [];
  doc.on('afterTransaction', () => {
    const state = shapes.toJSON(); states.push(state);
    for (const shape of shapes.values()) for (const k of ['x','y','w','h']) expect(Number.isFinite(shape.get(k)), JSON.stringify(state)).toBe(true);
  });
  return {doc,props,shapes,history,states};
}
type Peer = ReturnType<typeof peer>;
function exchange(a: Peer,b: Peer) {
  const au = Y.encodeStateAsUpdate(a.doc), bu = Y.encodeStateAsUpdate(b.doc);
  Y.applyUpdate(a.doc, bu, 'net'); Y.applyUpdate(b.doc, au, 'net');
  expect(a.shapes.toJSON()).toEqual(b.shapes.toJSON());
}
const move = (p: Peer, values: Record<string, unknown>) => p.history.commitCanvasCommand('Move', [{blockId:'canvas',shapeId:'s',values}]);

test('Required proof: append+pressure undo and redo across replicas', () => {
  const bytes = seed(), a = peer(bytes,10), b = peer(bytes,20);
  appendPoints(a.history,'canvas','s',[0,0,2,3],[0.2,0.8]); exchange(a,b);
  expect(readPressure(a.shapes.get('s')!)).toEqual({batches:[{offset:0,q:[51,204]}],degraded:false});
  a.history.undo(); exchange(a,b);
  expect(a.shapes.get('s')!.get('points')).toBeInstanceOf(Y.Array);
  expect((a.shapes.get('s')!.get('points') as Y.Array<number>).length).toBe(0);
  a.history.redo(); exchange(a,b);
  const evidence = {seed: Array.from(bytes), operations:['append [0,0,2,3] pressure [.2,.8]', 'exchange','undo','exchange','redo','exchange'], a:a.shapes.toJSON(),b:b.shapes.toJSON(), observedA:a.states,observedB:b.states};
  expect(readPressure(a.shapes.get('s')!),JSON.stringify(evidence)).toEqual({batches:[{offset:0,q:[51,204]}],degraded:false});
});
test('Required proof: erase restore after semantic edits', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  move(a,{x:20,y:30}); exchange(a,b);
  eraseShape(a.history,'canvas','s'); exchange(a,b);
  a.history.undo(); exchange(a,b);
  expect(a.shapes.get('s')!.get('x')).toBe(20);
  expect(a.shapes.get('s')!.get('y')).toBe(30);
  expect(readCanvas(a.props).editable).toBe(true);
});

test('Decisive D3 example: B wins 40, undo restores seed 0, redo restores 40, losing A and later remote move are preserved', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  move(a,{x:20}); move(b,{x:40}); exchange(a,b);
  expect(a.shapes.get('s')!.get('x')).toBe(40);
  expect(b.history.undo().appliedKeys).toHaveLength(1); exchange(a,b);
  expect(a.shapes.get('s')!.get('x')).toBe(0);
  expect(a.history.undo().reason).toBe('no-op'); exchange(a,b);
  b.history.redo(); exchange(a,b);
  expect(a.shapes.get('s')!.get('x')).toBe(40);
  move(a,{x:60}); exchange(a,b);
  expect(b.history.undo().reason).toBe('no-op'); exchange(a,b);
  expect(b.shapes.get('s')!.get('x')).toBe(60);
});
test('Required proof: token/value winners stay paired with different operation lengths and inverse token reuse in both client-id orders', () => {
  for (const ids of [[10,20],[20,10]]) for (const extra of [false,true]) {
    const bytes=seed(),a=peer(bytes,ids[0]),b=peer(bytes,ids[1]);
    move(a,extra ? {y:15,text:'long operation',x:20} : {x:20});
    move(b,{x:40,opacity:0.5});
    const at=a.shapes.get('s')!.get('op:x'),bt=b.shapes.get('s')!.get('op:x');
    exchange(a,b);
    const winner=ids[0]>ids[1]?a:b;
    expect([a.shapes.get('s')!.get('x'),a.shapes.get('s')!.get('op:x')]).toEqual(ids[0]>ids[1]?[20,at]:[40,bt]);
    winner.history.undo(); exchange(a,b);
    expect([a.shapes.get('s')!.get('x'),a.shapes.get('s')!.get('op:x')]).toEqual([0,'canvas:seed']);
    winner.history.redo(); exchange(a,b);
    expect([a.shapes.get('s')!.get('x'),a.shapes.get('s')!.get('op:x')]).toEqual(ids[0]>ids[1]?[20,at]:[40,bt]);
  }
});
test('Required proof: winning and losing moves in both client-id orders', () => {
  for(const ids of [[10,20],[20,10]]) {
    const bytes=seed(),a=peer(bytes,ids[0]),b=peer(bytes,ids[1]);
    move(a,{x:20,y:20});move(b,{x:40,y:40});exchange(a,b);
    const winner=ids[0]>ids[1]?a:b,loser=winner===a?b:a;
    expect(loser.history.undo().reason).toBe('no-op');
    expect(winner.history.undo().appliedKeys).toHaveLength(2);exchange(a,b);
    expect(a.shapes.get('s')!.get('x')).toBe(0);expect(a.shapes.get('s')!.get('y')).toBe(0);
  }
});
test('Required proof: redo after remote move skips mismatched tokens', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  move(a,{x:20,y:30});exchange(a,b);a.history.undo();exchange(a,b);
  move(b,{x:99});exchange(a,b);
  const result=a.history.redo();exchange(a,b);
  expect(result.reason).toBe('adjusted');expect(result.appliedKeys).toEqual(['canvas/s/y']);
  expect(a.shapes.get('s')!.get('x')).toBe(99);expect(a.shapes.get('s')!.get('y')).toBe(30);
});
test('Required proof: x-only versus x/y preserves independent fields and dimensions', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  move(a,{x:20,y:30});move(b,{x:40,w:50});exchange(a,b);
  expect(a.history.undo().appliedKeys).toEqual(['canvas/s/y']);exchange(a,b);
  expect(a.shapes.get('s')!.get('x')).toBe(40);expect(a.shapes.get('s')!.get('w')).toBe(50);
});
test('Required proof: two sequential local edits then two undos/two redos restore token lineage', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  move(a,{x:20});const first=a.shapes.get('s')!.get('op:x');move(a,{x:40});const second=a.shapes.get('s')!.get('op:x');exchange(a,b);
  for(const [operation,x,token] of [['undo',20,first],['undo',0,'canvas:seed'],['redo',20,first],['redo',40,second]] as const) {
    a.history[operation]();exchange(a,b);
    expect([a.shapes.get('s')!.get('x'),a.shapes.get('s')!.get('op:x')]).toEqual([x,token]);
  }
});
test('Required proof: remote erase before undo never resurrects geometry', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  move(a,{x:20});exchange(a,b);eraseShape(b.history,'canvas','s');exchange(a,b);
  expect(a.history.undo().reason).toBe('no-op');a.history.redo();exchange(a,b);expect(a.shapes.has('s')).toBe(false);
});
test('Required proof: grouped multi-selection captures actual commit baselines and one journal entry', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  a.doc.transact(()=>a.shapes.set('t',createShape({id:'t'})),'local');a.history.stopCapturing();exchange(a,b);
  move(b,{x:7});exchange(a,b); // remote edit during local preview
  a.history.commitCanvasCommand('Move selection',[
    {blockId:'canvas',shapeId:'s',values:{x:20}},
    {blockId:'canvas',shapeId:'t',values:{x:30}},
    {blockId:'canvas',shapeId:'s',values:{x:40}},
  ]);exchange(a,b);
  expect(a.history.undo().appliedKeys).toHaveLength(2);exchange(a,b);
  expect(a.shapes.get('s')!.get('x')).toBe(7);expect(a.shapes.get('t')!.get('x')).toBe(0);
});
test('Required proof: cancellation discards local preview and preserves remote geometry and history', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  const preview={x:90};move(b,{x:25});exchange(a,b);
  a.history.cancelPreview();expect(preview.x).toBe(90);
  expect(a.history.availability.undo).toBeNull();expect(readCanvas(a.props).shapes[0].scalars.x).toBe(25);
});
test('Required proof: interleaved page/canvas history and bounded no-op root dispatch', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  const page=rootBlocks(a.doc).get(0);
  a.doc.transact(()=>page.set('name','Page edit'),'local');a.history.stopCapturing();
  move(a,{x:20});
  a.doc.transact(()=>a.shapes.set('temporary',createShape({id:'temporary'})),'local');a.history.stopCapturing();exchange(a,b);
  b.doc.transact(()=>b.shapes.delete('temporary'),'local');exchange(a,b);
  expect(a.history.undo().reason).toBe('no-op');
  expect(page.get('name')).toBe('Page edit');expect(a.shapes.get('s')!.get('x')).toBe(20);
  a.history.undo();expect(a.shapes.get('s')!.get('x')).toBe(0);expect(page.get('name')).toBe('Page edit');
  a.history.undo();expect(page.get('name')).toBeUndefined();
  a.history.redo();expect(page.get('name')).toBe('Page edit');
  a.history.redo();expect(a.shapes.get('s')!.get('x')).toBe(20);
});
test('Required proof: invalid/fallback docs remain readable without mutation and reject editing', () => {
  const bytes=seed(),a=peer(bytes,10);
  expect(()=>move(a,{x:Infinity})).toThrow();expect(a.shapes.get('s')!.get('x')).toBe(0);
  move(a,{w:-8});expect(a.shapes.get('s')!.get('w')).toBe(0);
  const fallback=a.props.toJSON();expect(readCanvas(fallback).editable).toBe(false);expect(readCanvas(fallback).shapes).toHaveLength(1);
  fallback.shapes.s.x=NaN;expect(readCanvas(fallback).shapes).toHaveLength(0);
  const doc=new Y.Doc(),block=new Y.Map<unknown>();block.set('id','canvas');block.set('props',fallback);rootBlocks(doc).push([block]);
  const history=new CanvasHistory(doc);expect(history.commitCanvasCommand('Move',[{blockId:'canvas',shapeId:'s',values:{x:2}}]).reason).toBe('no-op');
  expect(fallback.shapes.s.x).toBeNaN();
});
test('Required proof: every observed post-transaction scene has complete finite geometry', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  for(let i=0;i<20;i++) {
    move(a,{x:i+1,y:i+2});move(b,{x:i+40,w:i+10});exchange(a,b);
    a.history.undo();b.history.undo();exchange(a,b);a.history.redo();b.history.redo();exchange(a,b);
  }
  expect(a.states.length).toBeGreaterThan(100);expect(b.states.length).toBeGreaterThan(100);
});

test('Required proof: relay delivery of scalar and raw root undo/redo uses two connected providers exactly once without echo', async () => {
  const {connectPageRelay}=await import('../relay');
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  const subscribers=new Set<(update:string,clientId:number)=>void>();
  const posted: string[]=[];
  const client={
    subscribePageUpdates: (_id:string,fn:(update:string,clientId:number)=>void)=>{subscribers.add(fn);return ()=>subscribers.delete(fn);},
    syncPageUpdates: async()=>null,
    postPageUpdate: async(_id:string,update:string,id:number)=>{posted.push(update);subscribers.forEach(fn=>fn(update,id));},
  } as unknown as import('@book.dev/sdk').DataClient;
  const pa=connectPageRelay(a.doc,'page',client),pb=connectPageRelay(b.doc,'page',client);
  const settle=()=>new Promise(resolve=>setTimeout(resolve,100));
  try {
    move(a,{x:20});await settle();expect(b.shapes.get('s')!.get('x')).toBe(20);
    a.history.undo();await settle();expect(b.shapes.get('s')!.get('x')).toBe(0);
    a.history.redo();await settle();expect(b.shapes.get('s')!.get('x')).toBe(20);
    eraseShape(a.history,'canvas','s');await settle();expect(b.shapes.has('s')).toBe(false);
    a.history.undo();await settle();expect(b.shapes.get('s')!.get('x')).toBe(20);
    a.history.redo();await settle();expect(b.shapes.has('s')).toBe(false);
    expect(posted).toHaveLength(6);expect(a.shapes.toJSON()).toEqual(b.shapes.toJSON());
  } finally {pa.disconnect();pb.disconnect();a.history.destroy();b.history.destroy();}
});
test('Order keys: deterministic ties and balanced placement, concurrent reorder/rebalance and long keys', async () => {
  const {insertShape,placementKey}=await import('./commands');
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  insertShape(a.history,'canvas',{id:'t',ord:'V'});exchange(a,b);
  expect(readCanvas(a.props).shapes.map(s=>s.id)).toEqual(['s','t']);
  const key=placementKey(a.history,'canvas','s','t');
  expect(key > String(a.shapes.get('s')!.get('ord')) && key < String(a.shapes.get('t')!.get('ord'))).toBe(true);
  move(b,{ord:'z'});exchange(a,b); // concurrent rebalance versus reorder
  expect(readCanvas(a.props).shapes.map(s=>s.id)).toEqual(readCanvas(b.props).shapes.map(s=>s.id));
  a.history.commitCanvasCommand('Long key',[{blockId:'canvas',shapeId:'s',values:{ord:'z'.repeat(49)}}]);
  const ordered=readCanvas(a.props).shapes;
  placementKey(a.history,'canvas',ordered[0].id,ordered[1].id);
  expect(readCanvas(a.props).shapes.every(s=>String(s.scalars.ord).length<=48)).toBe(true);
});
test('History lifecycle, read-only guard, new edit clears both redo paths, and canvas-level scalars', () => {
  const bytes=seed(),a=peer(bytes,10);
  a.history.commitCanvasCommand('Resize canvas',[{blockId:'canvas',values:{height:500,background:'#ff0000'}}]);
  a.history.undo();expect(a.props.get('height')).toBe(360);a.history.redo();expect(a.props.get('height')).toBe(500);
  eraseShape(a.history,'canvas','s');a.history.undo();
  move(a,{x:10});expect(a.history.availability.redo).toBeNull();expect(a.history.manager.redoStack).toHaveLength(0);
  a.history.destroy();
  let writable=false;const history=new CanvasHistory(a.doc,()=>writable);
  expect(history.commitCanvasCommand('Denied',[{blockId:'canvas',shapeId:'s',values:{x:44}}]).reason).toBe('read-only');
  expect(history.undo().reason).toBe('read-only');
  writable=true;history.commitCanvasCommand('Allowed',[{blockId:'canvas',shapeId:'s',values:{x:44}}]);
  history.undo();expect(a.shapes.get('s')!.get('x')).toBe(10);history.destroy();
});
