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

test('rendered fidelity: random walks, integer sine and the all-original terminal case; deterministic reload inputs',async()=>{
  const {chordDistance,curvePoint,strokeCurves}=await import('./strokeCurve');
  let seed=19;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const populations:number[][]=[[0,0,100,100,200,150],Array.from({length:300},(_,i)=>[i,Math.round(i*.3)]).flat(),Array.from({length:300},(_,i)=>[i,Math.round(20*Math.sin(i/15))]).flat()];
  for(let n=0;n<199;n++){
    let x=0,y=0;const points=[x,y];
    for(let i=1;i<80;i++){x+=(random()-.5)*20;y+=(random()-.5)*20;points.push(x,y);}populations.push(points);
  }
  for(const original of populations){
    const result=simplifyStroke(original,2),points=Array.from({length:result.retained},(_,i)=>({x:result.points[2*i],y:result.points[2*i+1]}));
    const curves=strokeCurves(points);
    expect(JSON.stringify(strokeCurves(JSON.parse(JSON.stringify(points))))).toEqual(JSON.stringify(curves));
    const raw=Array.from({length:original.length/2},(_,i)=>({x:original[2*i],y:original[2*i+1]}));
    let worst=0;
    for(const curve of curves)for(let i=0;i<=32;i++){
      const point=curvePoint(curve,i/32);
      worst=Math.max(worst,Math.min(...raw.slice(1).map((end,j)=>chordDistance(point,raw[j],end))));
    }
    expect(worst).toBeLessThanOrEqual(.500000001);
  }
  // Meter control: the former uncapped curve from the terminal counterexample.
  expect(chordDistance(curvePoint({a:{x:100,y:100},b:{x:400/3,y:125},c:{x:550/3,y:425/3},d:{x:200,y:150}},1/3),{x:100,y:100},{x:200,y:150})).toBeGreaterThan(.5);
});

test('lattice steps compress like float lines; sustained right-angle corners survive',()=>{
  const line=(quantized:boolean)=>Array.from({length:300},(_,i)=>[i,quantized?Math.round(i*.3):i*.3]).flat();
  expect(simplifyStroke(line(false),2).retained).toBe(4);
  expect(simplifyStroke(line(true),2).retained).toBe(7);
  expect(simplifyStroke([0,0,10,0,20,0,20,10,20,20],2).points).toContain(20);
  expect(simplifyStroke([0,0,10,0,20,0,20,10,20,20],2).points).toEqual([0,0,20,0,20,20]);
});
