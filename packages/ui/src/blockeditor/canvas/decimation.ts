import {chordDistance,splitCurve,strokeCurves,type Curve} from './strokeCurve';
import type {Point} from './geometry';

/** Complete fidelity ladder, real samples only (never predictions): radial/RDP
 * first bounds the stored polyline to .5 world units from original samples.
 * Rendering caps local tangent displacement toward the chord deterministically
 * from retained points. Before discarding originals, the final verifier bounds
 * the rendered curve against their polyline, retaining more points locally until
 * the combined bound is <=.5. No schema or replica-local render flags are used.
 */
const WINDOW = 128;
const ERROR = 0.5;
const RADIAL = 0.25;
/** Conservative adaptive hull certificate; no finite curve-probe acceptance.
 * Each accepted hull is within ERROR of one original segment. Subdivision
 * resolves cases where maxima occur at different positions along the interval.
 */
function curveFits(curve:Curve,original:Point[],depth=0):boolean {
  if(original.slice(1).some((d,i)=>[curve.a,curve.b,curve.c,curve.d].every(p=>chordDistance(p,original[i],d)<=ERROR)))return true;
  if(depth===16)return false;
  const [left,right]=splitCurve(curve,.5);
  return curveFits(left,original,depth+1)&&curveFits(right,original,depth+1);
}
/** The reverse certificate uses flattened curve chords with an explicit hull
 * error allowance, then bounds each original segment by subdivision. */
function originalsFit(curve:Curve,original:Point[]):boolean {
  const tolerance=1e-5,segments:[Point,Point][]=[];
  const flatten=(c:Curve,depth=0):boolean=>{
    if(Math.max(chordDistance(c.b,c.a,c.d),chordDistance(c.c,c.a,c.d))<=tolerance){segments.push([c.a,c.d]);return true;}
    if(depth===16)return false;
    const [left,right]=splitCurve(c,.5);return flatten(left,depth+1)&&flatten(right,depth+1);
  };
  if(!flatten(curve))return false;
  const fits=(a:Point,d:Point,depth=0):boolean=>{
    if(segments.some(([start,end])=>Math.max(chordDistance(a,start,end),chordDistance(d,start,end))<=ERROR-tolerance))return true;
    if(depth===16)return false;
    const mid={x:(a.x+d.x)/2,y:(a.y+d.y)/2};return fits(a,mid,depth+1)&&fits(mid,d,depth+1);
  };
  return original.slice(1).every((d,i)=>fits(original[i],d));
}
export interface DecimationResult {points: number[]; original: number; retained: number; overrun: boolean}
export const decimationDiagnostics = {strokes:0, overruns:0, maxRetained:0};

/** Online radial prefilter, with original samples retained for final verification.
 * Published arrays are never passed here: BUILD-5 remains pointerup-only. */
export class StrokeSimplifier {
  private samples: number[] = [];
  private candidates: number[] = [];
  constructor(readonly arity: 2|3) {}
  append(point: readonly number[]) {
    const index = this.samples.length / this.arity;
    this.samples.push(...point);
    const last = this.candidates[this.candidates.length-1];
    if (last === undefined || Math.hypot(point[0]-this.samples[last*this.arity],point[1]-this.samples[last*this.arity+1]) >= RADIAL || index % WINDOW === 0) this.candidates.push(index);
  }
  finish(): DecimationResult {
    const p = this.samples, a = this.arity, count = p.length/a;
    if (!count) return {points:[],original:0,retained:0,overrun:false};
    const retained = new Set<number>([0,count-1]);
    // Preserve deliberate corners (turn >45 degrees; lattice stairs are not corners) and extrema, including
    // plateau boundaries. No q is averaged or regenerated at a retained point.
    for (let i=1;i<count-1;i++) {
      const dx=p[i*a]-p[(i-1)*a],dy=p[i*a+1]-p[(i-1)*a+1],ex=p[(i+1)*a]-p[i*a],ey=p[(i+1)*a+1]-p[i*a+1];
      if (Math.hypot(dx,dy)*Math.hypot(ex,ey)>0 && dx*ex+dy*ey < (Math.SQRT1_2-1e-12)*Math.hypot(dx,dy)*Math.hypot(ex,ey)) retained.add(i);
      if (a===3) {const left=p[i*a+2]-p[(i-1)*a+2],right=p[(i+1)*a+2]-p[i*a+2]; if (left*right<=0 && (left!==0||right!==0)) retained.add(i);}
    }
    const score = (i:number,lo:number,hi:number) => {
      const dx=p[hi*a]-p[lo*a],dy=p[hi*a+1]-p[lo*a+1],length=dx*dx+dy*dy;
      const t=length ? Math.max(0,Math.min(1,((p[i*a]-p[lo*a])*dx+(p[i*a+1]-p[lo*a+1])*dy)/length)) : (i-lo)/(hi-lo);
      const geometry=Math.hypot(p[i*a]-p[lo*a]-t*dx,p[i*a+1]-p[lo*a+1]-t*dy)/ERROR;
      const pressure=a===3 ? Math.abs(p[i*a+2]-(p[lo*a+2]+t*(p[hi*a+2]-p[lo*a+2]))) : 0;
      return Math.max(geometry,pressure);
    };
    const rdp = (indices: number[]) => {
      const stack: [number,number][] = [[0,indices.length-1]];
      while (stack.length) {
        const [lo,hi]=stack.pop()!; let split=-1,worst=1;
        for(let at=lo+1;at<hi;at++){const error=score(indices[at],indices[lo],indices[hi]);if(error>worst){worst=error;split=at;}}
        if(split!==-1){retained.add(indices[split]);stack.push([lo,split],[split,hi]);}
      }
    };
    for(let start=0;start<count-1;) {
      let end=Math.min(count-1,start+WINDOW);
      // Integer mouse samples can put a fixed endpoint on a staircase offset.
      // Search only this bounded window, preferring chords aligned with the most repeated lattice samples (furthest
      // wins ties), provided every sample already meets fidelity. Fractional input keeps its exact partition.
      const lattice=Array.from({length:end-start+1},(_,i)=>start+i).every(i=>Number.isInteger(p[i*a])&&Number.isInteger(p[i*a+1]));
      if(lattice){
        let best=0;const minimum=start+Math.min(64,Math.ceil((end-start)/2));
        for(let candidate=end;candidate>=minimum;candidate--){
          let fits=true,aligned=0;
          const dx=p[candidate*a]-p[start*a],dy=p[candidate*a+1]-p[start*a+1];
          for(let i=start+1;i<candidate;i++){
            if(score(i,start,candidate)>1){fits=false;break;}
            if((p[i*a]-p[start*a])*dy===(p[i*a+1]-p[start*a+1])*dx)aligned++;
          }
          if(fits&&aligned>best){best=aligned;end=candidate;}
        }
      }
      retained.add(start);retained.add(end);
      rdp([start,...this.candidates.filter(i=>i>start&&i<end),end]);
      // Final verification against ALL original unsent samples, with retained
      // anchors locked. This catches error introduced by the radial prefilter.
      const anchors=[...retained].filter(i=>i>=start&&i<=end).sort((x,y)=>x-y);
      for(let j=1;j<anchors.length;j++)rdp(Array.from({length:anchors[j]-anchors[j-1]+1},(_,k)=>anchors[j-1]+k));
      start=end;
    }
    let indices=[...retained].sort((x,y)=>x-y);
    // A cubic lies in its control hull; only its two inner controls depart
    // from the chord, with combined Bernstein weight <=3/4. Original segments
    // lie in the hull of their samples. The triangle bound below therefore
    // certifies the entire rendered curve, not a finite set of curve probes.
    // A continuous original interval joins both chord endpoints, so projection
    // covers the chord: this bound holds in both geometric directions.
    for (;;) {
      const curves=strokeCurves(indices.map(i=>({x:p[i*a],y:p[i*a+1]})));
      const additions:number[]=[];
      curves.forEach((curve,j)=>{
        const lo=indices[j],hi=indices[j+1];
        let deviation=0,split=-1,pressureSplit=-1;
        for(let i=lo+1;i<hi;i++){
          const error=chordDistance({x:p[i*a],y:p[i*a+1]},curve.a,curve.d);
          if(error>deviation){deviation=error;split=i;}
          if(score(i,lo,hi)>1)pressureSplit=i;
        }
        const bend=.75*Math.max(chordDistance(curve.b,curve.a,curve.d),chordDistance(curve.c,curve.a,curve.d));
        if(pressureSplit!==-1)additions.push(pressureSplit);
        if(deviation+bend>ERROR && hi>lo+1){
          const original=Array.from({length:hi-lo+1},(_,i)=>({x:p[(lo+i)*a],y:p[(lo+i)*a+1]}));
          if(!curveFits(curve,original)||!originalsFit(curve,original))additions.push(split===-1?Math.floor((lo+hi)/2):split);
        }
      });
      if(!additions.length)break;
      for(const i of additions)retained.add(i);
      indices=[...retained].sort((x,y)=>x-y);
    }
    return {points:indices.flatMap(i=>p.slice(i*a,i*a+a)),original:count,retained:indices.length,overrun:indices.length>1000};
  }
}
export function simplifyStroke(points: readonly number[], arity: 2|3): DecimationResult {
  const simplifier=new StrokeSimplifier(arity);
  for(let i=0;i<points.length;i+=arity)simplifier.append(points.slice(i,i+arity));
  return simplifier.finish();
}
