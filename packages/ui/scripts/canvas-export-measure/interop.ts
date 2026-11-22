import {exportFixture} from './exportFixture';
import {toPdf} from '../../src/export/toPdf';
import {buildDocumentModel} from '../../src/export/documentModel';
import {packageCanvasMarkdown} from '../../src/export/canvasMarkdown';
import {blocksToHtml} from '../../src/blockeditor/exportBlocks';
import {decodeSnapshot,rootBlocks,blockToJSON} from '../../src/blockeditor/model';
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
