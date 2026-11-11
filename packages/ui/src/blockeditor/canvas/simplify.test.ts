import {it,expect} from 'vitest';
import {simplifyStroke} from './simplify';
it('preserves endpoints, corners and pressure extrema without hard truncation',()=>{
  const points=Array.from({length:300},(_,i)=>[i,i===150?30:0]).flat();const pressure=Array.from({length:300},(_,i)=>i===75?1:.5);
  const s=simplifyStroke(points,pressure,true);expect(s.points.slice(0,2)).toEqual([0,0]);expect(s.points.slice(-2)).toEqual([299,0]);expect(s.points).toContain(150);expect(s.pressure).toContain(1);expect(s.points.length).toBeLessThan(points.length);
  for(let i=0;i<300;i++){let best=Infinity;for(let j=2;j<s.points.length;j+=2){const ax=s.points[j-2],ay=s.points[j-1],dx=s.points[j]-ax,dy=s.points[j+1]-ay,t=Math.max(0,Math.min(1,((points[i*2]-ax)*dx+(points[i*2+1]-ay)*dy)/(dx*dx+dy*dy)));best=Math.min(best,Math.hypot(points[i*2]-ax-t*dx,points[i*2+1]-ay-t*dy));}expect(best).toBeLessThanOrEqual(.5);}
});
