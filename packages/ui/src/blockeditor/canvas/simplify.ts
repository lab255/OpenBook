/** Bounded 64-sample RDP windows. Geometry <= .5 units, pressure <= 1/255.
 * No hard truncation: fidelity wins over the 100-point target. */
export function simplifyStroke(points: number[], pressure: number[], variable: boolean): {points: number[]; pressure: number[]; original: number} {
  const n = points.length / 2;
  if (n < 3) return {points, pressure, original:n};
  // Radial prefilter at zero tolerance: remove exact duplicate samples only.
  // Non-zero radial filtering would spend part of the final .5-unit budget.
  const candidates = [0];
  for (let i=1;i<n;i++) {const last=candidates[candidates.length-1];if(i===n-1 || points[2*i]!==points[2*last] || points[2*i+1]!==points[2*last+1] || (variable && pressure[i]!==pressure[last]))candidates.push(i);}
  const keep = new Set<number>();
  for(let start=0;start<candidates.length-1;start+=63) {
    const end=Math.min(start+63,candidates.length-1), stack:[[number,number]]|[number,number][]=[[start,end]];
    keep.add(candidates[start]);keep.add(candidates[end]);
    while(stack.length) {
      const [a,b]=stack.pop()!,ai=candidates[a],bi=candidates[b],ax=points[ai*2],ay=points[ai*2+1],dx=points[bi*2]-ax,dy=points[bi*2+1]-ay,denom=dx*dx+dy*dy;
      let worst=1, split=-1;
      for(let j=a+1;j<b;j++) {const i=candidates[j],t=denom?Math.max(0,Math.min(1,((points[i*2]-ax)*dx+(points[i*2+1]-ay)*dy)/denom)):(i-ai)/(bi-ai),distance=Math.hypot(points[i*2]-ax-t*dx,points[i*2+1]-ay-t*dy),error=Math.max(distance/.5,variable?Math.abs(pressure[i]-(pressure[ai]+t*(pressure[bi]-pressure[ai])))*255:0);if(error>worst){worst=error;split=j;}}
      if(split>=0){keep.add(candidates[split]);stack.push([a,split],[split,b]);}
    }
  }
  const indices=[...keep].sort((a,b)=>a-b);return {points:indices.flatMap(i=>[points[i*2],points[i*2+1]]),pressure:indices.map(i=>pressure[i]),original:n};
}
