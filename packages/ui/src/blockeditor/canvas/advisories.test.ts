import {expect, test} from 'vitest';
import * as Y from 'yjs';
import {cloneBlock, createDoc, findBlock, makeBlock, moveBlock, registerPropsConstructor, registerPropsProjection, rootBlocks} from '../model';
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
