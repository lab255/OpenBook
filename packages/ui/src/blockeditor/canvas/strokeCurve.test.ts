import {expect,test} from 'vitest';
import {curvePoint,splitCurve,strokeCurves} from './strokeCurve';

test('render curves pass through every retained point and stay inside each retained interval',()=>{
  const points=[{x:0,y:0},{x:10,y:2},{x:20,y:9},{x:25,y:0},{x:25,y:20}];
  const curves=strokeCurves(points);
  curves.forEach((c,i)=>{
    expect(curvePoint(c,0)).toEqual(points[i]);expect(curvePoint(c,1)).toEqual(points[i+1]);
    for(let n=0;n<=100;n++){
      const p=curvePoint(c,n/100);
      for(const axis of ['x','y'] as const){expect(p[axis]).toBeGreaterThanOrEqual(Math.min(c.a[axis],c.d[axis])-1e-12);expect(p[axis]).toBeLessThanOrEqual(Math.max(c.a[axis],c.d[axis])+1e-12);}
    }
  });
  // Corner at the third retained point is interpolated exactly, not rounded off.
  expect(curves[1].c).toEqual(points[2]);expect(curves[2].b).toEqual(points[2]);
  expect(curvePoint(curves[0],.5)).not.toEqual({x:5,y:1}); // Control: genuinely curved.
  expect(points).toEqual([{x:0,y:0},{x:10,y:2},{x:20,y:9},{x:25,y:0},{x:25,y:20}]);
});

test('pressure subdivisions preserve the exact same render curve',()=>{
  const c=strokeCurves([{x:0,y:0},{x:10,y:3},{x:20,y:8}])[0],t=.3;
  expect(splitCurve(c,0)[1]).toBe(c);expect(splitCurve(c,1)[0]).toBe(c);
  const [a,b]=splitCurve(c,t);
  for(let n=0;n<=20;n++){
    const u=n/20,p=curvePoint(c,u),q=u<=t?curvePoint(a,u/t):curvePoint(b,(u-t)/(1-t));
    expect(q.x).toBeCloseTo(p.x,12);expect(q.y).toBeCloseTo(p.y,12);
  }
});
