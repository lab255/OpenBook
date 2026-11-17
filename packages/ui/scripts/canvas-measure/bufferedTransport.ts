import {connectBroadcast, type BroadcastConnection} from '../../src/blockeditor/provider';
import * as Y from 'yjs';

/** Real production providers + real native BroadcastChannels. Only the harness
 * channel's outgoing document packets are held during an explicit outage.
 * They are later delivered unchanged by native postMessage. */
export function bufferedProviders(a:Y.Doc,b:Y.Doc) {
  const Native=window.BroadcastChannel,name=`canvas-build4-outage-${crypto.randomUUID()}`;
  let offline=false,bufferedBytes=0,deliveredBytes=0;
  const held:{channel:FaultChannel;message:unknown;bytes:number}[]=[];
  class FaultChannel extends Native {
    postMessage(message:{type?:string;payload?:Uint8Array}):void {
      if(this.name===`obe:${name}`&&offline&&(message.type==='update'||message.type==='state')){
        const bytes=message.payload?.byteLength??0;bufferedBytes+=bytes;held.push({channel:this,message:structuredClone(message),bytes});return;
      }
      super.postMessage(message);
    }
    release(message:unknown):void {super.postMessage(message);}
  }
  window.BroadcastChannel=FaultChannel;
  let first:BroadcastConnection,second:BroadcastConnection;
  try{first=connectBroadcast(a,name,'Local');second=connectBroadcast(b,name,'Peer');}
  finally{window.BroadcastChannel=Native;}
  return {
    outage(){offline=true;bufferedBytes=0;deliveredBytes=0;},
    state(){return {offline,bufferedPackets:held.length,bufferedBytes,deliveredBytes};},
    reconnect(){offline=false;for(const item of held.splice(0)){item.channel.release(item.message);deliveredBytes+=item.bytes;}return {bufferedBytes,deliveredBytes};},
    close(){first.disconnect();second.disconnect();held.length=0;},
  };
}
