import {it,expect,vi} from 'vitest';
import * as Y from 'yjs';
import type {DataClient} from '@book.dev/sdk';
import {connectPageRelay} from '../relay';
import {CanvasHistory} from './history';
import {newShape} from './state';
it('actual relay queue delivers structural undo/redo bytes exactly once without echo',async()=>{
  vi.useFakeTimers();
  const a=new Y.Doc(),b=new Y.Doc(),root=a.getArray<Y.Map<unknown>>('blocks');root.push([newShape('rect')]);Y.applyUpdate(b,Y.encodeStateAsUpdate(a));
  const history=new CanvasHistory(a,root);let posts=0;
  const subscribers:((update:string,id:number)=>void)[]=[];
  const client={subscribePageUpdates:(_id:string,cb:(u:string,c:number)=>void)=>{subscribers.push(cb);return()=>{};},syncPageUpdates:async()=>'',postPageUpdate:async(_id:string,u:string,id:number)=>{posts++;subscribers.forEach(cb=>cb(u,id));}} as unknown as DataClient;
  const ac=connectPageRelay(a,'p',client),bc=connectPageRelay(b,'p',client);
  try {
    history.structural('erase',()=>root.delete(0,1));await vi.advanceTimersByTimeAsync(200);expect(b.getArray('blocks').length).toBe(0);expect(posts).toBe(1);
    history.undo();await vi.advanceTimersByTimeAsync(200);expect(b.getArray('blocks').length).toBe(1);expect(posts).toBe(2);
    history.redo();await vi.advanceTimersByTimeAsync(200);expect(b.getArray('blocks').length).toBe(0);expect(posts).toBe(3);
  }finally{ac.disconnect();bc.disconnect();history.destroy();vi.useRealTimers();}
});
