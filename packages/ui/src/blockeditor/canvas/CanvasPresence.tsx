import {useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject} from 'react';
import type {Awareness} from 'y-protocols/awareness';
import {MousePointer2, Pencil, RectangleHorizontal, Circle, MoveUpRight, Type, Eraser, Hand} from 'lucide-react';
import type {AwarenessState} from '../awareness';
import {bounds, screen, type Camera, type Point} from './geometry';
import type {SceneShape} from './schema';
import {canvasFacet, canvasProducer, readCanvasFacet, type CanvasFacet} from './presence';

export function useCanvasProducer(awareness: Awareness | undefined, blockId: string, tool: CanvasFacet['tool'], selected: Set<string>, region: RefObject<HTMLDivElement|null>) {
  const producer = useMemo(()=>awareness ? canvasProducer(awareness) : undefined,[awareness]);
  const cursor = useRef<Point|null>(null);
  const state = useRef({blockId,tool,selected});state.current={blockId,tool,selected};
  const enter = () => {
    if (!document.hidden && region.current?.contains(document.activeElement)) {
      const s=state.current;producer?.state(canvasFacet(s.blockId,cursor.current,s.tool,s.selected));
    }
  };
  const leave = () => {cursor.current=null;if(awareness?.getLocalState()?.canvas?.blockId===blockId)producer?.clear();};
  const callbacks=useRef({enter,leave});callbacks.current={enter,leave};
  useLayoutEffect(()=>{enter();},[producer,blockId,tool,selected]);
  useEffect(()=>{
    const visibility=()=>{if(document.hidden)callbacks.current.leave();else callbacks.current.enter();};
    const blur=()=>callbacks.current.leave(),focus=()=>callbacks.current.enter();
    document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur);window.addEventListener('focus',focus);
    return ()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);producer?.dispose();};
  },[producer]);
  return {enter,leave,point(point:Point|null){cursor.current=point;if(!document.hidden&&region.current?.contains(document.activeElement))producer?.position(point);}};
}

const glyphs={select:MousePointer2,pen:Pencil,rect:RectangleHorizontal,ellipse:Circle,arrow:MoveUpRight,text:Type,erase:Eraser,pan:Hand};
function Peer({facet,user,shapes,camera,width,height}:{facet:CanvasFacet;user:NonNullable<AwarenessState['user']>;shapes:readonly SceneShape[];camera:Camera;width:number;height:number}) {
  const [idle,setIdle]=useState(false);
  const activity=JSON.stringify(facet);
  useEffect(()=>{setIdle(false);const timer=setTimeout(()=>setIdle(true),3000);return()=>clearTimeout(timer);},[activity]);
  const at=facet.cursor ? screen(facet.cursor,camera) : null,Icon=glyphs[facet.tool];
  return <>
    {shapes.filter(s=>facet.selectedShapeIds.includes(s.id)).map(s=>{const b=bounds(s),p=screen(b,camera);return <div key={s.id} className="ob-canvas-peer-selection" aria-hidden="true" style={{transform:`translate(${p.x}px,${p.y}px)`,width:b.w*camera.zoom,height:b.h*camera.zoom,outlineColor:user.color}}/>;})}
    {at&&at.x>=0&&at.y>=0&&at.x<=width&&at.y<=height&&<button type="button" className="ob-canvas-peer" data-idle={idle} aria-label={`${user.name}, ${facet.tool}${facet.selectionTruncated?', selection summarized':''}`} style={{transform:`translate(${at.x}px,${at.y}px)`,color:user.color}} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
      <MousePointer2 size={18} strokeWidth={1} aria-hidden="true"/>
      <span className="ob-canvas-peer-label"><Icon size={12} aria-hidden="true"/>{user.name}</span>
    </button>}
  </>;
}
export function CanvasPresence({awareness,blockId,shapes,camera,width,height}:{awareness:Awareness|undefined;blockId:string;shapes:readonly SceneShape[];camera:Camera;width:number;height:number}) {
  if(!awareness)return null;
  return <div className="ob-canvas-presence" aria-label="Canvas collaborators">{[...awareness.getStates()].map(([client,state]:[number,AwarenessState])=>{
    if(client===awareness.clientID)return null;
    const facet=readCanvasFacet(state.canvas),user=state.user;
    if(!facet||facet.blockId!==blockId||!user||typeof user.name!=='string'||typeof user.color!=='string')return null;
    return <Peer key={client} facet={facet} user={user} shapes={shapes} camera={camera} width={width} height={height}/>;
  })}</div>;
}
