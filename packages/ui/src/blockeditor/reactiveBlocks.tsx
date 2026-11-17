// App registration seam: editing-only registrations belong here.
// The standalone viewer imports reactiveCore directly.
import {PenTool} from 'lucide-react';
import {registerReactiveBlocks as registerCore} from './reactiveCore';
import {registerHistoryExtension} from './historyExtension';
import {registerPropsProjection, registerPropsConstructor} from './model';
import {projectCanvas, constructCanvasProps, canvasDefaults} from './canvas/schema';
import {CanvasHistory} from './canvas/history';
import {CanvasBlock} from './canvas/CanvasBlock';
import {registerCustomBlock} from './registry';
import {registerRemoteFrameBatching} from './remoteFrame';

export function registerReactiveBlocks(): void {
  registerRemoteFrameBatching();
  registerHistoryExtension((doc, canWrite) => new CanvasHistory(doc, canWrite));
  registerPropsProjection('canvas', projectCanvas);
  registerPropsConstructor('canvas', constructCanvasProps);
  registerCustomBlock({type:'canvas',render:CanvasBlock,focusOnInsert:true,slash:{icon:PenTool,label:'Canvas',hint:'Draw and diagram together',keywords:'whiteboard drawing sketch',group:'interactive',make:()=>({type:'canvas',props:{...canvasDefaults,shapes:{}}})}});
  registerCore();
}
