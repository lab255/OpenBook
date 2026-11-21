import type {Point} from './geometry';
export interface Curve {a:Point;b:Point;c:Point;d:Point}
const mix=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const clamp=(p:Point,a:Point,b:Point):Point=>({x:Math.max(Math.min(a.x,b.x),Math.min(Math.max(a.x,b.x),p.x)),y:Math.max(Math.min(a.y,b.y),Math.min(Math.max(a.y,b.y),p.y))});
/** Interpolating Catmull–Rom controls, clamped to each retained interval.
 * Every retained point is an exact endpoint. Sharp corners have zero tangent;
 * controls stay inside the interval's bounding box, so curves cannot overshoot
 * retained bounds. This is render geometry only; stored points/q never change.
 */
export function strokeCurves(points:readonly Point[]):Curve[] {
  const tangent=(i:number):Point=>{
    const p=points[i],before=points[i-1]??p,after=points[i+1]??p;
    const ax=p.x-before.x,ay=p.y-before.y,bx=after.x-p.x,by=after.y-p.y;
    if(i>0&&i<points.length-1&&(ax*bx+ay*by)<Math.SQRT1_2*Math.hypot(ax,ay)*Math.hypot(bx,by))return {x:0,y:0};
    return {x:(after.x-before.x)/6,y:(after.y-before.y)/6};
  };
  return points.slice(1).map((d,i)=>{const a=points[i],ta=tangent(i),td=tangent(i+1);return {a,b:clamp({x:a.x+ta.x,y:a.y+ta.y},a,d),c:clamp({x:d.x-td.x,y:d.y-td.y},a,d),d};});
}
export function curvePoint(c:Curve,t:number):Point {
  if(t===0)return c.a;if(t===1)return c.d;
  const ab=mix(c.a,c.b,t),bc=mix(c.b,c.c,t),cd=mix(c.c,c.d,t);
  return mix(mix(ab,bc,t),mix(bc,cd,t),t);
}
export function splitCurve(c:Curve,t:number):[Curve,Curve] {
  if(t===0)return [{a:c.a,b:c.a,c:c.a,d:c.a},c];
  if(t===1)return [c,{a:c.d,b:c.d,c:c.d,d:c.d}];
  const ab=mix(c.a,c.b,t),bc=mix(c.b,c.c,t),cd=mix(c.c,c.d,t),abc=mix(ab,bc,t),bcd=mix(bc,cd,t),p=mix(abc,bcd,t);
  return [{a:c.a,b:ab,c:abc,d:p},{a:p,b:bcd,c:cd,d:c.d}];
}
