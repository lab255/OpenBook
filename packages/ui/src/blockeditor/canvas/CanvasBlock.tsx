import React, {useLayoutEffect, useRef, useState} from 'react';
import * as Y from 'yjs';
import {registerCustomBlock, type CustomBlockProps} from '../registry';
import {simplifyStroke} from './simplify';
import {canvasHistory} from './history';
import {appendPoints, defaults, newCanvas, newShape, pressureAt, readScene, type Shape} from './state';

type Tool = 'pen' | 'rect' | 'arrow' | 'select' | 'erase';
type Gesture = {tool: Tool; x: number; y: number; points: number[]; pressure: number[]; variable: boolean; pointer: number; selected: Shape[]; resize: boolean; dx: number; dy: number; keyboard?: boolean};
type Sample = {entry: number; event: number; Q: number; R1: number; F: number; EF: number; trusted: boolean; pointerType: string; visibility: string; focused: boolean};
declare global {interface Window {canvas5Samples?: Sample[]}}

export function CanvasBlock({block, editor, pageReadOnly}: CustomBlockProps) {
  const surface = useRef<HTMLCanvasElement>(null), gesture = useRef<Gesture | null>(null), penActive = useRef(false), pressureVerified = useRef(false), fencePending = useRef(false);
  const [tool, setTool] = useState<Tool>('pen'), [selected, select] = useState<string[]>([]), [status, setStatus] = useState('Draw here, or choose a shape');
  const props = block.get('props') as Y.Map<unknown>, source = props?.get('shapes');
  const scene = readScene(source), writable = !pageReadOnly && scene.editable && props.get('canvasVersion') === 1;
  const shapes = source instanceof Y.Map ? source as Y.Map<Y.Map<unknown>> : undefined;
  const history = () => canvasHistory(editor.doc);
  const current = () => readScene(props.get('shapes')).shapes;
  const selectedShapes = () => current().filter(s => selected.includes(s.id));
  const width = () => surface.current?.clientWidth ?? 640;
  const height = 360;
  function drawShape(ctx: CanvasRenderingContext2D, s: Shape, pressures?: number[]) {
    ctx.strokeStyle = s.stroke; ctx.fillStyle = s.stroke; ctx.lineWidth = s.strokeWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (s.kind === 'stroke') {
      const p = s.points; const metadata = shapes?.get(s.id); const q = metadata ? pressureAt(metadata) : new Map<number,number>();
      if (p.length === 2) {ctx.beginPath(); ctx.arc(s.x+p[0],s.y+p[1],s.strokeWidth/2,0,Math.PI*2);ctx.fill();}
      for (let i = 2; i < p.length; i += 2) {
        const pressure = pressures?.[i/2] ?? q.get(i/2); ctx.lineWidth = s.strokeWidth * (s.pressureMode === 'variable' && pressure !== undefined ? .5+pressure : 1);
        ctx.beginPath(); ctx.moveTo(s.x+p[i-2]*s.w/s.basisW,s.y+p[i-1]*s.h/s.basisH);ctx.lineTo(s.x+p[i]*s.w/s.basisW,s.y+p[i+1]*s.h/s.basisH);ctx.stroke();
      }
    } else if (s.kind === 'rect') ctx.strokeRect(s.x,s.y,s.w,s.h);
    else {
      const x = s.x+s.startX*s.w, y = s.y+s.startY*s.h, ex = s.x+s.endX*s.w, ey = s.y+s.endY*s.h, angle = Math.atan2(ey-y,ex-x);
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.moveTo(ex-12*Math.cos(angle-.5),ey-12*Math.sin(angle-.5));ctx.lineTo(ex,ey);ctx.lineTo(ex-12*Math.cos(angle+.5),ey-12*Math.sin(angle+.5));ctx.stroke();
    }
  }
  function preview(g: Gesture): Shape {
    return {...defaults, id:'preview', kind:g.tool === 'pen' ? 'stroke' : g.tool, points:g.points, x:g.tool === 'pen' ? g.x : Math.min(g.x,g.x+g.dx), y:g.tool === 'pen' ? g.y : Math.min(g.y,g.y+g.dy), w:g.tool === 'pen' ? 1 : Math.max(1,Math.abs(g.dx)), h:g.tool === 'pen' ? 1 : Math.max(1,Math.abs(g.dy)), pressureMode:g.variable ? 'variable' : 'constant', startX:g.dx < 0 ? 1 : 0, startY:g.dy < 0 ? 1 : 0, endX:g.dx < 0 ? 0 : 1, endY:g.dy < 0 ? 0 : 1};
  }
  function bounds(s: Shape) {
    if (s.kind !== 'stroke' || !s.points.length) return {x:s.x,y:s.y,w:s.w,h:s.h};
    const xs = s.points.filter((_,i)=>i%2===0).map(x=>s.x+x*s.w/s.basisW), ys = s.points.filter((_,i)=>i%2===1).map(y=>s.y+y*s.h/s.basisH);
    return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(1,Math.max(...xs)-Math.min(...xs)),h:Math.max(1,Math.max(...ys)-Math.min(...ys))};
  }
  function resized(s: Shape, dx: number, dy: number) {
    const b = bounds(s), rx = Math.max(1,b.w+dx)/Math.max(1,b.w), ry = Math.max(1,b.h+dy)/Math.max(1,b.h);
    return {x:b.x+(s.x-b.x)*rx,y:b.y+(s.y-b.y)*ry,w:s.w*rx,h:s.h*ry};
  }
  function paint() {
    const canvas = surface.current; if (!canvas) return;
    const ratio = window.devicePixelRatio || 1, w = canvas.clientWidth;
    if (canvas.width !== Math.round(w*ratio) || canvas.height !== height*ratio) {canvas.width = Math.round(w*ratio);canvas.height=height*ratio;}
    const ctx = canvas.getContext('2d')!;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,height);
    const g = gesture.current;
    for (const original of current()) {
      let s = original;
      if (g?.tool === 'select' && g.selected.some(item=>item.id===s.id)) {
        const start = g.selected.find(item=>item.id===s.id)!;
        s = {...start,...(g.resize ? resized(start,g.dx,g.dy) : {x:start.x+g.dx,y:start.y+g.dy})};
      }
      drawShape(ctx,s);
      if (selected.includes(s.id)) {const b=bounds(s);ctx.strokeStyle='#0f172a';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.strokeRect(b.x-4,b.y-4,b.w+8,b.h+8);ctx.setLineDash([]);ctx.fillStyle='#0f172a';ctx.fillRect(b.x+b.w-3,b.y+b.h-3,6,6);}
    }
    if (g && ['pen','rect','arrow'].includes(g.tool)) drawShape(ctx,preview(g),g.pressure);
  }
  useLayoutEffect(() => {paint(); const observer = new ResizeObserver(paint); if(surface.current)observer.observe(surface.current); return ()=>observer.disconnect();});
  function feedback() {const r=history()?.result;setStatus(r ? `${r.label}. ${r.reason}` : 'History unavailable');paint();}
  function cancel() {gesture.current=null;penActive.current=false;setStatus('Gesture cancelled');paint();}
  function erase(ids: string[]) {if(!writable)return;history()?.structural('erase',()=>{for(const id of ids)shapes?.delete(id);},!writable);select([]);setStatus('Erased selected objects');}
  function commit(g: Gesture) {
    if (!writable || !shapes) return;
    if (g.tool === 'erase') {erase(g.selected.map(s=>s.id));return;}
    if (g.tool === 'select') {
      history()?.commitCanvasCommand(g.resize?'resize':'move',g.selected.flatMap(s=>{const target=shapes.get(s.id);return target?[{target,resolve:()=>shapes.get(s.id),values:g.resize?resized(s,g.dx,g.dy):{x:s.x+g.dx,y:s.y+g.dy}}]:[];}),!writable);
      setStatus(g.resize?'Resized selection':'Moved selection');return;
    }
    const simplified = g.tool === 'pen' ? simplifyStroke(g.points,g.pressure,g.variable) : null;
    if(simplified){g.points=simplified.points;g.pressure=simplified.pressure;}
    const p = preview(g), id = crypto.randomUUID();
    history()?.structural(g.tool === 'pen'?'stroke':g.tool,()=>{
      const shape = newShape(p.kind,{...p,id,points:undefined,ord:`a${String(shapes.size).padStart(8,'0')}`}); shapes.set(id,shape);
      if(g.tool==='pen') appendPoints(shape,g.points,g.variable?g.pressure:undefined);
    },!writable);
    select([id]);if(g.tool!=='pen')setTool('select');setStatus(`Created ${p.kind}${simplified ? ` · ${g.points.length/2}/${simplified.original} points${g.points.length/2>100?' · fidelity budget overrun':''}` : ''}`);
  }
  function point(e: React.PointerEvent<HTMLCanvasElement>) {const r=e.currentTarget.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  function hit(x:number,y:number) {return current().reverse().find(s=>{const b=bounds(s);return x>=b.x-8&&x<=b.x+b.w+8&&y>=b.y-8&&y<=b.y+b.h+8;});}
  function sample(entry:number,e:React.PointerEvent<HTMLCanvasElement>) {
    if(fencePending.current)return;fencePending.current=true;
    const timestamp=e.timeStamp,trusted=e.isTrusted,pointerType=e.pointerType,visibility=document.visibilityState,focused=document.hasFocus();
    requestAnimationFrame(()=>{const R1=performance.now()-entry;requestAnimationFrame(()=>{const F=performance.now()-entry;(window.canvas5Samples??=[]).push({entry,event:timestamp,Q:entry-timestamp,R1,F,EF:F+entry-timestamp,trusted,pointerType,visibility,focused});fencePending.current=false;});});
  }
  function down(e:React.PointerEvent<HTMLCanvasElement>) {
    const entry=performance.now();
    if(!writable || (e.pointerType==='touch' && (penActive.current || tool!=='select')) || gesture.current)return;
    if(e.pointerType==='pen' && (!Number.isFinite(e.pressure) || e.pressure<=0))return;
    e.stopPropagation();e.currentTarget.focus(); if(e.pointerType==='pen')penActive.current=true;
    if(e.isTrusted)e.currentTarget.setPointerCapture(e.pointerId);
    const {x,y}=point(e), target=hit(x,y); let selection=selectedShapes();let resize=false;
    if(tool==='select'||tool==='erase') {
      if(target) {selection=e.shiftKey?[...selection.filter(s=>s.id!==target.id),target]:selected.includes(target.id)?selection:[target];select(selection.map(s=>s.id));const b=bounds(target);resize=tool==='select'&&Math.abs(x-b.x-b.w)<14&&Math.abs(y-b.y-b.h)<14;}
      else {selection=[];select([]);}
    }
    gesture.current={tool,x,y,points:[0,0],pressure:[e.pressure],variable:e.pointerType==='pen'&&pressureVerified.current&&e.pressure>0,pointer:e.pointerId,selected:selection,resize,dx:0,dy:0};paint();if(tool==='pen')sample(entry,e);
  }
  function move(e:React.PointerEvent<HTMLCanvasElement>) {
    const entry=performance.now(),g=gesture.current;if(!g||g.pointer!==e.pointerId||g.keyboard)return;
    if(!writable){cancel();return;}e.stopPropagation();const {x,y}=point(e);g.dx=x-g.x;g.dy=y-g.y;
    if(g.tool==='pen') {
      if(e.pointerType==='pen' && (!Number.isFinite(e.pressure) || e.pressure<=0 || e.buttons===0))return;
      if(e.pointerType==='pen' && Math.abs(e.pressure-g.pressure[0])>1/255)pressureVerified.current=true;
      g.points.push(g.dx,g.dy);g.pressure.push(Math.max(0,Math.min(1,e.pressure || .5)));
    }
    if(g.tool==='erase'){const s=hit(x,y);if(s&&!g.selected.some(item=>item.id===s.id))g.selected.push(s);select(g.selected.map(s=>s.id));}
    paint();if(g.tool==='pen')sample(entry,e);
  }
  function up(e:React.PointerEvent<HTMLCanvasElement>) {const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;e.stopPropagation();gesture.current=null;penActive.current=false;commit(g);paint();}
  function nudge(dx:number,dy:number) {if(!writable||!shapes)return;history()?.commitCanvasCommand('nudge',selectedShapes().map(s=>({target:shapes.get(s.id)!,resolve:()=>shapes.get(s.id),values:{x:s.x+dx,y:s.y+dy}})),!writable);setStatus(`Nudged ${dx}, ${dy}`);}
  function key(e:React.KeyboardEvent) {
    if((e.target as HTMLElement).tagName==='INPUT'||e.nativeEvent.isComposing)return;
    const k=e.key.toLowerCase(); let handled=true;
    if(k==='escape'){if(gesture.current)cancel();else if(selected.length)select([]);else {surface.current?.blur();setStatus('Canvas focus exited');}}
    else if(!writable)return;
    else if((e.metaKey||e.ctrlKey)&&k==='z'){if(gesture.current)cancel();else {if(e.shiftKey)editor.undo.redo();else editor.undo.undo();feedback();}}
    else if((e.metaKey||e.ctrlKey)&&k==='y'){editor.undo.redo();feedback();}
    else if((e.metaKey||e.ctrlKey)&&k==='a')select(current().map(s=>s.id));
    else if(['p','r','a','s','v','e'].includes(k)&&!e.metaKey&&!e.ctrlKey){if(gesture.current)cancel();setTool(({p:'pen',r:'rect',a:'arrow',s:'select',v:'select',e:'erase'} as Record<string,Tool>)[k]);}
    else if(k==='delete'||k==='backspace')erase(selected);
    else if(k.startsWith('arrow')) {const amount=e.shiftKey?10:1,dx=k==='arrowleft'?-amount:k==='arrowright'?amount:0,dy=k==='arrowup'?-amount:k==='arrowdown'?amount:0;const g=gesture.current;if(g?.keyboard){g.dx+=dx;g.dy+=dy;setStatus(`Crosshair ${g.x+g.dx}, ${g.y+g.dy}`);}else nudge(dx,dy);}
    else if(k===' '&&gesture.current?.keyboard){const g=gesture.current;g.points.push(g.dx,g.dy);g.pressure.push(.5);paint();}
    else if(k==='enter' && (e.target===surface.current)) {
      if(gesture.current?.keyboard){const g=gesture.current;gesture.current=null;commit(g);paint();}
      else if(['pen','rect','arrow'].includes(tool)){const g:Gesture={tool,x:width()/2-60,y:140,points:[0,0],pressure:[.5],variable:false,pointer:-1,selected:[],resize:false,dx:120,dy:tool==='arrow'?0:80,keyboard:true};if(tool==='pen'){g.dx=0;g.dy=0;gesture.current=g;setStatus('Keyboard path: arrows move, Space places, Enter finishes');}else commit(g);paint();}
      else if(tool==='erase')erase(selected);
    } else handled=false;
    if(handled){e.preventDefault();e.stopPropagation();}
  }
  const control:React.CSSProperties={height:36,minWidth:36,padding:'0 8px',borderRadius:6,cursor:'pointer',border:'1px solid hsl(var(--border))',background:'hsl(var(--background))',color:'hsl(var(--foreground))'};
  return <section data-canvas-block contentEditable={false} aria-label={`Canvas, ${scene.shapes.length} objects, ${writable?'editable':'view only'}`} onKeyDown={key} onPointerDown={e=>e.stopPropagation()} style={{border:'1px solid hsl(var(--border))',borderRadius:8,overflow:'hidden',color:'hsl(var(--foreground))',background:'hsl(var(--background))'}}>
    <div role="toolbar" aria-label="Canvas tools" style={{height:44,display:'flex',gap:4,alignItems:'center',padding:'0 4px'}}>
      {writable ? <>{(['pen','rect','arrow','select','erase'] as Tool[]).map((t,i)=><button key={t} aria-pressed={tool===t} style={{...control,background:tool===t?'hsl(var(--accent))':'hsl(var(--background))'}} onClick={()=>{if(gesture.current)cancel();setTool(t);surface.current?.focus();}}>{t} {['P','R','A','S','E'][i]}</button>)}
        <button style={control} disabled={!gesture.current && !history()?.past.length} onClick={()=>{if(gesture.current)cancel();else {editor.undo.undo();feedback();}}} title={`Undo ${history()?.past.slice(-1)[0]?.label??''}`}>Undo</button><button style={control} disabled={!history()?.future.length} title={`Redo ${history()?.future.slice(-1)[0]?.label??''}`} onClick={()=>{editor.undo.redo();feedback();}}>Redo</button></>:<span>View only</span>}
    </div>
    <canvas ref={surface} data-canvas-surface aria-label="Canvas drawing surface" tabIndex={0} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={e=>{if(gesture.current?.pointer===e.pointerId)cancel();}} style={{display:'block',width:'100%',height,touchAction:'none',cursor:tool==='select'?'default':'crosshair',background:'hsl(var(--background))',outlineOffset:-2}} />
    <div aria-live="polite" style={{height:28,fontSize:12,padding:'4px 8px',borderTop:'1px solid hsl(var(--border))',overflow:'hidden'}}>{scene.diagnostics.join('; ') || status} · {scene.shapes.length} objects</div>
    <div style={{height:32,display:'flex',gap:6,alignItems:'center',padding:'0 8px',fontSize:12}}>
      <label>Object <select aria-label="Canvas object" value={selected[0]??''} onChange={e=>{select(e.target.value?[e.target.value]:[]);surface.current?.focus();}}><option value="">None</option>{scene.shapes.map((s,i)=><option key={s.id} value={s.id}>{s.kind} {i+1}</option>)}</select></label>
      {selectedShapes().slice(0,1).map(s=><span key={s.id} data-canvas-geometry>x {s.x} · y {s.y} · w {s.w} · h {s.h}</span>)}
    </div>
  </section>;
}
export function registerCanvasBlock(): void {registerCustomBlock({type:'canvas',render:CanvasBlock,slash:{label:'Canvas',hint:'Draw and diagram together',keywords:'whiteboard drawing sketch',group:'interactive',make:newCanvas}});}
