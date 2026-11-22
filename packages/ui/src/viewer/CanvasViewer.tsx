import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {registerCustomBlock, type CustomBlockProps} from '@/blockeditor/registry';
import {registerPropsProjection} from '@/blockeditor/model';
import {StaticKeepBlock,useStaticKeep} from '@/blockeditor/staticKeep';
import {get, projectCanvas, readViewerCanvas} from './canvasScene';
import {paintViewer as paint} from './canvasPaint';
import {fitCanvas} from './canvasCamera';

/** Export-only renderer. The camera is local renderer state; no editor controller,
 * commands, history, persistence, transport or document mutation is used. */
export const CanvasViewer: React.FC<CustomBlockProps> = ({block}) => {
  const props = block.get('props');
  const staticRoot = useStaticKeep(String(block.get('id')));
  const kept = useMemo(() => {
    const node = staticRoot?.querySelector('[data-canvas-fallback]');
    return node ? node.cloneNode(true) as Element : null;
  }, [staticRoot]);
  const scene = useMemo(() => readViewerCanvas(props), [props]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const height = Math.min(960, Math.max(240, Number(get(props, 'height')) || 360));
  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    // Export scenes are immutable. Camera changes repaint synchronously and
    // cannot enter React/document history or any persistence path.
    const fitted=fitCanvas(scene.shapes,624,height);
    let camera = {...fitted}, drag:{x:number;y:number}|null = null;
    const draw = ():void => {
      if(!element.getContext('2d'))return;
      paint(element, scene.shapes, camera, 624, height);
      element.style.visibility='visible';
      if(kept instanceof HTMLElement)kept.style.visibility='hidden';
    };
    element.onpointerdown = event => {
      if(event.button!==0)return;
      element.setPointerCapture(event.pointerId);
      const scale=624/element.getBoundingClientRect().width;
      drag={x:event.clientX*scale-camera.x,y:event.clientY*scale-camera.y};
    };
    element.onpointermove = event => {
      if(drag){const scale=624/element.getBoundingClientRect().width;camera.x=event.clientX*scale-drag.x;camera.y=event.clientY*scale-drag.y;draw();}
    };
    element.onpointerup=element.onpointercancel=element.onlostpointercapture=()=>{drag=null;};
    element.onkeydown = event => {
      const axis=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(event.key);
      if(axis>=0)camera[axis<2?'x':'y']+=(axis%2?-1:1)*40;
      else if(event.key==='0')camera={...fitted};
      else if(['+','=','-'].includes(event.key)) {
        const zoom=Math.max(.1,Math.min(8,camera.zoom*(event.key==='-'?.8:1.25))),ratio=zoom/camera.zoom;
        for(const [axis,center] of [['x',312],['y',height/2]] as const)
          camera[axis]=center+(camera[axis]-center)*ratio;
        camera.zoom=zoom;
      }
      else return;
      event.preventDefault();draw();
    };
    draw();
    return () => {
      element.onpointerdown=element.onpointermove=element.onpointerup=element.onpointercancel=element.onlostpointercapture=element.onkeydown=null;
    };
  }, [scene, height, kept]);
  return <figure data-canvas-export="" >
    <div style={{position:'relative',aspectRatio:`624/${height}`,maxWidth:624,overflow:'hidden'}}>
      {kept && <StaticKeepBlock node={kept} />}
      <canvas ref={canvas} tabIndex={0} aria-label="Drawing. Drag to pan; plus and minus to zoom; zero to reset."
        style={{position:'absolute',inset:0,width:'100%',height:'100%',backgroundColor:String(get(props,'background') ?? '#ffffff'),touchAction:'none'}}
      />
    </div>
    {scene.diagnostics.length>0 && <figcaption role="status">{scene.diagnostics.join('; ')}</figcaption>}
    <details><summary>Inspect drawing ({scene.shapes.length} objects)</summary>
      <ol>{scene.shapes.map(shape => <li key={shape.id}>{String(shape.scalars.name || shape.scalars.kind)}{shape.scalars.kind==='text'?`: ${shape.scalars.text}`:''}</li>)}</ol>
    </details>
  </figure>;
};

export function registerCanvasViewer():void {
  registerPropsProjection('canvas', projectCanvas);
  registerCustomBlock({type:'canvas',render:CanvasViewer});
}
