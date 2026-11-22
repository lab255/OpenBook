import {afterEach,expect,test,vi} from 'vitest';
import * as Y from 'yjs';
import {Awareness,applyAwarenessUpdate,encodeAwarenessUpdate} from 'y-protocols/awareness';
import {canvasFacet,canvasProducer,facetBytes,readCanvasFacet} from './presence';

afterEach(()=>vi.useRealTimers());
function setup(){vi.useFakeTimers();const doc=new Y.Doc(),awareness=new Awareness(doc),producer=canvasProducer(awareness);const log:{at:number;value:unknown}[]=[];awareness.on('update',()=>log.push({at:Date.now(),value:awareness.getLocalState()?.canvas}));const facet=canvasFacet('board',{x:0,y:0},'pen',[])!;producer.state(facet);return {awareness,producer,facet,log,close(){producer.dispose();awareness.destroy();doc.destroy();}};}
test('clear beats queued position; immediate rejoin is present, not a sticky clear',()=>{
  const a=setup();a.producer.position({x:1,y:1});vi.advanceTimersByTime(20);a.producer.position({x:2,y:2});a.producer.clear();expect(a.awareness.getLocalState()?.canvas).toBeNull();vi.advanceTimersByTime(100);expect(a.awareness.getLocalState()?.canvas).toBeNull();
  a.producer.state(a.facet);expect(a.awareness.getLocalState()?.canvas).toEqual(a.facet);a.producer.position({x:3,y:3});a.producer.position({x:4,y:4});a.producer.clear();a.producer.state({...a.facet,tool:'select'});vi.advanceTimersByTime(100);expect(a.awareness.getLocalState()?.canvas).toEqual({...a.facet,tool:'select'});a.close();
});
test('move storm has <=10Hz position emission and newest-per-slot liveness',()=>{
  const a=setup();a.log.length=0;
  for(let time=0;time<1000;time+=10){a.producer.position({x:time,y:time});vi.advanceTimersByTime(10);}
  const emitted=a.log.map(row=>({at:row.at,x:(row.value as {cursor:{x:number}}).cursor.x}));
  expect(emitted.length).toBeGreaterThanOrEqual(10);
  for(let i=1;i<emitted.length;i++)expect(emitted[i].at-emitted[i-1].at).toBeGreaterThanOrEqual(100);
  expect(emitted.map(row=>row.x)).toEqual([0,90,190,290,390,490,590,690,790,890,990]);a.close();
});
test('tool and selection transitions bypass pending-position coalescing at producer boundary',()=>{
  const a=setup();a.producer.position({x:1,y:1});a.producer.position({x:2,y:2});a.producer.state({...a.facet,tool:'rect'});a.producer.state({...a.facet,tool:'select',selectedShapeIds:['shape']});
  expect(a.log.slice(-2).map(row=>(row.value as {tool:string}).tool)).toEqual(['rect','select']);vi.advanceTimersByTime(100);expect(a.awareness.getLocalState()?.canvas.selectedShapeIds).toEqual(['shape']);a.close();
});
test('facet bounds: Unicode UTF-8 budget, count, id length, invalid coordinates; rejection mirrors',()=>{
  const ids=Array.from({length:80},(_,i)=>`${i}${'界'.repeat(125)}`),f=canvasFacet('board',{x:Infinity,y:0},'pen',ids)!;
  expect(f.selectedShapeIds.length).toBeLessThan(64);expect(facetBytes(f)).toBeLessThanOrEqual(12288);expect(f.selectionTruncated).toBe(true);expect(f.cursor).toBeNull();expect(readCanvasFacet(f)).toEqual(f);
  const ascii=canvasFacet('board',null,'select',Array.from({length:65},(_,i)=>String(i)))!;expect(ascii.selectedShapeIds).toHaveLength(64);
  expect(canvasFacet('board',null,'select',['x'.repeat(129)])!.selectedShapeIds).toEqual([]);
  expect(readCanvasFacet({...f,selectedShapeIds:['x'.repeat(129)]})).toBeNull();expect(readCanvasFacet({...f,cursor:{x:NaN,y:0}})).toBeNull();
  expect(readCanvasFacet(canvasFacet('board',{x:3,y:4},'pan',['ok']))).not.toBeNull();
});
test('killed peer facet expires on inherited awareness TTL; live refresh mirror',()=>{
  vi.useFakeTimers();const local=new Awareness(new Y.Doc()),remote=new Awareness(new Y.Doc());remote.setLocalStateField('canvas',canvasFacet('board',{x:1,y:2},'pen',[]));
  applyAwarenessUpdate(local,encodeAwarenessUpdate(remote,[remote.clientID]),'net');expect(local.getStates().has(remote.clientID)).toBe(true);
  vi.advanceTimersByTime(15000);applyAwarenessUpdate(local,encodeAwarenessUpdate(remote,[remote.clientID]),'net');vi.advanceTimersByTime(15000);expect(local.getStates().has(remote.clientID)).toBe(true);
  // lib0 captures Date.now at module evaluation; age only the remote metadata
  // to exercise its real expiry callback, rather than claiming fake wall time.
  local.meta.get(remote.clientID)!.lastUpdated-=30001;vi.advanceTimersByTime(3000);expect(local.getStates().has(remote.clientID)).toBe(false);local.destroy();remote.destroy();
});

test('reader rejects hostile count and UTF-8 byte overflow with boundary mirrors',()=>{
  const base=canvasFacet('board',null,'pen',[])!;
  const ids=Array.from({length:64},(_,i)=>String(i));
  expect(readCanvasFacet({...base,selectedShapeIds:ids})).not.toBeNull();
  expect(readCanvasFacet({...base,selectedShapeIds:[...ids,'65']})).toBeNull();
  const unicode={...base,selectedShapeIds:Array.from({length:64},()=> '界'.repeat(128))};
  expect(facetBytes(unicode)).toBeGreaterThan(12288);expect(readCanvasFacet(unicode)).toBeNull();
  expect(readCanvasFacet({...base,selectedShapeIds:Array.from({length:64},()=> 'a'.repeat(128))})).not.toBeNull();
});
test('unchanged state emissions are deduplicated without suppressing queued position or transitions',()=>{
  const a=setup();const send=vi.spyOn(a.awareness,'setLocalStateField');
  a.producer.state({...a.facet,selectedShapeIds:[]});expect(send).not.toHaveBeenCalled();
  a.producer.position({x:1,y:1});a.producer.position({x:2,y:2});send.mockClear();
  for(let i=0;i<20;i++){a.producer.state({...a.facet,cursor:{x:2,y:2}});a.producer.state({...a.facet,cursor:{x:1,y:1}});}
  expect(send).not.toHaveBeenCalled();vi.advanceTimersByTime(100);expect(a.awareness.getLocalState()?.canvas.cursor).toEqual({x:2,y:2});
  a.producer.state({...a.facet,tool:'rect'});expect(a.awareness.getLocalState()?.canvas.tool).toBe('rect');
  a.producer.clear();a.producer.state(a.facet);expect(a.awareness.getLocalState()?.canvas).toEqual(a.facet);a.close();
});
