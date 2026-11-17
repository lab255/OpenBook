import * as Y from 'yjs';
import {afterEach, beforeEach, expect, onTestFailed, test} from 'vitest';
// @ts-expect-error -- node:fs is available to Vitest, not the browser package.
import {mkdtempSync, writeFileSync} from 'node:fs';
// @ts-expect-error -- node:os is available to Vitest, not the browser package.
import {tmpdir} from 'node:os';
import {findBlock, removeBlock, rootBlocks, encodeSnapshot, registerPropsProjection} from '../model';
import {CanvasHistory, SEMANTIC_CANVAS} from './history';
import {createCanvasProps, createShape, readCanvas, readPressure, projectCanvas} from './schema';
import {appendPoints, eraseShape} from './commands';

const observerErrors: unknown[] = [];
const checked = <Args extends unknown[]>(check: (...args: Args) => void) => (...args: Args): void => {
  try { check(...args); } catch (error) { observerErrors.push(error); }
};
afterEach(() => { expect(observerErrors).toEqual([]); });
const traces: {clientID: number; seed: number[]; states: unknown[]; updates: number[][]}[] = [];
beforeEach(() => {
  traces.length = 0; observerErrors.length = 0;
  onTestFailed(({task}) => {
    const directory = mkdtempSync(`${tmpdir()}/openbook-canvas-evidence-`);
    const name = `review-anomaly-${task.name.replace(/[^a-z0-9]+/gi, '-')}.json`;
    writeFileSync(`${directory}/${name}`, JSON.stringify({test: task.name, replicas: traces}, null, 2));
    console.error(`Canvas failure evidence: ${directory}/${name}`);
  });
});
function assertGeometry(shapes: Y.Map<Y.Map<unknown>>): void {
  for (const shape of shapes.values()) {
    for (const key of ['x','y','w','h','startX','startY','endX','endY','basisW','basisH']) {
      expect(Number.isFinite(shape.get(key)), `${shape.get('id')}/${key}: ${JSON.stringify(shape.toJSON())}`).toBe(true);
    }
    expect(Number(shape.get('w'))).toBeGreaterThanOrEqual(0);
    expect(Number(shape.get('h'))).toBeGreaterThanOrEqual(0);
    expect(Number(shape.get('basisW'))).toBeGreaterThan(0);
    expect(Number(shape.get('basisH'))).toBeGreaterThan(0);
    const points = shape.get('points') as Y.Array<number>;
    expect(points).toBeInstanceOf(Y.Array);
    expect(points.length % (shape.get('pressureMode') === 'variable' ? 3 : 2)).toBe(0);
    expect(points.toArray().every(Number.isFinite)).toBe(true);
  }
}

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
  // Root restoration replaces nested identities, so fixtures must resolve the
  // live block instead of silently observing an obsolete detached shapes map.
  const live = () => findBlock(doc, 'canvas')?.block.get('props') as Y.Map<unknown> | undefined;
  const liveShapes = () => live()?.get('shapes') as Y.Map<Y.Map<unknown>> | undefined;
  const history = new CanvasHistory(doc);
  const states: unknown[] = [];
  const updates: number[][] = [];
  traces.push({clientID: id, seed: Array.from(bytes), states, updates});
  doc.on('update', update => updates.push(Array.from(update)));
  doc.on('afterTransaction', checked(() => {
    const shapes = liveShapes();
    states.push(shapes?.toJSON() ?? {canvasAbsent:true});
    if (shapes) assertGeometry(shapes);
  }));
  return {doc, get props() { return live()!; }, get shapes() { return liveShapes()!; }, history, states};
}
type Peer = ReturnType<typeof peer>;
function exchange(a: Peer,b: Peer) {
  const au = Y.encodeStateAsUpdate(a.doc), bu = Y.encodeStateAsUpdate(b.doc);
  Y.applyUpdate(a.doc, bu, 'net'); Y.applyUpdate(b.doc, au, 'net');
  expect(a.shapes?.toJSON()).toEqual(b.shapes?.toJSON());
  const reload=new Y.Doc();Y.applyUpdate(reload,Y.encodeStateAsUpdate(a.doc));
  const props=findBlock(reload,'canvas')?.block.get('props');
  expect(readCanvas(props)).toEqual(readCanvas(a.props));
  const shapes=props instanceof Y.Map ? props.get('shapes') : null;
  if(shapes instanceof Y.Map) for(const [id,shape] of shapes) expect(readPressure(shape)).toEqual(readPressure(a.shapes.get(id)!));
  reload.destroy();
}
const move = (p: Peer, values: Record<string, unknown>) => p.history.commitCanvasCommand('Move', [{blockId:'canvas',shapeId:'s',values}]);

test('Required proof: append+pressure undo and redo across replicas', () => {
  const bytes = seed(), a = peer(bytes,10), b = peer(bytes,20);
  appendPoints(a.history,'canvas','s',[0,0,2,3],[0.2,0.8]); exchange(a,b);
  expect(readPressure(a.shapes.get('s')!)).toEqual({q:[51,204],degraded:false,diagnostics:[]});
  a.history.undo(); exchange(a,b);
  expect(a.shapes.get('s')!.get('points')).toBeInstanceOf(Y.Array);
  expect((a.shapes.get('s')!.get('points') as Y.Array<number>).length).toBe(0);
  a.history.redo(); exchange(a,b);
  const evidence = {seed: Array.from(bytes), operations:['append [0,0,2,3] pressure [.2,.8]', 'exchange','undo','exchange','redo','exchange'], a:a.shapes.toJSON(),b:b.shapes.toJSON(), observedA:a.states,observedB:b.states};
  expect(readPressure(a.shapes.get('s')!),JSON.stringify(evidence)).toEqual({q:[51,204],degraded:false,diagnostics:[]});
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

test.each([[10,20], [20,10]])('Decisive D3 example: seed inverse, winner redo, losing undo and later remote move (A=%i, B=%i)', (aId,bId) => {
  const bytes=seed(),a=peer(bytes,aId),b=peer(bytes,bId);
  move(a,{x:20}); move(b,{x:40}); exchange(a,b);
  const winner = aId > bId ? a : b, loser = winner === a ? b : a;
  const won = winner === a ? 20 : 40;
  expect(a.shapes.get('s')!.get('x')).toBe(won);
  expect(winner.history.undo().appliedKeys).toHaveLength(1); exchange(a,b);
  expect(a.shapes.get('s')!.get('x')).toBe(0);
  expect(loser.history.undo().reason).toBe('no-op'); exchange(a,b);
  winner.history.redo(); exchange(a,b);
  expect(a.shapes.get('s')!.get('x')).toBe(won);
  move(loser,{x:60}); exchange(a,b);
  expect(winner.history.undo().reason).toBe('no-op'); exchange(a,b);
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
test('Required proof: cancellation preserves pointerup-only document/history contract (UI preview-discard placeholder pending F3)', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  // Preview ownership/discard is a UI responsibility, not implemented by this
  // headless API. This checks only that cancellation publishes/rewinds nothing.
  move(b,{x:25});exchange(a,b);
  const before = Y.encodeStateAsUpdate(a.doc);
  a.history.cancelPreview();
  expect(Y.encodeStateAsUpdate(a.doc)).toEqual(before);
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
  const fallback=projectCanvas(a.props) as {shapes:Record<string,Record<string,unknown>>};expect(readCanvas(fallback).editable).toBe(false);expect(readCanvas(fallback).shapes).toHaveLength(1);
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
  move(b,{ord:'z'});exchange(a,b); // peer reorder concurrent with local placement preparation; explicit tied-run branch tested below
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


test.each([[10,20], [20,10]])('Review D3 race: erase versus concurrent same-shape edit, undo and redo (A=%i, B=%i)', (aId,bId) => {
  const bytes=seed(),a=peer(bytes,aId),b=peer(bytes,bId);
  appendPoints(a.history,'canvas','s',[1,2,3,4],[0.2,0.8]);
  appendPoints(a.history,'canvas','s',[5,6,7,8],[0.4,1]); exchange(a,b);
  const original = [a,b].map(p => p.shapes.get('s')!.get('points'));
  const widths = (shape: Y.Map<unknown>) => readPressure(shape).q.map(q=>Number(shape.get('strokeWidth'))*(0.5+q/255));
  const expectedWidths = widths(a.shapes.get('s')!);
  move(a,{x:20, startX:0.2}); exchange(a,b);
  const token = a.shapes.get('s')!.get('op:x');
  eraseShape(a.history,'canvas','s');
  move(b,{x:55, startX:0.9});
  exchange(a,b);
  expect(a.shapes.has('s')).toBe(false);
  // Observe raw types too, and deliver EVERY update independently. No merged
  // snapshot or reader default can conceal an incomplete intermediate scene.
  a.shapes.observeDeep(checked(() => assertGeometry(a.shapes)));
  b.shapes.observeDeep(checked(() => assertGeometry(b.shapes)));
  const repairs: Y.Transaction[] = [];
  a.doc.on('afterTransaction', transaction => {
    if (transaction.origin === 'local' && transaction.meta.has(SEMANTIC_CANVAS)) repairs.push(transaction);
  });
  for (const p of [a,b]) p.doc.on('afterTransaction', checked(() => {
    const shape = p.shapes.get('s');
    if (shape) expect(readPressure(shape).degraded).toBe(false);
  }));
  const deliver = (update: Uint8Array) => Y.applyUpdate(b.doc, update, 'net');
  a.doc.on('update', deliver);
  try {
    expect(a.history.undo().reason).toBe('applied');
    expect(repairs).toHaveLength(1);
    expect([...repairs[0].changed.keys()]).toContain(a.shapes.get('s')!);
    expect([...repairs[0].changed.keys()]).toEqual([a.shapes.get('s')!]);
    expect(a.history.availability).toEqual({undo:'Move',redo:'Erase shape'});
    for (const [index,p] of [a,b].entries()) {
      const shape = p.shapes.get('s')!;
      const restoredPoints = shape.get('points') as Y.Array<number>;
      expect(restoredPoints).not.toBe(original[index]);
      expect(restoredPoints.toArray()).toEqual([1,2,51,3,4,204,5,6,102,7,8,255]);
      expect(shape.has('pressureBatches')).toBe(false);
      assertGeometry(p.shapes);
      expect(shape.get('x')).toBe(20);
      expect(shape.get('op:x')).toBe(token);
      expect(shape.get('startX')).toBe(0.2);
      expect(typeof shape.get('op:startX')).toBe('string');
      expect(readCanvas(p.props)).toMatchObject({editable:true, diagnostics:[]});
      expect(readPressure(shape).degraded).toBe(false);
      expect(widths(shape)).toEqual(expectedWidths);
    }
    expect(a.history.redo().reason).toBe('applied');
    expect(a.shapes.has('s')).toBe(false); expect(b.shapes.has('s')).toBe(false);
    expect(a.history.undo().reason).toBe('applied');
    expect(a.shapes.get('s')!.get('x')).toBe(20);
    expect(b.shapes.get('s')!.get('x')).toBe(20);
    for (const p of [a,b]) {
      expect(readPressure(p.shapes.get('s')!).degraded).toBe(false);
      expect(widths(p.shapes.get('s')!)).toEqual(expectedWidths);
    }
  } finally { a.doc.off('update', deliver); }
});

test.each([[10,20], [20,10]])('Review D3 seed race: erased seed geometry gets explicit seed tokens after concurrent edit (A=%i, B=%i)', (aId,bId) => {
  const bytes=seed(),a=peer(bytes,aId),b=peer(bytes,bId);
  eraseShape(a.history,'canvas','s');move(b,{x:55});exchange(a,b);
  a.history.undo();exchange(a,b);
  for (const p of [a,b]) {
    expect(p.shapes.get('s')!.get('x')).toBe(0);
    expect(p.shapes.get('s')!.get('op:x')).toBe('canvas:seed');
    expect(readCanvas(p.props)).toMatchObject({editable:true,diagnostics:[]});
  }
  a.history.redo();exchange(a,b);expect(a.shapes.has('s')).toBe(false);
});

test('Review token lineage: move → erase → undo → undo returns to seed, then full redo chain', () => {
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  move(a,{x:20});exchange(a,b);
  eraseShape(a.history,'canvas','s');exchange(a,b);
  a.history.undo();exchange(a,b);
  expect(a.history.undo().reason).toBe('applied');exchange(a,b);
  expect(a.shapes.get('s')!.get('x')).toBe(0);
  expect(a.history.redo().reason).toBe('applied');exchange(a,b);
  expect(a.shapes.get('s')!.get('x')).toBe(20);
  expect(a.history.redo().reason).toBe('applied');exchange(a,b);
  expect(a.shapes.has('s')).toBe(false);
});

test('Review diagnostics: missing required scalar names shape/key and is never drawn with a default', () => {
  const {props}=peer(seed(),10);
  const malformed = props.toJSON(); delete malformed.shapes.s.x;
  const scene = readCanvas(malformed);
  expect(scene.editable).toBe(false);
  expect(scene.shapes).toHaveLength(0);
  expect(scene.diagnostics).toContain('Shape s: missing required scalar x');
});

test('Review order ties: equal-ord rebalance and lexicographic (ord,id) sorting are explicit', async () => {
  const {insertShape,placementKey}=await import('./commands');
  const bytes=seed(),a=peer(bytes,10),b=peer(bytes,20);
  const tied = String(a.shapes.get('s')!.get('ord'));
  insertShape(a.history,'canvas',{id:'a',ord:tied});
  exchange(a,b);
  expect(readCanvas(a.props).shapes.map(s=>[s.scalars.ord,s.id])).toEqual([[tied,'a'],[tied,'s']]);
  const key = placementKey(a.history,'canvas','a','s');
  expect(a.history.availability.undo).toBe('Rebalance shapes');
  expect(a.shapes.get('a')!.get('ord')).not.toBe(a.shapes.get('s')!.get('ord'));
  expect(key > String(a.shapes.get('a')!.get('ord')) && key < String(a.shapes.get('s')!.get('ord'))).toBe(true);
  // This time the peer really reorders while the local tied-run rebalance is
  // unexchanged. Their concurrent writes converge without unique-key rules.
  move(b,{ord:'z'});exchange(a,b);
  expect(readCanvas(a.props).shapes.map(s=>s.id)).toEqual(readCanvas(b.props).shapes.map(s=>s.id));
});

function pressureView(p: Peer, shapeId = 's'): {pointCount: number; widths: number[]} {
  const shape = p.shapes.get(shapeId)!;
  const pressure = readPressure(shape);
  expect(pressure.degraded).toBe(false);
  expect(readCanvas(p.props)).toMatchObject({editable:true,diagnostics:[]});
  return {
    pointCount: pressure.q.length,
    widths: pressure.q.map(q=>Number(shape.get('strokeWidth'))*(0.5+q/255)),
  };
}
/** Apply each emitted update separately in both directions; never let a final
 * snapshot hide a transient geometry or fidelity failure. */
function wirePressurePeers(a: Peer, b: Peer): () => void {
  const observe = (p: Peer) => checked(() => { if (p.shapes?.has('s')) pressureView(p); });
  const observeA = observe(a), observeB = observe(b);
  const toB = (update: Uint8Array, origin: unknown) => { if (origin !== 'net') Y.applyUpdate(b.doc, update, 'net'); };
  const toA = (update: Uint8Array, origin: unknown) => { if (origin !== 'net') Y.applyUpdate(a.doc, update, 'net'); };
  a.doc.on('afterTransaction',observeA); b.doc.on('afterTransaction',observeB);
  a.doc.on('update',toB); b.doc.on('update',toA);
  return () => {
    a.doc.off('afterTransaction',observeA); b.doc.off('afterTransaction',observeB);
    a.doc.off('update',toB); b.doc.off('update',toA);
  };
}
function assertReloadEquivalent(a: Peer, b: Peer, expected: ReturnType<typeof pressureView>, shapeId = 's'): void {
  expect(pressureView(a,shapeId)).toEqual(expected); expect(pressureView(b,shapeId)).toEqual(expected);
  const reload = peer(Y.encodeStateAsUpdate(a.doc),30);
  expect(pressureView(reload,shapeId)).toEqual(expected);
  expect(reload.shapes.toJSON()).toEqual(a.shapes.toJSON());
  reload.history.destroy(); reload.doc.destroy();
}

test.each([[10,20],[20,10]])('Round 2 HIGH-1: erase/undo/remote append/redo/undo is reload-equivalent (A=%i, B=%i)', (aId,bId) => {
  const bytes=seed(),a=peer(bytes,aId),b=peer(bytes,bId),disconnect=wirePressurePeers(a,b);
  try {
    appendPoints(a.history,'canvas','s',[1,2,3,4],[0.2,0.8]);
    eraseShape(a.history,'canvas','s'); a.history.undo();
    appendPoints(b.history,'canvas','s',[5,6,7,8],[0.4,1]);
    const expected=pressureView(b); expect(expected.pointCount).toBe(4);
    a.history.redo(); expect(a.shapes.has('s')).toBe(false); expect(b.shapes.has('s')).toBe(false);
    a.history.undo(); assertReloadEquivalent(a,b,expected);
  } finally { disconnect(); }
});

test.each([[10,20],[20,10]])('Round 2 HIGH-2: whole canvas block delete/undo restores portable pressure (A=%i, B=%i)', (aId,bId) => {
  const bytes=seed(),a=peer(bytes,aId),b=peer(bytes,bId),disconnect=wirePressurePeers(a,b);
  try {
    appendPoints(a.history,'canvas','s',[1,2,3,4],[0.2,0.8]);
    const expected=pressureView(a);
    a.history.stopCapturing(); removeBlock(a.doc,'canvas'); a.history.stopCapturing();
    expect(findBlock(a.doc,'canvas')).toBeNull(); expect(findBlock(b.doc,'canvas')).toBeNull();
    a.history.undo(); assertReloadEquivalent(a,b,expected);
  } finally { disconnect(); }
});

const eraseMatrix = (['shape','page'] as const).flatMap(scope => [[10,20],[20,10]].flatMap(ids =>
  [0,2].flatMap(cycles => (['none','append','edit','append+edit'] as const).map(remote => ({
    scope, ids, cycles, remote,
    name: `Erase composition matrix: ${scope}, A=${ids[0]}/B=${ids[1]}, redo/undo cycles=${cycles}, remote=${remote}, reload`,
  })))));
test.each(eraseMatrix.map(row => [row.name,row] as const))('%s', (_name,{scope,ids,cycles,remote}) => {
  const bytes=seed(),a=peer(bytes,ids[0]),b=peer(bytes,ids[1]),disconnect=wirePressurePeers(a,b);
  const mutateRemote = (leg: number) => {
    if (remote === 'append' || remote === 'append+edit') appendPoints(b.history,'canvas','s',[leg+4,leg+5,leg+6,leg+7],[0.4,0.9]);
    if (remote === 'edit' || remote === 'append+edit') move(b,{x:70+leg,strokeWidth:4+leg});
  };
  try {
    appendPoints(a.history,'canvas','s',[1,2,3,4],[0.2,0.8]);
    mutateRemote(0); // remote work before the first erase is part of its baseline
    let expected=pressureView(b), expectedX=b.shapes.get('s')!.get('x');
    if (scope === 'shape') eraseShape(a.history,'canvas','s');
    else { a.history.stopCapturing(); removeBlock(a.doc,'canvas'); a.history.stopCapturing(); }
    a.history.undo();
    expect(pressureView(a)).toEqual(expected); expect(pressureView(b)).toEqual(expected);
    for (let leg=1;leg<=cycles;leg++) {
      mutateRemote(leg); // remote appends/edits between restoration and re-erase
      expected=pressureView(b); expectedX=b.shapes.get('s')!.get('x');
      a.history.redo();
      expect(a.shapes?.has('s') ?? false).toBe(false); expect(b.shapes?.has('s') ?? false).toBe(false);
      a.history.undo();
      expect(pressureView(a)).toEqual(expected); expect(pressureView(b)).toEqual(expected);
      expect(a.shapes.get('s')!.get('x')).toBe(expectedX); expect(b.shapes.get('s')!.get('x')).toBe(expectedX);
    }
    assertReloadEquivalent(a,b,expected);
  } finally { disconnect(); }
});

test.each([[10,20],[20,10]])('Round 2 scalar recapture: re-erase race restores the latest pre-redo baseline (A=%i, B=%i)', (aId,bId) => {
  const bytes=seed(),a=peer(bytes,aId),b=peer(bytes,bId);
  move(a,{x:20}); exchange(a,b); eraseShape(a.history,'canvas','s'); exchange(a,b);
  a.history.undo(); exchange(a,b);
  move(b,{x:80}); exchange(a,b);
  const baselineToken=a.shapes.get('s')!.get('op:x');
  a.history.redo(); // capture 80 before re-erasing; peer has not received this yet
  move(b,{x:99}); exchange(a,b);
  const disconnect=wirePressurePeers(a,b);
  try {
    a.history.undo();
    for (const p of [a,b]) {
      expect(p.shapes.get('s')!.get('x')).toBe(80);
      expect(p.shapes.get('s')!.get('op:x')).toBe(baselineToken);
    }
    assertReloadEquivalent(a,b,pressureView(a));
  } finally { disconnect(); }
});

test.each([[10,20],[20,10]])('Round 2 root redo restoration: newly created pressure stroke survives undo/redo/reload (A=%i, B=%i)', (aId,bId) => {
  const bytes=seed(),a=peer(bytes,aId),b=peer(bytes,bId),disconnect=wirePressurePeers(a,b);
  for (const p of [a,b]) p.doc.on('afterTransaction',checked(()=>{ if(p.shapes.has('t')) pressureView(p,'t'); }));
  try {
    a.history.structural('Create pressure stroke',()=>{
      a.shapes.set('t',createShape({id:'t',kind:'stroke',pressureMode:'variable'}));
      const shape=a.shapes.get('t')!, points=shape.get('points') as Y.Array<number>;
      points.push([1,2,51,3,4,204]);
    });
    const expected=pressureView(a,'t');
    a.history.undo();expect(a.shapes.has('t')).toBe(false);expect(b.shapes.has('t')).toBe(false);
    a.history.redo();assertReloadEquivalent(a,b,expected,'t');
  } finally { disconnect(); }
});


const appendMatrix = [[10,20],[20,10]].flatMap(ids => ['before undo','between undo and redo'].map(timing=>({ids,timing,
  name:`Append composition matrix: tombstone, remote ${timing}, A=${ids[0]}/B=${ids[1]}, reload`,
})));
test.each(appendMatrix.map(row => [row.name,row] as const))('%s',(_name,{ids,timing})=>{
  const a=peer(seed(),ids[0]),b=peer(seed(),ids[1]),disconnect=wirePressurePeers(a,b);
  try {
    appendPoints(a.history,'canvas','s',[1,2,3,4],[0.2,0.8]);
    if(timing==='before undo') appendPoints(b.history,'canvas','s',[5,6,7,8],[0.4,1]);
    a.history.undo();
    if(timing==='between undo and redo') appendPoints(b.history,'canvas','s',[5,6,7,8],[0.4,1]);
    // Same former tombstone construction: points and q share one array and
    // no pressure map/anchor can remain healthy at a different point offset.
    a.history.redo();
    for (const p of [a,b]) {
      const shape=p.shapes.get('s')!;
      expect(shape.has('pressureBatches')).toBe(false);
      expect((shape.get('points') as Y.Array<number>).toArray()).toEqual([1,2,51,3,4,204,5,6,102,7,8,255]);
    }
    const expected={pointCount:4,widths:[51,204,102,255].map(q=>3*(0.5+q/255))};
    assertReloadEquivalent(a,b,expected);
    a.history.undo();assertReloadEquivalent(a,b,{pointCount:2,widths:[102,255].map(q=>3*(0.5+q/255))});
    a.history.redo();assertReloadEquivalent(a,b,expected);
  } finally { disconnect(); }
});

const concurrentEraseMatrix=(['shape','page'] as const).flatMap(scope=>[[10,20],[20,10]].flatMap(ids=>
  [0,2].flatMap(cycles=>['append','edit','append+edit'].map(remote=>({scope,ids,cycles,remote,
    name:`Erase composition matrix: CONCURRENT ${scope}, A=${ids[0]}/B=${ids[1]}, cycles=${cycles}, remote=${remote}, reload`,
  })))));
test.each(concurrentEraseMatrix.map(row => [row.name,row] as const))('%s',(_name,{scope,ids,cycles,remote})=>{
  const bytes=seed(),a=peer(bytes,ids[0]),b=peer(bytes,ids[1]);
  appendPoints(a.history,'canvas','s',[1,2,3,4],[0.2,0.8]);exchange(a,b);
  let disconnect=()=>{};
  try {
    for(let leg=0;leg<=cycles;leg++) {
      const expected=pressureView(a),x=a.shapes.get('s')!.get('x');
      if(leg) a.history.redo();
      else if(scope==='shape') eraseShape(a.history,'canvas','s');
      else { a.history.stopCapturing();removeBlock(a.doc,'canvas');a.history.stopCapturing(); }
      if(remote.includes('append')) appendPoints(b.history,'canvas','s',[5,6,7,8],[0.4,1]);
      if(remote.includes('edit')) move(b,{x:55+leg});
      exchange(a,b);
      disconnect=wirePressurePeers(a,b);
      const result=a.history.undo();
      if(remote.includes('edit')) expect(result.diagnostics).toContain('Canvas canvas shape s: missing required scalar x; restoring captured value');
      expect(a.shapes.get('s')!.get('x')).toBe(x);
      assertReloadEquivalent(a,b,expected);
      if(leg<cycles) { move(b,{x:80+leg}); }
      disconnect();
    }
  } finally {disconnect();}
});

test.each([[10,20],[20,10]])('Erase composition matrix: simultaneous peer erase/undo, interleaved redo/undo, reload (A=%i, B=%i)',(aId,bId)=>{
  const bytes=seed(),a=peer(bytes,aId),b=peer(bytes,bId);
  appendPoints(a.history,'canvas','s',[1,2,3,4],[0.2,0.8]);exchange(a,b);
  const expected=pressureView(a);
  eraseShape(a.history,'canvas','s');eraseShape(b.history,'canvas','s');exchange(a,b);
  a.history.undo();b.history.undo();exchange(a,b);assertReloadEquivalent(a,b,expected);
  a.history.redo();exchange(a,b);b.history.redo();exchange(a,b);
  b.history.undo();exchange(a,b);a.history.undo();exchange(a,b);assertReloadEquivalent(a,b,expected);
});

test('Option B scope: unrelated page/shape undo does not inspect quarantined shapes',()=>{
  const doc=new Y.Doc();Y.applyUpdate(doc,seed());
  const props=findBlock(doc,'canvas')!.block.get('props') as Y.Map<unknown>;
  const shapes=props.get('shapes') as Y.Map<Y.Map<unknown>>;
  (shapes.get('s')!.get('points') as Y.Array<number>).push([1,2,999]);
  const a={doc,shapes,history:new CanvasHistory(doc)};
  expect(readCanvas(props).diagnostics.join(' ')).toContain('pressure q');
  a.history.structural('Other shape',()=>a.shapes.set('t',createShape({id:'t'})));
  expect(a.history.undo().diagnostics).toBeUndefined();
  expect(a.history.redo().diagnostics).toBeUndefined();
  a.history.structural('Other page row',()=>{const row=new Y.Map<unknown>();row.set('id','other');row.set('type','paragraph');rootBlocks(a.doc).push([row]);});
  expect(a.history.undo().diagnostics).toBeUndefined();
  expect(a.history.redo().diagnostics).toBeUndefined();
});

test('Option B JSON: mixed canvas has per-shape pointArity; binary has none; default-2 is unchanged',()=>{
  const a=peer(seed(),10);
  a.history.structural('Constant stroke',()=>a.shapes.set('c',createShape({id:'c',kind:'stroke',points:[1,2,3,4]})));
  appendPoints(a.history,'canvas','s',[1,2],[0.5]);
  const projection=projectCanvas(a.props) as {shapes:Record<string,Record<string,unknown>>};
  expect(projection.shapes.s.pointArity).toBe(3);expect(projection.shapes.c.pointArity).toBe(2);
  expect(a.shapes.get('s')!.has('pointArity')).toBe(false);expect(a.props.has('pointArity')).toBe(false);
  expect(readCanvas(projection).shapes).toEqual(readCanvas(a.props).shapes);
  const old={...projection,shapes:{c:{...projection.shapes.c}}};delete old.shapes.c.pointArity;
  const explicit={...projection,shapes:{c:projection.shapes.c}};
  expect(JSON.stringify(readCanvas(old))).toBe(JSON.stringify(readCanvas(explicit)));
  expect(old.shapes.c.points).toEqual([1,2,3,4]);
});

test.each([
  {points:[1,2],pointArity:3,reason:'arity 3'},
  {points:[1,2,128],pointArity:2,reason:'pointArity'},
  {points:[1,2,256],pointArity:3,reason:'pressure q'},
  {points:[1,2,0.5],pointArity:3,reason:'pressure q'},
  {points:[1,Infinity,128],pointArity:3,reason:'Non-finite'},
])('Option B quarantine: $reason',({points,pointArity,reason})=>{
  const a=peer(seed(),10), projection=projectCanvas(a.props) as {shapes:Record<string,Record<string,unknown>>};
  Object.assign(projection.shapes.s,{points,pointArity});
  const scene=readCanvas(projection);
  expect(scene.shapes).toHaveLength(0);expect(scene.editable).toBe(false);
  expect(scene.diagnostics.join(' ')).toContain('shape s');expect(scene.diagnostics.join(' ')).toContain(reason);
});

test.each([[10,20],[20,10]])('Option B mixed-canvas acceptance: pair and triplet undo/redo/reload (A=%i, B=%i)',(aId,bId)=>{
  const a=peer(seed(),aId),b=peer(seed(),bId),disconnect=wirePressurePeers(a,b);
  const verify=(constant:number[],pressure:number[])=>{
    const reload=peer(Y.encodeStateAsUpdate(a.doc),30);
    for(const p of [a,b,reload]) {
      expect(readCanvas(p.props).editable).toBe(true);
      const c=p.shapes.get('c')!,s=p.shapes.get('s')!;
      expect(c.get('pressureMode')).toBe('constant');expect(s.get('pressureMode')).toBe('variable');
      expect((c.get('points') as Y.Array<number>).toArray()).toEqual(constant);
      expect(readPressure(c)).toEqual({q:[],degraded:false,diagnostics:[]});
      expect(readPressure(s)).toEqual({q:pressure,degraded:false,diagnostics:[]});
      expect(pressureView(p).widths).toEqual(pressure.map(q=>3*(0.5+q/255)));
    }
    reload.history.destroy();reload.doc.destroy();
  };
  try {
    a.history.structural('Create constant stroke',()=>a.shapes.set('c',createShape({id:'c',kind:'stroke'})));
    appendPoints(a.history,'canvas','c',[1,2,3,4]);
    appendPoints(a.history,'canvas','s',[5,6,7,8],[0.2,0.8]);verify([1,2,3,4],[51,204]);
    a.history.undo();verify([1,2,3,4],[]);
    a.history.undo();verify([],[]);
    a.history.redo();verify([1,2,3,4],[]);
    a.history.redo();verify([1,2,3,4],[51,204]);
    const projected=projectCanvas(a.props) as {shapes:Record<string,Record<string,unknown>>};
    projected.shapes.c.pointArity=3;
    const scene=readCanvas(projected);
    expect(scene.shapes.map(shape=>shape.id)).toEqual(['s']);
    expect(scene.diagnostics.join(' ')).toContain('shape c: pointArity disagrees with pressureMode');
  } finally {disconnect();}
});


test('Option B persisted projection: generic app codec writes per-shape arity without changing binary state',()=>{
  const a=peer(seed(),10);
  appendPoints(a.history,'canvas','s',[1,2],[0.5]);
  a.history.structural('Constant',()=>a.shapes.set('c',createShape({id:'c',kind:'stroke',points:[3,4]})));
  const before=Y.encodeStateAsUpdate(a.doc),unregister=registerPropsProjection('canvas',projectCanvas);
  try {
    const snapshot=JSON.parse(JSON.stringify(encodeSnapshot(a.doc)));
    expect(snapshot.blocks[0].props.shapes.s.pointArity).toBe(3);
    expect(snapshot.blocks[0].props.shapes.c.pointArity).toBe(2);
    expect(readCanvas(snapshot.blocks[0].props).shapes).toEqual(readCanvas(a.props).shapes);
    expect(Y.encodeStateAsUpdate(a.doc)).toEqual(before);
  } finally {unregister();}
});


test('Root capture narrowing: non-map shape is quarantined and array changes never throw',()=>{
  const doc=new Y.Doc();Y.applyUpdate(doc,seed());
  const props=findBlock(doc,'canvas')!.block.get('props') as Y.Map<unknown>;
  const shapes=props.get('shapes') as Y.Map<unknown>;
  const malformed=new Y.Array<number>();
  doc.transact(()=>shapes.set('broken',malformed),'net');
  const history=new CanvasHistory(doc);
  try {
    expect(()=>doc.transact(()=>malformed.push([1,2]),'net')).not.toThrow();
    const scene=readCanvas(props);
    expect(scene.shapes.map(shape=>shape.id)).toEqual(['s']);
    expect(scene.diagnostics.join(' ')).toContain('Quarantined shape broken');
    expect(scene.editable).toBe(false);
    expect(history.availability).toEqual({undo:null,redo:null});
  } finally {history.destroy();doc.destroy();}
});
