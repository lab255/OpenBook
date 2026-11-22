import {readViewerCanvas,get} from '../viewer/canvasScene';
import {paintViewer} from '../viewer/canvasPaint';
import {KEEP_STATIC_ATTR} from './staticMarker';

const escape=(value:unknown):string=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[char]!));
/** Export-time rasterization, using the browser export action's Canvas2D/font
 * environment. This module is export-only: no raster encoder enters the viewer.
 * The fixed 672px world viewport is clipped (not scaled) on narrower pages in
 * both static and live paths. PNG captures generic canvas fonts, not app Inter. */
export function canvasRaster(props:unknown) {
  const scene=readViewerCanvas(props),height=Math.min(960,Math.max(240,Number(get(props,'height'))||360));
  const canvas=document.createElement('canvas');
  if(!canvas.getContext('2d'))throw new Error('Canvas export requires a Canvas2D export environment');
  paintViewer(canvas,scene.shapes,{x:0,y:0,zoom:1},672,height);
  const swatch=document.createElement('div');swatch.style.backgroundColor=String(get(props,'background')??'#ffffff');
  const alt=scene.shapes.map(shape=>String(shape.scalars.name||shape.scalars.kind)+(shape.scalars.kind==='text'?`: ${shape.scalars.text}`:'')).join('; ')||'Empty drawing';
  return {scene,height,background:swatch.style.backgroundColor,alt,src:canvas.toDataURL('image/png')};
}
export function canvasStaticHtml(id:string,props:unknown):string {
  const {scene,height,background,alt,src}=canvasRaster(props);
  return `<figure data-canvas-export=""${id?` data-block-id="${escape(id)}" ${KEEP_STATIC_ATTR}="canvas"`:''} style="margin:0">`+
    `<div data-canvas-fallback="" style="height:${height}px;max-width:672px;overflow:hidden;background:${escape(background)}">`+
    `<img alt="${escape(alt)}" src="${src}" width="672" height="${height}" style="display:block;width:672px;max-width:none;height:${height}px"></div>`+
    (scene.diagnostics.length?`<figcaption role="status">${escape(scene.diagnostics.join('; '))}</figcaption>`:'')+
    `<details><summary>Inspect drawing (${scene.shapes.length} objects)</summary><ol>`+
    scene.shapes.map(shape=>`<li>${escape(shape.scalars.name||shape.scalars.kind)}${shape.scalars.kind==='text'?`: ${escape(shape.scalars.text)}`:''}</li>`).join('')+
    '</ol></details></figure>';
}

export const CANVAS_EXPORT_CSS = `
/* Canvas hydration reserves the static document's exact column/title geometry.
   Export-only CSS: neither the app nor the viewer bundle pays for this mirror. */
/* Static paragraph margins collapse; viewer paragraphs instead reserve 4px
   block padding. Match the boxes before hydration, including adjacent prose. */
html[data-ob-canvas-export] main > p { margin:0; padding-block:4px; }
html[data-ob-canvas-export] .ob-viewer { font: inherit; }
html[data-ob-canvas-export] [data-canvas-export] canvas { -webkit-font-smoothing:auto; }
html[data-ob-canvas-export] .obe-row:has(> .obe-blockbody > .obe-custom > [data-canvas-export]) { padding-block:0; }
html[data-ob-canvas-export] .ob-viewer-page { max-width:720px; padding:48px 24px 120px; }
html[data-ob-canvas-export] .ob-viewer-title { display:block; font-size:40px; line-height:1.2; font-weight:700; letter-spacing:-.02em; margin:0 0 1.2rem; }

`;
