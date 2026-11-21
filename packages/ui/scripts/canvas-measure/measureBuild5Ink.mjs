// Pixel arrays only, never screenshot/video capture. Human no-visible-jump review
// remains manager-owned: raster differences alone cannot certify perception.
import {createRequire} from 'node:module';
import {writeFileSync,readFileSync} from 'node:fs';
const require=createRequire(new URL('../../../web/package.json',import.meta.url)),{chromium}=require('@playwright/test');
const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});await page.goto('http://127.0.0.1:5184/scripts/canvas-measure/index.html');await page.getByRole('region').waitFor();
 const rows=await page.evaluate(async()=>{
  const {simplifyStroke}=await import('/src/blockeditor/canvas/decimation.ts'),{paint}=await import('/src/blockeditor/canvas/geometry.ts'),{shapeDefaults}=await import('/src/blockeditor/canvas/schema.ts');
  const rows=[];
  const raster=(shape,zoom)=>{const canvas=document.createElement('canvas');paint(canvas,[shape],{x:0,y:0,zoom},736,360);return canvas.getContext('2d').getImageData(0,0,736,360).data;};
  const bounds=data=>{let minX=736,minY=360,maxX=-1,maxY=-1;for(let i=3;i<data.length;i+=4)if(data[i]){const at=(i-3)/4,x=at%736,y=Math.floor(at/736);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}return {minX,minY,maxX,maxY};};
  for(const name of ['smooth','handwriting-like','loop'])for(const arity of [2,3])for(const zoom of [1,4]){
   const original=Array.from({length:240},(_,i)=>{const t=i/239;return [name==='loop'?60*t+20*Math.sin(t*4*Math.PI):100*t,name==='smooth'?30*Math.sin(t*Math.PI):name==='loop'?20*Math.cos(t*4*Math.PI):12*Math.sin(t*6*Math.PI)+4*Math.sin(t*2*Math.PI),...(arity===3?[Math.round(128+80*Math.sin(t*2*Math.PI))]:[])];}).flat();
   const simplified=simplifyStroke(original,arity),shape={id:'sample',scalars:{...shapeDefaults,kind:'stroke',x:20,y:40,w:1,h:1,basisW:1,basisH:1,pressureMode:arity===3?'variable':'constant',strokeWidth:3},points:original,pointArity:arity},committed={...shape,points:simplified.points};
   const a=raster(shape,zoom),b=raster(committed,zoom),control=raster({...committed,scalars:{...committed.scalars,x:25}},zoom);let changedPixels=0,maxChannelDelta=0,inkPixels=0;
   for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<4;c++){const delta=Math.abs(a[i+c]-b[i+c]);if(delta)changed=true;maxChannelDelta=Math.max(maxChannelDelta,delta);}if(changed)changedPixels++;if(a[i+3]||b[i+3])inkPixels++;}
   const before=bounds(a),after=bounds(b),negative=bounds(control);rows.push({name,arity,zoom,original:240,retained:simplified.retained,changedPixels,inkPixels,maxChannelDelta,before,after,shiftControlPixels:negative.minX-after.minX});
  }
  return rows;
 });
 if(rows.some(r=>r.shiftControlPixels!==5*r.zoom))throw new Error('Raster displacement control failed');
 const css=readFileSync(new URL('../../src/blockeditor/canvas/canvas.css',import.meta.url),'utf8'),hex=source=>(source.match(/#[\da-f]{3,8}\b/gi)||[]).length,durations=source=>(source.match(/\b\d+(?:\.\d+)?m?s\b/g)||[]).length;
 const result={scope:'Chromium canvas2d DPR1, same scene/viewport/painter before and after simplification, 3 synthetic geometry proxies × 2 pressure modes × 100/400% zoom. Pixel differences are reported, not relabeled imperceptible. No screenshot or image saved. Manager visual judgment remains pending.',rows,chromeStyles:{scope:'Only canvas.css; document ink/paper/swatches and identity colors excluded. No new animation is used.',hexCount:hex(css),hexControl:hex(css+' color:#123456;'),literalDurationCount:durations(css),durationControl:durations(css+' transition-duration:137ms;')}};
 writeFileSync(new URL('../../../../_evidence-build5/ink-raster.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
