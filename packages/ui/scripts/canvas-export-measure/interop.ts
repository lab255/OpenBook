import {toHtml} from '../../src/export/toHtml';
import type {PageSnapshot} from '@book.dev/sdk';
import {exportFixture} from './exportFixture';
import {toPdf} from '../../src/export/toPdf';
import {buildDocumentModel} from '../../src/export/documentModel';
import {packageCanvasMarkdown} from '../../src/export/canvasMarkdown';
import {blocksToHtml} from '../../src/blockeditor/exportBlocks';
import {decodeSnapshot,rootBlocks,blockToJSON,createDoc,encodeSnapshot} from '../../src/blockeditor/model';
const base64=(bytes:Uint8Array)=>{let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text);};
async function interop() {
  const fixture=exportFixture('surrounding');
  const pdfs:Record<string,string>={};
  for(const mode of ['paged','continuous'] as const)pdfs[mode]=base64(new Uint8Array(await (await toPdf(fixture.html,mode)).arrayBuffer()));
  const doc=decodeSnapshot(fixture.snapshot.blockdoc as Parameters<typeof decodeSnapshot>[0]);
  const clipboard=blocksToHtml(rootBlocks(doc).toArray().map(blockToJSON));
  const zip=packageCanvasMarkdown(buildDocumentModel({title:'Canvas export',icon:'',snapshot:fixture.snapshot}));
  if(!zip)throw new Error('Missing canvas ZIP');
  return {pdfs,clipboard,zip:base64(zip),stamp:fixture.stamp};
}
Object.assign(window,{canvasInterop:interop});

async function nonCanvasPdfFixture() {
  const image=document.createElement('canvas');image.width=120;image.height=60;
  const context=image.getContext('2d')!;context.fillStyle='#3979a8';context.fillRect(0,0,120,60);context.fillStyle='#e9b658';context.fillRect(20,10,80,40);
  const doc=createDoc([{id:'text',type:'paragraph',text:[{t:'Non-canvas PDF control: selectable text.'}]},
    {id:'image',type:'image',props:{src:image.toDataURL(),width:120,caption:'Reference image'}},
    {id:'database',type:'database',props:{pageId:'database-page'}}]);
  const snapshot={editorjs:{blocks:[]},values:[],names:[],editor:'blocks',blockdoc:encodeSnapshot(doc)} as unknown as PageSnapshot;
  const html=toHtml(snapshot,'Non-canvas PDF','',undefined,{id:'noncanvas'});
  const pdf=base64(new Uint8Array(await (await toPdf(html,'paged')).arrayBuffer()));
  return {html,pdf,image:image.toDataURL(),snapshot};
}
Object.assign(window,{nonCanvasPdfFixture});
