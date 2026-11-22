import {strToU8,zipSync} from 'fflate';
import type {DocBlock,DocModel} from './documentModel';
import {toMarkdown} from './toMarkdown';
/** Markdown readers need a packaged PNG, not assumed inline-SVG support.
 * Ordinary pages keep their existing single .md download. */
export function packageCanvasMarkdown(model:DocModel):Uint8Array|null {
  const files:Record<string,Uint8Array>={};
  const visit=(blocks:DocBlock[]):DocBlock[]=>blocks.map(block=>{
    if(block.type==='togglelist')return {...block,children:visit(block.children)};
    if(block.type!=='image'||!block.packageAs)return block;
    const encoded=block.src.match(/^data:image\/png;base64,(.*)$/)?.[1];
    if(!encoded)throw new Error('Canvas Markdown requires its PNG asset');
    const filename=`assets/canvas-${Object.keys(files).length}.png`;
    files[filename]=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
    return {...block,src:filename,caption:[block.alt,block.caption].filter(Boolean).join('\n')};
  });
  const projected={...model,blocks:visit(model.blocks)};
  if(!Object.keys(files).length)return null;
  files['document.md']=strToU8(toMarkdown(projected));
  return zipSync(files);
}
