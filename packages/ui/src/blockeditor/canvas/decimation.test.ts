import {expect,test} from 'vitest';
import {simplifyStroke} from './decimation';
import {snapPoint} from './precision';

test('simplification carries q, endpoints, corners, pressure extrema and verifies original deviations',()=>{
  for(const arity of [2,3] as const){
    const original=Array.from({length:513},(_,i)=>arity===3?[i/4,Math.sin(i/13)*3,Math.round(128+100*Math.sin(i/21))]:[i/4,Math.sin(i/13)*3]).flat();const result=simplifyStroke(original,arity);
    expect(result.retained).toBeLessThan(result.original);expect(result.points.slice(0,arity)).toEqual(original.slice(0,arity));expect(result.points.slice(-arity)).toEqual(original.slice(-arity));
    const kept=Array.from({length:result.retained},(_,i)=>result.points.slice(i*arity,i*arity+arity));
    for(let i=0;i<original.length;i+=arity){const p=original.slice(i,i+arity),next=kept.findIndex(q=>q[0]>=p[0]),lo=kept[Math.max(0,next-1)],hi=kept[Math.max(0,next)];const dx=hi[0]-lo[0],dy=hi[1]-lo[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-lo[0])*dx+(p[1]-lo[1])*dy)/d)):0;expect(Math.hypot(p[0]-lo[0]-t*dx,p[1]-lo[1]-t*dy)).toBeLessThanOrEqual(.500000001);if(arity===3)expect(Math.abs(p[2]-lo[2]-t*(hi[2]-lo[2]))).toBeLessThanOrEqual(1.000000001);}
    for(const p of kept)expect(original.slice(p[0]*4*arity,p[0]*4*arity+arity)).toEqual(p);
  }
  expect(simplifyStroke([0,0,1,0,1,1,2,1],2).points).toEqual([0,0,1,0,1,1,2,1]);
  expect(simplifyStroke([0,0,10,1,0,240,2,0,10],3).points).toEqual([0,0,10,1,0,240,2,0,10]);
});
test('fidelity over budget preserves geometry, signals overrun, never truncates or mutates source',()=>{
  const source=Array.from({length:2001},(_,i)=>[i,i%2?10:0]).flat(),before=[...source];const result=simplifyStroke(source,2);expect(result.overrun).toBe(true);expect(result.points).toEqual(source);expect(source).toEqual(before);
  expect(simplifyStroke([0,0,1,0,2,0],2).overrun).toBe(false);
});
test('grid snap threshold is screen-space; bypass and disabled mirrors',()=>{
  expect(snapPoint({x:14,y:35},1,true,false)).toEqual({point:{x:16,y:32},guides:{x:16,y:32}});
  expect(snapPoint({x:14,y:35},4,true,false)).toEqual({point:{x:14,y:35},guides:{}});
  expect(snapPoint({x:15,y:32},4,true,false).point).toEqual({x:16,y:32});
  for(const [enabled,bypass] of [[false,false],[true,true]])expect(snapPoint({x:14,y:35},1,enabled,bypass)).toEqual({point:{x:14,y:35},guides:{}});
});
