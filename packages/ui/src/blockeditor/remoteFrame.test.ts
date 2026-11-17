import {afterEach,expect,test,vi} from 'vitest';
import * as Y from 'yjs';
import {registerRemoteFrameBatching,remoteFrameQueue} from './remoteFrame';
let unregister:(()=>void)|undefined;
afterEach(()=>{unregister?.();unregister=undefined;vi.unstubAllGlobals();});

test.each(['bc-remote','net'] as const)('%s delivery burst exposes one complete observer state; local edits remain immediate; reload agrees',origin=>{
  const callbacks=new Map<number,FrameRequestCallback>();let counter=0;
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callbacks.set(++counter,callback);return counter;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>callbacks.delete(id));
  unregister=registerRemoteFrameBatching();
  const doc=new Y.Doc(),seed=doc.getMap('shape');seed.set('x',0);seed.set('y',0);seed.set('stroke','black');
  const peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(doc));const updates:Uint8Array[]=[];peer.on('update',(update:Uint8Array)=>updates.push(update));
  peer.getMap('shape').set('x',8);peer.getMap('shape').set('stroke','red');
  const observations:unknown[]=[];doc.on('afterTransaction',transaction=>{if(transaction.origin===origin)observations.push(seed.toJSON());});
  const queue=remoteFrameQueue(doc,origin);for(const bytes of updates)queue.receive(bytes);
  expect(callbacks.size).toBe(1);expect(seed.get('x')).toBe(0);
  doc.transact(()=>seed.set('y',1),'local');expect(seed.get('y')).toBe(1);expect(observations).toEqual([]);
  [...callbacks.values()][0](0);
  expect(observations).toEqual([{x:8,y:1,stroke:'red'}]);
  Y.applyUpdate(peer,Y.encodeStateAsUpdate(doc));const fresh=new Y.Doc();Y.applyUpdate(fresh,Y.encodeStateAsUpdate(doc));
  expect(peer.getMap('shape').toJSON()).toEqual(seed.toJSON());expect(fresh.getMap('shape').toJSON()).toEqual(seed.toJSON());
  queue.receive(updates[0]);queue.close();expect(seed.toJSON()).toEqual({x:8,y:1,stroke:'red'});expect(callbacks.size).toBe(0);
});

test('unregistered/headless provider keeps synchronous delivery',()=>{
  const doc=new Y.Doc(),peer=new Y.Doc();peer.getMap('shape').set('x',4);remoteFrameQueue(doc,'net').receive(Y.encodeStateAsUpdate(peer));expect(doc.getMap('shape').get('x')).toBe(4);
});
