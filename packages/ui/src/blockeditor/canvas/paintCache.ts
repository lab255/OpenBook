import {paint,paintShape,type Camera} from './geometry';
import type {SceneShape} from './schema';

function sameShape(a:SceneShape,b:SceneShape):boolean {
  if(a===b)return true;
  if(a.pointArity!==b.pointArity||a.points.length!==b.points.length)return false;
  for(const key of Object.keys(a.scalars))if(a.scalars[key]!==b.scalars[key])return false;
  for(let i=0;i<a.points.length;i++)if(a.points[i]!==b.points[i])return false;
  return true;
}

/** A screen-space settled raster, never an input queue. Every real sample
 * synchronously copies its exact device pixels and draws the active preview.
 * Scene/camera/size/DPR changes rebuild the raster with the reference painter.
 * Do not clip partial rebuilds: Chromium's clipped AA coverage differs from a
 * full repaint even at integer-aligned clip boundaries (raster-diagnosis.json). */
export class CommittedSceneCache {
  private layer:HTMLCanvasElement|null=null;
  private scene:readonly SceneShape[]|null=null;
  private view='';
  private entries=new Map<string,SceneShape>();

  draw(canvas:HTMLCanvasElement,scene:readonly SceneShape[],preview:readonly SceneShape[],camera:Camera,width:number,height:number):void {
    const ratio=window.devicePixelRatio||1;
    const view=[camera.x,camera.y,camera.zoom,width,height,ratio].join('/');
    if(!this.layer)this.layer=document.createElement('canvas');
    if(this.scene!==scene||this.view!==view){
      const changed=scene.length!==this.entries.size||scene.some(shape=>{
        const previous=this.entries.get(shape.id);return !previous||!sameShape(previous,shape);
      });
      if(changed||this.view!==view)paint(this.layer,scene,camera,width,height);
      this.entries=new Map(scene.map(shape=>[shape.id,shape]));this.scene=scene;this.view=view;
    }
    if(canvas.width!==this.layer.width)canvas.width=this.layer.width;
    if(canvas.height!==this.layer.height)canvas.height=this.layer.height;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    // Integer-aligned physical-pixel copy. No destination dimensions: fractional
    // CSS dimensions must never resample an already rasterized device bitmap.
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(this.layer,0,0);
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.translate(camera.x,camera.y);ctx.scale(camera.zoom,camera.zoom);
    for(const shape of preview)paintShape(ctx,shape);
  }
}
