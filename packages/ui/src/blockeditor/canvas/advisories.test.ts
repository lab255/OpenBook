import {expect, test} from 'vitest';
import * as Y from 'yjs';
import {cloneBlock, dropBeside, nestInToggle, createDoc, findBlock, makeBlock, moveBlock, registerPropsConstructor, registerPropsProjection, rootBlocks} from '../model';
import {CanvasHistory} from './history';
import {appendPoints, insertShape} from './commands';
import {canvasDefaults, constructCanvasProps, createShape, pointData, projectCanvas, readCanvas} from './schema';

registerPropsConstructor('canvas', constructCanvasProps);
registerPropsProjection('canvas', projectCanvas);
const scene = (doc: Y.Doc, id: string) => readCanvas(findBlock(doc,id)!.block.get('props'));
function sync(a: Y.Doc, b: Y.Doc) { const aa=Y.encodeStateAsUpdate(a),bb=Y.encodeStateAsUpdate(b);Y.applyUpdate(a,bb);Y.applyUpdate(b,aa); }

test.each([[11,22],[22,11]])('A1: block move + duplicate then draw, two replicas and fresh binary reload (%i,%i)', (aid,bid) => {
  const a=createDoc([]);a.clientID=aid;
  rootBlocks(a).push([makeBlock({id:'canvas',type:'canvas',props:{...canvasDefaults,shapes:{}}}),makeBlock({id:'paragraph',type:'paragraph'})]);
  const b=new Y.Doc();b.clientID=bid;Y.applyUpdate(b,Y.encodeStateAsUpdate(a));
  const history=new CanvasHistory(a);
  insertShape(history,'canvas',{id:'original',kind:'stroke',pressureMode:'variable',...pointData([0,0,10,10],[0.2,0.8])});sync(a,b);
  moveBlock(a,'canvas',null,2);sync(a,b);
  const copy=cloneBlock(findBlock(a,'canvas')!.block,true);
  a.transact(()=>rootBlocks(a).push([copy]),'local');
  const copiedId=copy.get('id') as string;sync(a,b);
  for(const id of ['canvas',copiedId]) {
    insertShape(history,id,{id:'new',kind:'stroke',...pointData([20,30,40,50])});
    appendPoints(history,id,'original',pointData([20,20],[0.4]));
  }
  sync(a,b);
  const fresh=new Y.Doc();Y.applyUpdate(fresh,Y.encodeStateAsUpdate(a));
  for(const id of ['canvas',copiedId]) {
    expect(scene(a,id).editable).toBe(true);
    expect(scene(a,id).shapes).toHaveLength(2);
    expect(scene(a,id)).toEqual(scene(b,id));expect(scene(fresh,id)).toEqual(scene(a,id));
    expect(scene(a,id).shapes.find(s=>s.id==='original')!.points).toEqual([0,0,51,10,10,204,20,20,102]);
    const props=findBlock(fresh,id)!.block.get('props') as Y.Map<unknown>;
    expect((props.get('shapes') as Y.Map<Y.Map<unknown>>).get('original')!.has('pointArity')).toBe(false);
  }
  history.destroy();a.destroy();b.destroy();fresh.destroy();
});

test('A2/A3: tagged create and append share one representation; raw variable pairs cannot silently become triplets',()=>{
  expect(()=>createShape({kind:'stroke',pressureMode:'variable',points:[1,2,3,4,5,6]})).toThrow('explicit pointArity');
  const doc=createDoc([{id:'canvas',type:'canvas',props:{...canvasDefaults,shapes:{}}}]);
  const history=new CanvasHistory(doc);
  const data=pointData([1,2,3,4],[0.2,0.8]);
  insertShape(history,'canvas',{id:'s',kind:'stroke',pressureMode:'variable',...data});
  appendPoints(history,'canvas','s',data);
  expect(scene(doc,'canvas').shapes[0]).toMatchObject({pointArity:3,points:[...data.points,...data.points]});
  expect(()=>appendPoints(history,'canvas','s',pointData([1,2]))).toThrow('pointArity');
  const fresh=new Y.Doc();Y.applyUpdate(fresh,Y.encodeStateAsUpdate(doc));expect(scene(fresh,'canvas')).toEqual(scene(doc,'canvas'));
  history.destroy();
});


test.each(['dropBeside left','moveBlock','indent','duplicate'])('quarantined ord survives %s, broadcast and fresh reload without a transaction throw',operation=>{
  const a=createDoc([{id:'toggle',type:'togglelist'},{id:'canvas',type:'canvas',props:{...canvasDefaults,shapes:{}}},{id:'paragraph',type:'paragraph'}]);
  const props=findBlock(a,'canvas')!.block.get('props') as Y.Map<unknown>;
  const shape=createShape({id:'bad',kind:'rect',points:[]});(props.get('shapes') as Y.Map<unknown>).set('bad',shape);shape.set('ord','!!bad');
  shape.set('futureRecovery',{reason:'preserve me'});const original=shape.toJSON();
  const b=new Y.Doc();Y.applyUpdate(b,Y.encodeStateAsUpdate(a));const broadcasts:Uint8Array[]=[];a.on('update',(update:Uint8Array)=>broadcasts.push(update));
  let target='canvas';
  expect(()=>{
    if(operation==='dropBeside left')dropBeside(a,'canvas','paragraph','left');
    else if(operation==='moveBlock')moveBlock(a,'canvas',null,0);
    else if(operation==='indent')expect(nestInToggle(a,'canvas')).toBe(true);
    else a.transact(()=>{const copy=cloneBlock(findBlock(a,'canvas')!.block,true);rootBlocks(a).push([copy]);target=String(copy.get('id'));},'local');
  }).not.toThrow();
  expect(broadcasts.length).toBeGreaterThan(0);
  for(const update of broadcasts)Y.applyUpdate(b,update);
  const fresh=new Y.Doc();Y.applyUpdate(fresh,Y.encodeStateAsUpdate(a));
  for(const doc of [a,b,fresh]){
    expect(findBlock(doc,'canvas')).not.toBeNull();expect(findBlock(doc,target)).not.toBeNull();
    const next=findBlock(doc,target)!.block.get('props') as Y.Map<unknown>;
    expect(((next.get('shapes') as Y.Map<Y.Map<unknown>>).get('bad')!).toJSON()).toEqual(original);
    expect(readCanvas(next).diagnostics).toContain('Quarantined shape bad: Invalid ord');
    expect(readCanvas(next).editable).toBe(false);
  }
  expect(scene(a,target)).toEqual(scene(b,target));expect(scene(a,target)).toEqual(scene(fresh,target));
});


test.each(['missing scalar','invalid points','invalid arity','invalid container'])('clone retains %s verbatim for quarantine and fresh reload',kind=>{
  const doc=createDoc([{id:'canvas',type:'canvas',props:{...canvasDefaults,shapes:{}}},{id:'after',type:'paragraph'}]);
  const props=findBlock(doc,'canvas')!.block.get('props') as Y.Map<unknown>;
  const shape=createShape({id:'bad',kind:'stroke'});(props.get('shapes') as Y.Map<unknown>).set('bad',shape);
  if(kind==='missing scalar')shape.delete('x');else if(kind==='invalid points')shape.set('points','damaged');else if(kind==='invalid arity')shape.set('pointArity',3);else props.set('shapes',['damaged']);
  const before=props.toJSON();expect(()=>moveBlock(doc,'canvas',null,2)).not.toThrow();
  expect(findBlock(doc,'canvas')!.block.get('props')).not.toBe(props);
  expect((findBlock(doc,'canvas')!.block.get('props') as Y.Map<unknown>).toJSON()).toEqual(before);
  const fresh=new Y.Doc();Y.applyUpdate(fresh,Y.encodeStateAsUpdate(doc));
  expect((findBlock(fresh,'canvas')!.block.get('props') as Y.Map<unknown>).toJSON()).toEqual(before);
  expect(scene(doc,'canvas').editable).toBe(false);expect(scene(doc,'canvas').diagnostics.length).toBeGreaterThan(0);expect(scene(fresh,'canvas')).toEqual(scene(doc,'canvas'));
});
