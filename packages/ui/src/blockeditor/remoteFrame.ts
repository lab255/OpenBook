import * as Y from 'yjs';

// Installed by the app registration seam. Headless/non-app consumers retain
// synchronous delivery; the standalone viewer never imports this module.
let enabled=false;
export function registerRemoteFrameBatching():()=>void {
  enabled=true;
  return ()=>{enabled=false;};
}

/** Coalesce received remote packets, never local edits or outgoing ink. Every
 * packet still goes through Y.applyUpdate with its existing origin. One outer
 * transaction exposes the complete delivery burst to observers before paint. */
export function remoteFrameQueue(doc:Y.Doc,origin:'bc-remote'|'net') {
  let pending:Uint8Array[]=[];
  let frame:number|null=null;
  const flush=():void=>{
    if(frame!==null)cancelAnimationFrame(frame);
    frame=null;
    if(!pending.length)return;
    const batch=pending;pending=[];
    doc.transact(()=>{
      for(const update of batch){
        try{Y.applyUpdate(doc,update,origin);}
        catch{console.warn('Remote frame: malformed update skipped');}
      }
    },origin);
  };
  const visibility=()=>flush();
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',visibility);
  return {
    receive(update:Uint8Array):void {
      if(!enabled||typeof requestAnimationFrame!=='function'||typeof document!=='undefined'&&document.hidden){flush();Y.applyUpdate(doc,update,origin);return;}
      pending.push(update);
      if(frame===null)frame=requestAnimationFrame(flush);
    },
    // Preserve already received bytes when the provider is disconnected.
    close():void {if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visibility);flush();},
  };
}
