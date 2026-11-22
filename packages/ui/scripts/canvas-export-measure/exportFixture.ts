import {blocksToHtml} from '../../src/blockeditor/exportBlocks';
import {buildDocumentModel} from '../../src/export/documentModel';
import {packageCanvasMarkdown} from '../../src/export/canvasMarkdown';
import {unzipSync,strFromU8} from 'fflate';
import * as Y from 'yjs';
import {createDoc,rootBlocks,encodeSnapshot,decodeSnapshot,registerPropsProjection,blockToJSON} from '../../src/blockeditor/model';
import {canvasDefaults,constructCanvasProps,createShape,projectCanvas} from '../../src/blockeditor/canvas/schema';
import {toHtml} from '../../src/export/toHtml';
import {readIsland,type PageSnapshot} from '@book.dev/sdk';
declare const __CANVAS_EXPORT_BUILD__:Record<string,string>;
registerPropsProjection('canvas',projectCanvas);
export function exportFixture(mixed:boolean|string=false):{html:string;snapshot:PageSnapshot;stamp:Record<string,string>;surfaces:Record<string,unknown>} {
  const before=!!mixed&&mixed!=='following',after=!!mixed&&mixed!=='preceding';
  const prefix = [
    ...(mixed==='rich'?[{id:'heading',type:'heading',props:{level:1},text:[{t:'Drawing in context'}]}]:[]),
    ...(before?[{id:'before',type:'paragraph',text:[{t:'Before the drawing: mixed document context.'}]}]:[]),
    ...(mixed==='rich'?[{id:'second',type:'paragraph',text:[{t:'A second paragraph checks document ink and rhythm.'}]}]:[]),
  ];
  const doc=createDoc([...prefix,{id:'drawing',type:'canvas'},...(after?[{id:'after',type:'paragraph',text:[{t:'After the drawing: content must remain in place.'}]}]:[])]);
  const drawingIndex=prefix.length;
  const props=constructCanvasProps({...canvasDefaults,shapes:{}});rootBlocks(doc).get(drawingIndex).set('props',props);
  const shapes=props.get('shapes') as Y.Map<Y.Map<unknown>>;
  for(const [i,kind] of ['rect','ellipse','arrow','text','stroke'].entries())shapes.set(String(i),createShape({id:String(i),kind,x:15+i*95,y:40,w:80,h:70,basisW:80,basisH:70,fill:'#e2e8f0',text:'Export text',pressureMode:kind==='stroke'?'variable':'constant',pointArity:kind==='stroke'?3:2,points:kind==='stroke'?[0,0,0,10,20,255,30,5,80,60,40,200]:[]}));
  const snapshot={editorjs:{blocks:[]},values:[],names:[],editor:'blocks',blockdoc:encodeSnapshot(doc)} as unknown as PageSnapshot;
  const binary=Y.encodeStateAsUpdate(doc);
  const html=toHtml(snapshot,'Canvas export','',undefined,{id:'canvas-export'});
  if(String(Y.encodeStateAsUpdate(doc))!==String(binary))throw new Error('Export mutated document bytes');
  const island=readIsland<{data:PageSnapshot}>(html);
  if(!island||JSON.stringify(island.data)!==JSON.stringify(snapshot))throw new Error('Source island changed');
  const fresh=decodeSnapshot(island.data.blockdoc as Parameters<typeof decodeSnapshot>[0]);
  if(JSON.stringify(projectCanvas(rootBlocks(fresh).get(drawingIndex).get('props') as Y.Map<unknown>))!==JSON.stringify(projectCanvas(props)))throw new Error('Fresh source import changed drawing');
  const clipboard=blocksToHtml([blockToJSON(rootBlocks(doc).get(drawingIndex))]);
  if(!clipboard.includes('data:image/png')||clipboard.includes('Unsupported block'))throw new Error('Clipboard did not render drawing');
  const zip=packageCanvasMarkdown(buildDocumentModel({title:'Canvas export',icon:'',snapshot}));
  if(!zip)throw new Error('Missing Markdown package');
  const files=unzipSync(zip),markdown=strFromU8(files['document.md']);
  if(!markdown.includes('assets/canvas-0.png')||!markdown.includes('Export text'))throw new Error('Missing Markdown image/text alternative');
  if(String(files['assets/canvas-0.png'].slice(0,8))!=='137,80,78,71,13,10,26,10')throw new Error('Invalid packaged PNG');
  if(String(Y.encodeStateAsUpdate(doc))!==String(binary))throw new Error('Export surfaces mutated document bytes');
  return {html,snapshot,stamp:__CANVAS_EXPORT_BUILD__,surfaces:{clipboardHtmlBytes:new TextEncoder().encode(clipboard).length,markdownZipBytes:zip.length,markdown,sourceIslandFreshImport:true,documentBytesUnchanged:true}};
}
Object.assign(window,{exportCanvasFixture:exportFixture});
