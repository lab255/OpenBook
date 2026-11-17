import type {SceneShape} from './schema';
export interface Point {x:number; y:number}
export interface Bounds extends Point {w:number; h:number}
export interface Camera extends Point {zoom:number}
export const number = (shape:SceneShape,key:string) => Number(shape.scalars[key]);
export function points(shape:SceneShape): Point[] {
  const result:Point[]=[];
  for(let i=0;i<shape.points.length;i+=shape.pointArity) result.push({x:number(shape,'x')+shape.points[i]*number(shape,'w')/number(shape,'basisW'), y:number(shape,'y')+shape.points[i+1]*number(shape,'h')/number(shape,'basisH')});
  return result;
}
export function endpoints(shape:SceneShape): [Point,Point] {
  return ['start','end'].map(prefix=>({x:number(shape,'x')+number(shape,`${prefix}X`)*number(shape,'w'),y:number(shape,'y')+number(shape,`${prefix}Y`)*number(shape,'h')})) as [Point,Point];
}
export function bounds(shape:SceneShape): Bounds {
  if(shape.scalars.kind==='stroke') return pointBounds(points(shape));
  if(shape.scalars.kind==='arrow') return pointBounds(endpoints(shape));
  return {x:number(shape,'x'),y:number(shape,'y'),w:number(shape,'w'),h:number(shape,'h')};
}
export function pointBounds(p:readonly Point[]): Bounds {
  if(!p.length)return {x:0,y:0,w:0,h:0};
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(const point of p){x=Math.min(x,point.x);y=Math.min(y,point.y);right=Math.max(right,point.x);bottom=Math.max(bottom,point.y);}
  return {x,y,w:right-x,h:bottom-y};
}
export function union(shapes:readonly SceneShape[]): Bounds {
  return pointBounds(shapes.flatMap(s=>{const b=bounds(s);return [{x:b.x,y:b.y},{x:b.x+b.w,y:b.y+b.h}];}));
}
export const world = (p:Point,c:Camera):Point => ({x:(p.x-c.x)/c.zoom,y:(p.y-c.y)/c.zoom});
export const screen = (p:Point,c:Camera):Point => ({x:p.x*c.zoom+c.x,y:p.y*c.zoom+c.y});
export function contains(b:Bounds,p:Point,padding=0):boolean {return p.x>=b.x-padding&&p.x<=b.x+b.w+padding&&p.y>=b.y-padding&&p.y<=b.y+b.h+padding;}
function distance(p:Point,a:Point,b:Point):number {
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function hit(shape:SceneShape,p:Point,zoom:number):boolean {
  const b=bounds(shape),padding=Math.max(3/zoom,number(shape,'strokeWidth')/2);
  if(!contains(b,p,padding))return false;
  if(shape.scalars.kind==='stroke'||shape.scalars.kind==='arrow') {
    const ps=shape.scalars.kind==='stroke'?points(shape):endpoints(shape);
    return ps.length===1 ? Math.hypot(p.x-ps[0].x,p.y-ps[0].y)<=padding : ps.some((q,i)=>i>0&&distance(p,ps[i-1],q)<=padding);
  }
  if(shape.scalars.kind==='ellipse')return ((p.x-b.x-b.w/2)/(b.w/2+padding||1))**2+((p.y-b.y-b.h/2)/(b.h/2+padding||1))**2<=1;
  return true;
}
export function resized(shape:SceneShape,from:Bounds,to:Bounds):Record<string,number> {
  const sx=from.w===0?1:to.w/from.w,sy=from.h===0?1:to.h/from.h;
  return {x:to.x+(number(shape,'x')-from.x)*sx,y:to.y+(number(shape,'y')-from.y)*sy,w:number(shape,'w')*sx,h:number(shape,'h')*sy};
}
export function arrowValues(a:Point,b:Point):Record<string,number> {
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.max(1,Math.abs(b.x-a.x)),h=Math.max(1,Math.abs(b.y-a.y));
  return {x,y,w,h,startX:(a.x-x)/w,startY:(a.y-y)/h,endX:(b.x-x)/w,endY:(b.y-y)/h};
}
export function wrapText(ctx:CanvasRenderingContext2D,text:string,width:number):string[] {
  const lines:string[]=[];
  for(const paragraph of text.split('\n')) {
    let line='';
    for(const char of paragraph) {if(line&&ctx.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}
    lines.push(line);
  }
  return lines;
}
export function paintShape(ctx:CanvasRenderingContext2D,s:SceneShape):void {
  const v=s.scalars,b=bounds(s);ctx.save();ctx.globalAlpha=number(s,'opacity');ctx.strokeStyle=String(v.stroke);ctx.fillStyle=String(v.fill);ctx.lineWidth=number(s,'strokeWidth');ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(v.dash==='dashed'?[8,5]:[]);
  if(v.kind==='stroke') {
    const ps=points(s);ctx.fillStyle=String(v.stroke);
    const width=(i:number)=>number(s,'strokeWidth')*(s.pointArity===3?0.5+s.points[i*3+2]/255:1);
    if(ps.length===1){ctx.beginPath();ctx.arc(ps[0].x,ps[0].y,width(0)/2,0,Math.PI*2);ctx.fill();}
    for(let i=1;i<ps.length;i++){ctx.lineWidth=(width(i-1)+width(i))/2;ctx.beginPath();ctx.moveTo(ps[i-1].x,ps[i-1].y);ctx.lineTo(ps[i].x,ps[i].y);ctx.stroke();}
  } else if(v.kind==='text') {
    ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();
    ctx.font=`${v.fontSize}px ${v.fontFamily==='mono'?'monospace':v.fontFamily==='serif'?'serif':'sans-serif'}`;ctx.textBaseline='top';ctx.textAlign=v.textAlign as CanvasTextAlign;ctx.fillStyle=String(v.stroke);
    wrapText(ctx,String(v.text),b.w).forEach((line,i)=>ctx.fillText(line,b.x+(v.textAlign==='center'?b.w/2:v.textAlign==='right'?b.w:0),b.y+i*number(s,'fontSize')*1.4));
  } else if(v.kind==='arrow') {
    const [a,z]=endpoints(s);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(z.x,z.y);ctx.stroke();
    const head=(p:Point,q:Point)=>{const angle=Math.atan2(p.y-q.y,p.x-q.x),len=number(s,'strokeWidth')*3+6;ctx.beginPath();ctx.moveTo(p.x-Math.cos(angle-0.5)*len,p.y-Math.sin(angle-0.5)*len);ctx.lineTo(p.x,p.y);ctx.lineTo(p.x-Math.cos(angle+0.5)*len,p.y-Math.sin(angle+0.5)*len);ctx.stroke();};
    if(v.startHead==='arrow')head(a,z);if(v.endHead==='arrow')head(z,a);
  } else {
    ctx.beginPath();if(v.kind==='ellipse')ctx.ellipse(b.x+b.w/2,b.y+b.h/2,b.w/2,b.h/2,0,0,2*Math.PI);else ctx.rect(b.x,b.y,b.w,b.h);
    if(v.fill!=='none')ctx.fill();ctx.stroke();
  }ctx.restore();
}
export function paint(canvas:HTMLCanvasElement,shapes:readonly SceneShape[],camera:Camera,width:number,height:number):void {
  const ratio=window.devicePixelRatio||1;
  if(canvas.width!==Math.round(width*ratio))canvas.width=Math.round(width*ratio);
  if(canvas.height!==Math.round(height*ratio))canvas.height=Math.round(height*ratio);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);ctx.translate(camera.x,camera.y);ctx.scale(camera.zoom,camera.zoom);
  for(const shape of shapes)paintShape(ctx,shape);
}
