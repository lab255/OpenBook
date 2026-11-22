// Test-only subtraction controls. These deliberately remove required contracts;
// none is a shipping variant or a proposed silent scope reduction.
import config from './vite.viewer.config.js';
const mode=process.env.BUILD6_COST_MODE;
config.plugins.unshift({name:'build6-contract-cost',enforce:'pre',transform(code,id){
 if(mode==='precompute-envelope'&&id.endsWith('/src/viewer/CanvasViewer.tsx'))return code
  .replace("readViewerCanvas(props)", `JSON.parse(kept?.getAttribute('data-scene')??'{"shapes":[],"diagnostics":[]}')`)
  .replace("import {paintViewer as paint} from './canvasPaint';", `
 function paint(canvas,scene,camera,width,height){
  const ratio=window.devicePixelRatio||1;
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.translate(camera.x,camera.y);ctx.scale(camera.zoom,camera.zoom);
  const methods='save restore beginPath moveTo lineTo bezierCurveTo stroke fill rect clip arc ellipse fillText setLineDash'.split(' ');
  const properties='globalAlpha strokeStyle fillStyle lineWidth lineJoin lineCap font textBaseline textAlign'.split(' ');
  const payload=canvas.parentElement.querySelector('[data-canvas-fallback]')?.getAttribute('data-commands');
  for(const [op,...args]of JSON.parse(payload??'[]')){
   if(methods.includes(op))ctx[op](...args);
   else if(properties.includes(op)&&args.length===1)ctx[op]=args[0];
   else throw new Error('Invalid drawing command');
  }
 }
 `);
 if(['clipboard-route','static-only'].includes(mode)&&id.endsWith('/src/blockeditor/exportBlocks.ts'))return code.replace("import {canvasStaticHtml} from '../export/canvasStatic';\n",'');
 if(mode==='projection'&&id.endsWith('/src/viewer/CanvasViewer.tsx'))return code.replace("  registerPropsProjection('canvas', projectCanvas);",'');
 if(mode==='quarantine'&&id.endsWith('/src/viewer/canvasScene.ts'))return `
 import * as Y from 'yjs';
 import {get} from '@/blockeditor/canvas/schema';
 export {get,projectCanvas} from '@/blockeditor/canvas/schema';
 export function readViewerCanvas(props:unknown){
  const source=get(props,'shapes');
  const shapes=(source instanceof Y.Map?[...source]:Object.entries(source as object)).map(([id,value])=>{
   const scalars=value instanceof Y.Map?value.toJSON():value;
   return {id,scalars,points:scalars.points,pointArity:scalars.pressureMode==='variable'?3:2};
  });
  shapes.sort((a,b)=>a.scalars.ord<b.scalars.ord?-1:a.scalars.ord>b.scalars.ord?1:a.id<b.id?-1:a.id>b.id?1:0);
  return {shapes,diagnostics:[]};
 }`;
 if(mode==='fidelity'&&id.endsWith('/src/viewer/canvasPaint.ts')){
  const start=code.indexOf('    for(const [i,curve]');
  const end=code.indexOf("  } else if(v.kind==='text')",start);
  return code.slice(0,start)+`    for(let i=1;i<ps.length;i++){
   ctx.lineWidth=(width(i-1)+width(i))/2;ctx.beginPath();ctx.moveTo(ps[i-1].x,ps[i-1].y);ctx.lineTo(ps[i].x,ps[i].y);ctx.stroke();
  }\n`+code.slice(end);
 }
 if(mode==='handoff'&&id.endsWith('/src/viewer/CanvasViewer.tsx'))return code.replace(/  const staticRoot = .*?;\n/, '').replace(/  const kept = [\s\S]*?(?=\n  const scene =)/, '  const kept = null;');
 if(mode==='interaction'&&id.endsWith('/src/viewer/CanvasViewer.tsx')){
  const start=code.indexOf('    element.onpointerdown =');
  const end=code.indexOf('    draw();',start);
  return code.slice(0,start)+code.slice(end).replace(/      element.onpointerdown=.*?=null;\n/,'');
 }
 if(mode==='static-only'&&id.endsWith('/src/viewer/index.tsx'))return code.replace("import {registerCanvasViewer} from './CanvasViewer';\n",'').replace('registerCanvasViewer();\n','');
}});
export default config;
