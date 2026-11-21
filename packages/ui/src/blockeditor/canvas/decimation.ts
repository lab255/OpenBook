/** Real samples only. This module never accepts or produces predicted points. */
const WINDOW = 128;
const ERROR = 0.5;
const RADIAL = 0.25;
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
    // Preserve deliberate corners (turn >=45 degrees) and extrema, including
    // plateau boundaries. No q is averaged or regenerated at a retained point.
    for (let i=1;i<count-1;i++) {
      const dx=p[i*a]-p[(i-1)*a],dy=p[i*a+1]-p[(i-1)*a+1],ex=p[(i+1)*a]-p[i*a],ey=p[(i+1)*a+1]-p[i*a+1];
      if (Math.hypot(dx,dy)*Math.hypot(ex,ey)>0 && dx*ex+dy*ey <= Math.SQRT1_2*Math.hypot(dx,dy)*Math.hypot(ex,ey)) retained.add(i);
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
    for(let start=0;start<count-1;start+=WINDOW) {
      const end=Math.min(count-1,start+WINDOW);retained.add(start);retained.add(end);
      rdp([start,...this.candidates.filter(i=>i>start&&i<end),end]);
      // Final verification against ALL original unsent samples, with retained
      // anchors locked. This catches error introduced by the radial prefilter.
      const anchors=[...retained].filter(i=>i>=start&&i<=end).sort((x,y)=>x-y);
      for(let j=1;j<anchors.length;j++)rdp(Array.from({length:anchors[j]-anchors[j-1]+1},(_,k)=>anchors[j-1]+k));
    }
    const indices=[...retained].sort((x,y)=>x-y);
    return {points:indices.flatMap(i=>p.slice(i*a,i*a+a)),original:count,retained:indices.length,overrun:indices.length>1000};
  }
}
export function simplifyStroke(points: readonly number[], arity: 2|3): DecimationResult {
  const simplifier=new StrokeSimplifier(arity);
  for(let i=0;i<points.length;i+=arity)simplifier.append(points.slice(i,i+arity));
  return simplifier.finish();
}
