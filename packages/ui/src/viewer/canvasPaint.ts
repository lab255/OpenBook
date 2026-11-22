/** Read-only painter mirror: same Canvas2D command order and shared committed
 * curve ladder as the app. Validated scalars can be read directly; stroke/arrow
 * selection bounds are not needed to paint. Drift tests bind pixel parity. */
import type {SceneShape} from '@/blockeditor/canvas/schema';
import type {Camera,Point} from '@/blockeditor/canvas/geometry';
import {wrapText} from '@/blockeditor/canvas/geometry';
import {strokeCurves,splitCurve} from '@/blockeditor/canvas/strokeCurve';
type PaintScalars = Record<'x'|'y'|'w'|'h'|'basisW'|'basisH'|'strokeWidth'|'opacity'|'fontSize'|'startX'|'startY'|'endX'|'endY',number> & Record<'kind'|'stroke'|'fill'|'dash'|'fontFamily'|'textAlign'|'text'|'startHead'|'endHead',string>;
function viewerPoints(s:SceneShape):Point[] {
  const v=s.scalars as PaintScalars,result:Point[]=[];
  for(let i=0;i<s.points.length;i+=s.pointArity)result.push({x:v.x+s.points[i]*v.w/v.basisW,y:v.y+s.points[i+1]*v.h/v.basisH});
  return result;
}
function viewerEndpoints(s:SceneShape):[Point,Point] {
  const v=s.scalars as PaintScalars;
  return [{x:v.x+v.startX*v.w,y:v.y+v.startY*v.h},{x:v.x+v.endX*v.w,y:v.y+v.endY*v.h}];
}
export function paintViewerShape(ctx:CanvasRenderingContext2D,s:SceneShape):void {
  const v=s.scalars as PaintScalars,b=v;ctx.save();ctx.globalAlpha=v.opacity;ctx.strokeStyle=String(v.stroke);ctx.fillStyle=String(v.fill);ctx.lineWidth=v.strokeWidth;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(v.dash==='dashed'?[8,5]:[]);
  if(v.kind==='stroke') {
    const ps=viewerPoints(s);ctx.fillStyle=String(v.stroke);
    const width=(i:number)=>v.strokeWidth*(s.pointArity===3?0.5+s.points[i*3+2]/255:1);
    if(ps.length===1){ctx.beginPath();ctx.arc(ps[0].x,ps[0].y,width(0)/2,0,Math.PI*2);ctx.fill();}
    for(const [i,curve] of strokeCurves(ps).entries()){
      // Pressure interpolates between retained q values, including extrema.
      const steps=s.pointArity===3?Math.max(1,Math.ceil(Math.abs(s.points[(i+1)*3+2]-s.points[i*3+2])/8)):1;
      let rest=curve;
      for(let step=0;step<steps;step++){
        const [part,next]=splitCurve(rest,1/(steps-step));rest=next;
        const t=(step+.5)/steps;ctx.lineWidth=width(i)*(1-t)+width(i+1)*t;
        ctx.beginPath();ctx.moveTo(part.a.x,part.a.y);ctx.bezierCurveTo(part.b.x,part.b.y,part.c.x,part.c.y,part.d.x,part.d.y);ctx.stroke();
      }
    }
  } else if(v.kind==='text') {
    ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();
    ctx.font=`${v.fontSize}px ${v.fontFamily==='mono'?'monospace':v.fontFamily==='serif'?'serif':'sans-serif'}`;ctx.textBaseline='top';ctx.textAlign=v.textAlign as CanvasTextAlign;ctx.fillStyle=String(v.stroke);
    wrapText(ctx,String(v.text),b.w).forEach((line,i)=>ctx.fillText(line,b.x+(v.textAlign==='center'?b.w/2:v.textAlign==='right'?b.w:0),b.y+i*v.fontSize*1.4));
  } else if(v.kind==='arrow') {
    const [a,z]=viewerEndpoints(s);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(z.x,z.y);ctx.stroke();
    const head=(p:Point,q:Point)=>{const angle=Math.atan2(p.y-q.y,p.x-q.x),len=v.strokeWidth*3+6;ctx.beginPath();ctx.moveTo(p.x-Math.cos(angle-0.5)*len,p.y-Math.sin(angle-0.5)*len);ctx.lineTo(p.x,p.y);ctx.lineTo(p.x-Math.cos(angle+0.5)*len,p.y-Math.sin(angle+0.5)*len);ctx.stroke();};
    if(v.startHead==='arrow')head(a,z);if(v.endHead==='arrow')head(z,a);
  } else {
    ctx.beginPath();if(v.kind==='ellipse')ctx.ellipse(b.x+b.w/2,b.y+b.h/2,b.w/2,b.h/2,0,0,2*Math.PI);else ctx.rect(b.x,b.y,b.w,b.h);
    if(v.fill!=='none')ctx.fill();ctx.stroke();
  }ctx.restore();
}
export function paintViewer(canvas:HTMLCanvasElement,shapes:readonly SceneShape[],camera:Camera,width:number,height:number):void {
  const ratio=window.devicePixelRatio||1;
  if(canvas.width!==Math.round(width*ratio))canvas.width=Math.round(width*ratio);
  if(canvas.height!==Math.round(height*ratio))canvas.height=Math.round(height*ratio);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);ctx.translate(camera.x,camera.y);ctx.scale(camera.zoom,camera.zoom);
  for(const shape of shapes)paintViewerShape(ctx,shape);
}
