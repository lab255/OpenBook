import {readViewerCanvas,get} from '../viewer/canvasScene';
import {paintViewerShape} from '../viewer/canvasPaint';
import {fitCanvas} from '../viewer/canvasCamera';
import {KEEP_STATIC_ATTR} from './staticMarker';

const escape=(value:unknown):string=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[char]!));
/** Export-time rasterization, using the browser export action's Canvas2D/font
 * environment. This module is export-only: no raster encoder enters the viewer.
 * The standard export column has a 624px inner viewport after figure padding.
 * Both paths fit the same committed scene to that viewport. PNG captures generic canvas fonts, not app Inter. */
export function canvasRaster(props:unknown,width=624,density=window.devicePixelRatio||1) {
  const scene=readViewerCanvas(props),height=Math.min(960,Math.max(240,Number(get(props,'height'))||360));
  const canvas=document.createElement('canvas');
  if(!canvas.getContext('2d'))throw new Error('Canvas export requires a Canvas2D export environment');
  canvas.width=Math.round(width*density);canvas.height=Math.round(height*density);
  const ctx=canvas.getContext('2d')!,camera=fitCanvas(scene.shapes,width,height);
  ctx.setTransform(density,0,0,density,0,0);ctx.translate(camera.x,camera.y);ctx.scale(camera.zoom,camera.zoom);
  for(const shape of scene.shapes)paintViewerShape(ctx,shape);
  const swatch=document.createElement('div');swatch.style.backgroundColor=String(get(props,'background')??'#ffffff');
  const alt=scene.shapes.map(shape=>String(shape.scalars.name||shape.scalars.kind)+(shape.scalars.kind==='text'?`: ${shape.scalars.text}`:'')).join('; ')||'Empty drawing';
  return {scene,camera,width,height,background:swatch.style.backgroundColor,alt,src:canvas.toDataURL('image/png')};
}
export function canvasStaticHtml(id:string,props:unknown):string {
  const {scene,width,height,background,alt,src}=canvasRaster(props);
  return `<figure data-canvas-export=""${id?` data-block-id="${escape(id)}" ${KEEP_STATIC_ATTR}="canvas"`:''}>`+
    `<div data-canvas-fallback="" style="aspect-ratio:${width}/${height};max-width:${width}px;overflow:hidden;background:${escape(background)}">`+
    `<img alt="${escape(alt)}" src="${src}" width="${width}" height="${height}" style="display:block;width:100%;height:100%"></div>`+
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
/* Heading rows reserve their space with padding, too: 32px row space plus
   the text box's 4px above/below. Static margins would collapse with title. */
html[data-ob-canvas-export] main > h1:not(.doc-title) { margin:0; padding:calc(2rem + 4px) 0 4px; }
html[data-ob-canvas-export] main > h2 { margin:0; padding:calc(1.5rem + 4px) 0 4px; }
html[data-ob-canvas-export] main > h3 { margin:0; padding:calc(1rem + 4px) 0 4px; }
html[data-ob-canvas-hydrate] body, html[data-ob-canvas-hydrate] .ob-viewer {
  color:#1a1a1a; -webkit-font-smoothing:auto; -moz-osx-font-smoothing:auto; text-rendering:auto;
}
html[data-ob-canvas-export] .ob-viewer { font: inherit; }
/* Match the canonical static document's paint contexts as well as its boxes.
   Readonly rows have no selection/drop/gutter chrome. Keep canvas positioning
   and each widget's own internal containing blocks independent of this rule. */
html[data-ob-canvas-export] .obe-row:not(:has([data-canvas-export])),
html[data-ob-canvas-export] .obe-row:not(:has([data-canvas-export])) > .obe-blockbody {
  position:static; transform:none; filter:none; will-change:auto;
}
html[data-ob-canvas-export] [data-canvas-export] {
  margin:24px 0; padding:24px; background:hsl(var(--muted)); border-radius:var(--radius-lg);
}
html[data-ob-canvas-export] [data-canvas-export] > div { position:relative; max-width:672px; overflow:hidden; border-radius:var(--radius-md); }
html[data-ob-canvas-export] [data-canvas-export] canvas { position:absolute; inset:0; visibility:hidden; display:block; width:100%; touch-action:none; outline:none; }
/* Keep a direct keyboard ring where the parent selector is unsupported. */
html[data-ob-canvas-export] [data-canvas-export] canvas:focus-visible { outline:2px solid hsl(var(--ring)); outline-offset:-2px; border-radius:var(--radius-md); }
@supports selector(:has(*)) { html[data-ob-canvas-export] [data-canvas-export] canvas:focus-visible { outline:none; } }
html[data-ob-canvas-export] [data-canvas-export]:has(canvas:focus-visible) { outline:2px solid hsl(var(--ring)); outline-offset:4px; }
html[data-ob-canvas-export] [data-canvas-export] summary { width:fit-content; list-style:none; display:flex; align-items:center; gap:8px; margin-top:12px; font:inherit; font-size:12px; line-height:28px; color:hsl(var(--muted-foreground)); cursor:pointer; }
html[data-ob-canvas-export] [data-canvas-export] summary::-webkit-details-marker { display:none; }
html[data-ob-canvas-export] [data-canvas-export] summary::before { content:'+'; }
html[data-ob-canvas-export] [data-canvas-export] details[open] > summary::before { content:'−'; }
@media print { [data-canvas-export] > details { display:none; } }
html[data-ob-canvas-export] [data-canvas-export] canvas { -webkit-font-smoothing:auto; }
html[data-ob-canvas-export] .obe-row:has(> .obe-blockbody > .obe-custom > [data-canvas-export]) { padding-block:0; }
html[data-ob-canvas-export] .ob-viewer-page { max-width:720px; padding:48px 24px 120px; }
html[data-ob-canvas-export] .ob-viewer-title { display:block; font-size:40px; line-height:1.2; font-weight:700; letter-spacing:-.02em; }
/* The first figure's margin must not collapse with only the static title. */
html[data-ob-canvas-export] .doc-title, html[data-ob-canvas-export] .ob-viewer-title { margin:0; padding-bottom:1.2rem; }

`;
