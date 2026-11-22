import {readIsland,type PageSnapshot} from '@book.dev/sdk';
import {projectSnapshotForExport} from '../blockeditor/exportBlocks';
import {canvasRaster} from './canvasStatic';

/** Repaint native canvas PDF images at three pixels per CSS pixel. Source
 * islands stay untouched; only the offscreen PDF document gets denser PNGs. */
export function prepareCanvasPdf(root:Element,html:string):void {
  const island=readIsland<{id?:string;data?:PageSnapshot;library?:{pages:{id:string;data:PageSnapshot}[]}}>(html);
  if(!island)return;
  const pages=island.library?.pages??(island.data?[{id:island.id??'',data:island.data}]:[]);
  for(const page of pages){
    const snapshot=projectSnapshotForExport(page.data);
    const blocks=(snapshot.editorjs as {blocks?:{id?:string;type?:string;data?:{props?:unknown}}[]}).blocks??[];
    for(const block of blocks){
      if(block.type!=='canvas')continue;
      for(const figure of root.querySelectorAll<HTMLElement>('figure[data-canvas-export]')){
        if(figure.dataset.blockId!==block.id)continue;
        const section=figure.closest<HTMLElement>('[data-page]');if(section&&section.dataset.page!==page.id)continue;
        const image=figure.querySelector<HTMLImageElement>('img'),viewport=figure.querySelector<HTMLElement>('[data-canvas-fallback]');
        if(image&&viewport){const width=viewport.getBoundingClientRect().width;image.src=canvasRaster(block.data?.props,width,3).src;image.style.width=`${width}px`;image.width=width;}
      }
    }
  }
}
