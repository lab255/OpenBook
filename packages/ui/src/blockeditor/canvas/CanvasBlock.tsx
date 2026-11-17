import {useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode} from 'react';
import {MousePointer2, Pencil, RectangleHorizontal, Circle, MoveUpRight, Type, Eraser, Hand, Undo2, Redo2, HelpCircle} from 'lucide-react';
import {keysBetween} from '@book.dev/sdk';
import type {CustomBlockProps} from '../registry';
import {CanvasHistory, type HistoryResult} from './history';
import {eraseShapes, insertShapes, placementKey} from './commands';
import {get, readCanvas, shapeDefaults, type SceneShape, type Scalar} from './schema';
import {CommittedSceneCache} from './paintCache';
import {arrowValues, bounds, contains, endpoints, hit, number, paint, pointBounds, resized, screen, union, world, type Bounds, type Camera, type Point} from './geometry';
import './canvas.css';

type Tool='select'|'stroke'|'rect'|'ellipse'|'arrow'|'text'|'erase'|'pan';
const tools:readonly [Tool,string,string][]=[['select','Select','V'],['stroke','Pen','P'],['rect','Rectangle','R'],['ellipse','Ellipse','O'],['arrow','Arrow','A'],['text','Text','T'],['erase','Erase','E'],['pan','Pan','H']];
const toolIcons={select:MousePointer2,stroke:Pencil,rect:RectangleHorizontal,ellipse:Circle,arrow:MoveUpRight,text:Type,erase:Eraser,pan:Hand};
const names:Record<string,string>={stroke:'Stroke',rect:'Rectangle',ellipse:'Ellipse',arrow:'Arrow',text:'Text'};
interface Gesture {kind:'create'|'move'|'resize'|'endpoint'|'marquee'|'erase'|'pan'|'height';pointer:number;start:Point;at:Point;camera:Camera;shapes:SceneShape[];preview:SceneShape[];ids:Set<string>;handle?:string;from?:Bounds;height?:number}
interface TextEdit {id?:string;x:number;y:number;w:number;h:number;text:string}
const makePreview=(kind:string,values:Record<string,Scalar>,points:number[]=[],arity:2|3=2):SceneShape=>({id:'preview',scalars:{...shapeDefaults,kind,...values},points,pointArity:arity});
const label=(s:SceneShape,i=0)=>String(s.scalars.name||s.scalars.text||`${names[String(s.scalars.kind)]} ${i+1}`);
const editableTarget=(target:EventTarget|null)=>target instanceof HTMLElement&&!!target.closest('input, textarea, select, [contenteditable="true"]');
function CoordinateField({value,onChange,...props}:Omit<React.InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'> & {value:number;onChange:(value:number)=>void}) {
  const [focused,setFocused]=useState(false);
  return <input {...props} type="number" step="any" value={focused?value:Math.round(value*100)/100} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={e=>{if(e.target.value!==''&&Number.isFinite(Number(e.target.value)))onChange(Number(e.target.value));}}/>;
}
const swatches=[['Ink','#111111'],['Red','#b91c1c'],['Blue','#1d4ed8']] as const;
function ColorControl({name,value,onChange,tab,fill=false}:{name:string;value:string;onChange:(value:string)=>void;tab:number;fill?:boolean}) {
  return <div className="ob-canvas-color" role="group" aria-label={name}>
    <span>{name}</span>{[...(fill?[['None','none']]:[]),...swatches].map(([label,color])=><button type="button" key={label} tabIndex={tab} aria-label={`${name}: ${label}`} aria-pressed={value===color} title={label} onClick={()=>onChange(color)}><i style={{background:color==='none'?'transparent':color}}/>{color==='none'?'∅':value===color?'✓':null}</button>)}
    <input tabIndex={tab} aria-label={fill?'Fill color or none':'Stroke color value'} value={value} onChange={e=>onChange(e.target.value)}/>
  </div>;
}
// Rule 14a: reserve only previously visible chrome hidden remotely during this
// activation. Local selection/tool changes reset the key; inactive chrome unmounts.
function ReservedProperties({visible,reserve,children}:{visible:boolean;reserve:boolean;children:ReactNode}) {
  const retained=useRef<ReactNode>(null);
  if(visible)retained.current=children;else if(!reserve)retained.current=null;
  return retained.current?<div className="ob-canvas-properties" aria-label="Canvas properties" inert={!visible} aria-hidden={!visible} style={{visibility:visible?'visible':'hidden'}}><fieldset disabled={!visible} style={{display:'contents'}}>{retained.current}</fieldset></div>:null;
}
export function CanvasBlock({block,editor,pageReadOnly}:CustomBlockProps) {
  const id=String(block.get('id')),props=block.get('props');
  const scene=useMemo(()=>readCanvas(props),[props,editor.version]),readOnly=pageReadOnly||!scene.editable;
  const [tool,updateTool]=useState<Tool>('stroke'),[active,setActive]=useState(false),[selected,setSelected]=useState<Set<string>>(new Set());
  const [localChromeEpoch,setLocalChromeEpoch]=useState(0);
  const remoteChrome=useRef(false),editingChromeSeen=useRef(false);
  const localChromeChange=()=>{setLocalChromeEpoch(value=>value+1);remoteChrome.current=false;if(readOnly)editingChromeSeen.current=false;};
  const setTool=(next:Tool)=>{localChromeChange();updateTool(next);};
  useEffect(()=>{const observe=(transaction:{local:boolean})=>{remoteChrome.current=!transaction.local;};editor.doc.on('afterTransaction',observe);return()=>editor.doc.off('afterTransaction',observe);},[editor.doc]);
  if(!active)editingChromeSeen.current=false;
  else if(!readOnly)editingChromeSeen.current=true;
  const keepEditingChrome=!readOnly||editingChromeSeen.current;
  const [camera,setCamera]=useState<Camera>({x:0,y:0,zoom:1}),[width,setWidth]=useState(640),[heightPreview,setHeightPreview]=useState<number|null>(null);
  const height=heightPreview??Number(get(props,'height')??360);
  const [objects,setObjects]=useState(false),[help,setHelp]=useState(false),[arrangeOpen,setArrangeOpen]=useState(false),[listFocus,setListFocus]=useState(0),[toolbarFocus,setToolbarFocus]=useState<Tool>('stroke');
  const [stroke,setStroke]=useState('#111111'),[fill,setFill]=useState('none'),[strokeWidth,setStrokeWidth]=useState(3),[pressure,setPressure]=useState(true),[aspect,setAspect]=useState(false);
  const [announcement,setAnnouncement]=useState(''),[textEdit,setTextEdit]=useState<TextEdit|null>(null),[keyboardPath,setKeyboardPath]=useState<SceneShape|null>(null),[crosshair,setCrosshair]=useState<Point|null>(null);
  const [,refresh]=useState(0);
  const region=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),textInput=useRef<HTMLTextAreaElement>(null);
  const arrangeTrigger=useRef<HTMLButtonElement>(null),captures=useRef(new Map<number,HTMLElement>());
  const focusedObject=useRef<string|null>(null),initialView=useRef(false);
  const paintCache=useRef<CommittedSceneCache|null>(null);
  if(!paintCache.current)paintCache.current=new CommittedSceneCache();
  const gesture=useRef<Gesture|null>(null),composing=useRef(false),spaceTool=useRef<Tool|null>(null),penDown=useRef(false),pressureSamples=useRef<Set<number>>(new Set()),verifiedPressure=useRef(false);
  const touches=useRef(new Map<number,Point>()),touchPair=useRef<{distance:number;mid:Point;camera:Camera}|null>(null),ignoredTouches=useRef(new Set<number>());
  const announceTimer=useRef<ReturnType<typeof setTimeout>|null>(null),lastScene=useRef(scene.shapes),latest=useRef({scene,camera,height,width,readOnly,keyboardPath});
  latest.current={scene,camera,height,width,readOnly,keyboardPath};
  const chosen=scene.shapes.filter(s=>selected.has(s.id)),selectionBounds=chosen.length?union(chosen):null;
  const tab=active?0:-1;
  const history=()=>{const h=editor.history?.();return h instanceof CanvasHistory?h:null;};
  const announce=(text:string,coalesce=false)=>{if(announceTimer.current)clearTimeout(announceTimer.current);if(coalesce)announceTimer.current=setTimeout(()=>setAnnouncement(text),200);else setAnnouncement(text);};
  const draw=(preview=gesture.current?.preview??[])=>{
    const current=latest.current;if(!canvas.current)return;
    if(preview.some(s=>s.id!=='preview')){
      // Existing-object manipulation preserves its original z-order.
      const overrides=new Map(preview.map(s=>[s.id,s]));
      paint(canvas.current,current.scene.shapes.map(s=>overrides.get(s.id)??s),current.camera,current.width,current.height);
    }else paintCache.current!.draw(canvas.current,current.scene.shapes,[...preview,...(current.keyboardPath?[current.keyboardPath]:[])],current.camera,current.width,current.height);
  };
  const choose=(ids:Iterable<string>)=>{localChromeChange();const next=new Set(ids);setSelected(next);announce(`${next.size} object${next.size===1?'':'s'} selected`);};
  const commit=(action:string,changes:{shapeId?:string;values:Record<string,unknown>}[])=>{
    if(latest.current.readOnly)return;
    const h=history();if(!h)return;
    const result=h.commitCanvasCommand(action,changes.map(c=>({...c,blockId:id})));refresh(n=>n+1);return result;
  };
  const releaseCapture=(pointer:number)=>{const element=captures.current.get(pointer);captures.current.delete(pointer);if(element&&(!element.hasPointerCapture||element.hasPointerCapture(pointer)))element.releasePointerCapture(pointer);};
  const capture=(pointer:number)=>{const element=viewport.current;if(element){element.setPointerCapture(pointer);captures.current.set(pointer,element);}};
  const releaseAllCaptures=()=>{for(const pointer of captures.current.keys())releaseCapture(pointer);};
  const closeArrange=()=>{setArrangeOpen(false);arrangeTrigger.current?.focus();};
  const resetContact=()=>{
    penDown.current=false;releaseAllCaptures();
    for(const id of touches.current.keys())ignoredTouches.current.add(id);
    touches.current.clear();touchPair.current=null;
  };
  const cancel=()=>{
    resetContact();
    const g=gesture.current;
    if(g||keyboardPath||textEdit){gesture.current=null;setKeyboardPath(null);setCrosshair(null);setTextEdit(null);setHeightPreview(null);announce(g?.kind==='create'||keyboardPath?'Stroke interrupted':'Move cancelled');draw([]);refresh(n=>n+1);return true;}
    return false;
  };
  const interruptLatest=useRef<()=>void>(()=>{});
  useEffect(()=>{const interrupt=()=>interruptLatest.current();window.addEventListener('blur',interrupt);return()=>{window.removeEventListener('blur',interrupt);gesture.current=null;penDown.current=false;touches.current.clear();ignoredTouches.current.clear();touchPair.current=null;releaseAllCaptures();};},[]);
  useEffect(()=>{if(arrangeOpen)region.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();},[arrangeOpen]);
  const activate=()=>{setActive(true);editor.setFocusedId(id);};
  useLayoutEffect(()=>{
    if(!viewport.current)return;
    const update=()=>{
      const width=viewport.current!.clientWidth||640;setWidth(width);
      if(!initialView.current){
        initialView.current=true;
        const current=latest.current;
        if(current.scene.shapes.length){const b=union(current.scene.shapes),z=Math.min(4,Math.max(.1,Math.min((width-40)/Math.max(1,b.w),(current.height-40)/Math.max(1,b.h))));setCamera({zoom:z,x:(width-b.w*z)/2-b.x*z,y:(current.height-b.h*z)/2-b.y*z});}
      }
    };update();
    const observer=new ResizeObserver(update);observer.observe(viewport.current);return()=>observer.disconnect();
  },[]);
  useLayoutEffect(()=>{draw();},[editor.version,camera,width,height,keyboardPath]);
  useEffect(()=>()=>{if(announceTimer.current)clearTimeout(announceTimer.current);},[]);
  useEffect(()=>{if(textEdit)textInput.current?.focus();},[!!textEdit]);
  useEffect(()=>{
    if(editor.pendingCaret.current?.blockId===id){editor.pendingCaret.current=null;region.current?.focus();region.current?.scrollIntoView({block:'nearest'});}
  },[editor.version,id]);
  useLayoutEffect(()=>{
    const missing=[...selected].filter(id=>!scene.shapes.some(s=>s.id===id));
    if(missing.length){
      const previous=lastScene.current.findIndex(s=>s.id===missing[0]);
      setSelected(new Set([...selected].filter(id=>!missing.includes(id))));
      const index=Math.max(0,Math.min(previous,scene.shapes.length-1));setListFocus(index);
      if(gesture.current?.shapes.some(s=>missing.includes(s.id))||textEdit?.id&&missing.includes(textEdit.id))cancel();
      if(arrangeOpen)closeArrange();
      else if(active||region.current?.contains(document.activeElement)||focusedObject.current&&missing.includes(focusedObject.current)){if(objects&&scene.shapes.length)region.current?.querySelector<HTMLElement>(`[data-object-index="${index}"]`)?.focus();else region.current?.focus();}
      announce('Selected object removed');
    }
    lastScene.current=scene.shapes;
  },[editor.version]);
  useLayoutEffect(()=>{if(readOnly){setArrangeOpen(false);if(active)region.current?.focus();cancel();updateTool('pan');setToolbarFocus('pan');announce('View only');}},[readOnly]);
  const pointerPosition=(e:{clientX:number;clientY:number}):Point=>{const r=viewport.current!.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  const center=()=>world({x:width/2,y:height/2},camera);
  const create=(inputs:readonly Record<string,unknown>[],action:string,selectCreated=true)=>{
    if(latest.current.readOnly)return;
    const h=history();if(!h)return;
    const ords=keysBetween(scene.shapes.length?String(scene.shapes[scene.shapes.length-1].scalars.ord):null,null,inputs.length);
    const ids=insertShapes(h,id,inputs.map((input,i)=>({...input,ord:ords[i]})),action);if(selectCreated)choose(ids);refresh(n=>n+1);return ids;
  };
  const createPreview=(kind:Tool,a:Point,b:Point,constrain=false):SceneShape=>{
    if(kind==='arrow'){
      if(constrain){const angle=Math.round(Math.atan2(b.y-a.y,b.x-a.x)/(Math.PI/12))*Math.PI/12,len=Math.hypot(b.x-a.x,b.y-a.y);b={x:a.x+Math.cos(angle)*len,y:a.y+Math.sin(angle)*len};}
      return makePreview(kind,{...arrowValues(a,b),stroke,fill,strokeWidth});
    }
    if(constrain){const size=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y));b={x:a.x+Math.sign(b.x-a.x||1)*size,y:a.y+Math.sign(b.y-a.y||1)*size};}
    return makePreview(kind,{...pointBounds([a,b]),stroke,fill,strokeWidth});
  };
  const finishShape=(s:SceneShape)=>{create([{...s.scalars,points:s.points,pointArity:s.pointArity}],names[String(s.scalars.kind)],s.scalars.kind!=='stroke');if(s.scalars.kind!=='stroke')setTool('select');};
  const startText=(p:Point,s?:SceneShape)=>{if(readOnly)return;setTextEdit({id:s?.id,x:s?number(s,'x'):p.x,y:s?number(s,'y'):p.y,w:s?number(s,'w'):200,h:s?number(s,'h'):100,text:s?String(s.scalars.text):''});};
  const finishText=(restoreFocus=true)=>{if(!textEdit||readOnly)return;resetContact();if(textEdit.text.length){if(textEdit.id)commit('Edit text',[{shapeId:textEdit.id,values:{text:textEdit.text}}]);else create([{kind:'text',...textEdit,stroke,fill,strokeWidth}],'Text');}setTextEdit(null);setTool('select');if(restoreFocus)viewport.current?.focus();};
  interruptLatest.current=()=>{if(textEdit)finishText(false);else cancel();};
  const remove=(ids:Iterable<string>)=>{if(readOnly)return;const h=history();if(h){eraseShapes(h,id,[...ids]);choose([]);announce('Objects erased');refresh(n=>n+1);}};
  const duplicate=()=>{create(chosen.map(s=>({...s.scalars,x:number(s,'x')+10,y:number(s,'y')+10,pointArity:s.pointArity,points:s.points})),'Duplicate');};
  const arrange=(direction:'forward'|'backward'|'front'|'back')=>{
    const ordered=[...scene.shapes];
    if(direction==='front'||direction==='back'){const selectedShapes=ordered.filter(s=>selected.has(s.id)),others=ordered.filter(s=>!selected.has(s.id));ordered.splice(0,ordered.length,...(direction==='front'?[...others,...selectedShapes]:[...selectedShapes,...others]));}
    else if(direction==='forward'){for(let i=ordered.length-2;i>=0;i--)if(selected.has(ordered[i].id)&&!selected.has(ordered[i+1].id))[ordered[i],ordered[i+1]]=[ordered[i+1],ordered[i]];}
    else for(let i=1;i<ordered.length;i++)if(selected.has(ordered[i].id)&&!selected.has(ordered[i-1].id))[ordered[i],ordered[i-1]]=[ordered[i-1],ordered[i]];
    if(ordered.every((s,i)=>s.id===scene.shapes[i].id))return;
    const h=history();if(!h)return;
    const changes:{shapeId:string;values:{ord:string}}[]=[];
    for(let i=0;i<ordered.length;){
      if(!selected.has(ordered[i].id)){i++;continue;}
      let end=i;while(end<ordered.length&&selected.has(ordered[end].id))end++;
      const left=i?ordered[i-1].id:null,right=end<ordered.length?ordered[end].id:null;
      const first=placementKey(h,id,left,right,[...selected]);
      const ords=[first,...keysBetween(first,right?String(ordered[end].scalars.ord):null,end-i-1)];
      for(let at=i;at<end;at++)changes.push({shapeId:ordered[at].id,values:{ord:ords[at-i]}});
      i=end;
    }
    commit('Arrange',changes);announce('Object order changed');
  };
  const zoom=(value:number,anchor:Point={x:width/2,y:height/2})=>{if(!Number.isFinite(value))return;const z=Math.max(.1,Math.min(4,value)),p=world(anchor,camera);setCamera({zoom:z,x:anchor.x-p.x*z,y:anchor.y-p.y*z});};
  const fit=()=>{if(!scene.shapes.length){setCamera({x:0,y:0,zoom:1});return;}const b=union(scene.shapes),z=Math.min(4,Math.max(.1,Math.min((width-40)/Math.max(1,b.w),(height-40)/Math.max(1,b.h))));setCamera({zoom:z,x:(width-b.w*z)/2-b.x*z,y:(height-b.h*z)/2-b.y*z});};
  const reveal=()=>{if(!selectionBounds)return;setCamera({...camera,x:width/2-(selectionBounds.x+selectionBounds.w/2)*camera.zoom,y:height/2-(selectionBounds.y+selectionBounds.h/2)*camera.zoom});announce('Selection revealed');};
  const undo=(redo=false)=>{
    if(readOnly)return;
    const result=(redo?editor.undo.redo():editor.undo.undo()) as unknown as HistoryResult|undefined;
    refresh(n=>n+1);
    if(result?.reason==='adjusted')announce(`${redo?'Redo':'Undo'} adjusted because this object changed`);
    else if(result?.reason==='no-op')announce(`Nothing to ${redo?'redo':'undo'}; this object changed`);
    else announce(`${redo?'Redo':'Undo'} ${result?.label??''}`);
  };
  const samplePressure=(e:PointerEvent)=>{if(e.pointerType==='pen'&&e.buttons&&Number.isFinite(e.pressure)&&e.pressure>0&&e.pressure<=1){pressureSamples.current.add(e.pressure);if(pressureSamples.current.size>=3)verifiedPressure.current=true;}};
  const startGesture=(e:ReactPointerEvent,kind?:Gesture['kind'],handle?:string)=>{
    if(e.button!==0||textEdit)return;
    if(e.pointerType==='touch'){
      if(penDown.current){ignoredTouches.current.add(e.pointerId);return;}
      ignoredTouches.current.delete(e.pointerId); // A fresh down is required after pen teardown.
      const p=pointerPosition(e);touches.current.set(e.pointerId,p);
      if(touches.current.size===2){gesture.current=null;const [a,b]=[...touches.current.values()];touchPair.current={distance:Math.hypot(a.x-b.x,a.y-b.y),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},camera};capture(e.pointerId);return;}
    }
    if(gesture.current)return;
    activate();viewport.current?.focus();e.preventDefault();e.stopPropagation();capture(e.pointerId);
    if(e.pointerType==='pen')penDown.current=true;
    const p=world(pointerPosition(e),camera),target=[...scene.shapes].reverse().find(s=>hit(s,p,camera.zoom));
    const effective=readOnly?'pan':tool;
    if(!kind&&effective==='text'&&e.pointerType!=='touch'){startText(p);return;}
    let mode=kind??(effective==='pan'?'pan':effective==='erase'?'erase':effective==='select'?'marquee':'create');
    let selection=chosen;
    if(!kind&&(effective==='select'||e.pointerType==='touch')){
      if(target){const next=new Set(e.shiftKey?selected: selected.has(target.id)?selected:[]);if(e.shiftKey&&next.has(target.id))next.delete(target.id);else next.add(target.id);choose(next);selection=scene.shapes.filter(s=>next.has(s.id));mode=e.pointerType==='touch'?'pan':'move';}
      else {mode=e.pointerType==='touch'?'pan':'marquee';if(!e.shiftKey)choose([]);}
    }
    const g:Gesture={kind:mode,pointer:e.pointerId,start:p,at:p,camera:{...camera},shapes:selection,preview:[],ids:new Set(e.shiftKey?selected:[]),handle,from:selection.length?union(selection):undefined,height};
    if(mode==='create'){
      if(effective==='stroke'){
        const variable=e.pointerType==='pen'&&pressure&&verifiedPressure.current&&Number.isFinite(e.pressure)&&e.pressure>0;
        g.preview=[makePreview('stroke',{x:p.x,y:p.y,w:1,h:1,basisW:1,basisH:1,stroke,strokeWidth,pressureMode:variable?'variable':'constant'},variable?[0,0,Math.round(Math.min(1,e.pressure)*255)]:[0,0],variable?3:2)];
      }else g.preview=[createPreview(effective,p,p,e.shiftKey)];
    }
    if(mode==='erase'&&target)g.ids.add(target.id);
    gesture.current=g;samplePressure(e.nativeEvent);draw(g.preview);refresh(n=>n+1);
  };
  const moveGesture=(e:ReactPointerEvent)=>{
    if(e.pointerType==='touch'){
      if(penDown.current||ignoredTouches.current.has(e.pointerId))return;
      if(touches.current.has(e.pointerId))touches.current.set(e.pointerId,pointerPosition(e));
      if(touchPair.current&&touches.current.size===2){const [a,b]=[...touches.current.values()],pair=touchPair.current,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},z=Math.max(.1,Math.min(4,pair.camera.zoom*Math.hypot(a.x-b.x,a.y-b.y)/(pair.distance||1))),anchor=world(pair.mid,pair.camera);setCamera({zoom:z,x:mid.x-anchor.x*z,y:mid.y-anchor.y*z});return;}
    }
    const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();
    if(readOnly&&g.kind!=='pan'){cancel();return;}
    const p=world(pointerPosition(e),g.camera);g.at=p;
    if(g.kind==='pan'){setCamera({...g.camera,x:g.camera.x+(p.x-g.start.x)*g.camera.zoom,y:g.camera.y+(p.y-g.start.y)*g.camera.zoom});return;}
    if(g.kind==='height'){setHeightPreview(Math.min(960,Math.max(240,g.height!+(p.y-g.start.y)*g.camera.zoom)));return;}
    if(g.kind==='create'){
      const s=g.preview[0];
      if(s.scalars.kind==='stroke'){
        const coalesced=typeof e.nativeEvent.getCoalescedEvents==='function'?e.nativeEvent.getCoalescedEvents():[];
        const samples=coalesced.length?coalesced:[e.nativeEvent];const ps=[...s.points];
        for(const sample of samples){samplePressure(sample);if(sample.pointerType==='pen'&&sample.pressure===0)continue;const q=world(pointerPosition(sample),g.camera);ps.push(q.x-g.start.x,q.y-g.start.y);if(s.pointArity===3)ps.push(Math.round(Math.max(0,Math.min(1,Number.isFinite(sample.pressure)?sample.pressure:.5))*255));}
        g.preview=[{...s,points:ps}];
      }else g.preview=[createPreview(s.scalars.kind as Tool,g.start,p,e.shiftKey)];
    }else if(g.kind==='move')g.preview=g.shapes.map(s=>({...s,scalars:{...s.scalars,x:number(s,'x')+p.x-g.start.x,y:number(s,'y')+p.y-g.start.y}}));
    else if(g.kind==='resize'){
      const b=g.from!,h=g.handle!,dx=p.x-g.start.x,dy=p.y-g.start.y;const next={...b};
      if(h.includes('w')){next.x=Math.min(b.x+dx,b.x+b.w);next.w=Math.max(0,b.w-dx);}if(h.includes('e'))next.w=Math.max(0,b.w+dx);
      if(h.includes('n')){next.y=Math.min(b.y+dy,b.y+b.h);next.h=Math.max(0,b.h-dy);}if(h.includes('s'))next.h=Math.max(0,b.h+dy);
      if((aspect||e.shiftKey)&&b.w&&b.h){
        if(h==='n'||h==='s'){next.w=next.h*b.w/b.h;next.x=b.x+(b.w-next.w)/2;}
        else {next.h=next.w*b.h/b.w;if(h==='e'||h==='w')next.y=b.y+(b.h-next.h)/2;else if(h.includes('n'))next.y=b.y+b.h-next.h;}
      }
      g.preview=g.shapes.map(s=>({...s,scalars:{...s.scalars,...resized(s,b,next)}}));
    }else if(g.kind==='endpoint'){
      const s=g.shapes[0],[a,b]=endpoints(s);g.preview=[{...s,scalars:{...s.scalars,...arrowValues(g.handle==='start'?p:a,g.handle==='end'?p:b)}}];
    }else if(g.kind==='erase')for(const s of scene.shapes)if(hit(s,p,camera.zoom))g.ids.add(s.id);
    draw(g.preview);refresh(n=>n+1);
  };
  const endGesture=(e:ReactPointerEvent)=>{
    releaseCapture(e.pointerId);
    if(e.pointerType==='touch'){touches.current.delete(e.pointerId);ignoredTouches.current.delete(e.pointerId);if(touchPair.current){touchPair.current=null;for(const id of touches.current.keys())ignoredTouches.current.add(id);touches.current.clear();return;}}
    if(e.pointerType==='pen')resetContact();
    const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();gesture.current=null;
    if(readOnly&&g.kind!=='pan'){draw([]);return;}
    if(g.kind==='create'){
      let s=g.preview[0];if(s.scalars.kind!=='stroke'&&Math.hypot(g.at.x-g.start.x,g.at.y-g.start.y)<2)s=createPreview(s.scalars.kind as Tool,g.start,{x:g.start.x+120,y:g.start.y+(s.scalars.kind==='arrow'?0:80)});
      finishShape(s);
    }else if(['move','resize','endpoint'].includes(g.kind)&&g.preview.length){commit(g.kind==='move'?'Move':'Resize',g.preview.map(s=>({shapeId:s.id,values:Object.fromEntries(Object.entries(s.scalars).filter(([k,v])=>v!==g.shapes.find(x=>x.id===s.id)!.scalars[k]))})));announce(`${g.shapes.length===1?label(g.shapes[0]):`${g.shapes.length} objects`} ${g.kind==='move'?'moved':'resized'}`);}
    else if(g.kind==='erase')remove(g.ids);
    else if(g.kind==='marquee'){const b=pointBounds([g.start,g.at]),ids=new Set(g.ids);for(const s of scene.shapes){const q=bounds(s);if(contains(b,q)&&contains(b,{x:q.x+q.w,y:q.y+q.h}))ids.add(s.id);}choose(ids);}
    else if(g.kind==='height'){commit('Resize canvas',[{values:{height:heightPreview??g.height}}]);setHeightPreview(null);}
    draw([]);refresh(n=>n+1);
  };
  const onKey=(e:ReactKeyboardEvent)=>{
    // Native fields own editing/navigation keys, while app-global shortcuts
    // (for example Cmd/Ctrl+K) still reach their document-level listeners.
    const blockKey=['Delete','Backspace','Escape','Enter','ArrowUp','ArrowDown'].includes(e.key)||((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d');
    if(blockKey)e.stopPropagation();
    if(composing.current||e.nativeEvent.isComposing||editableTarget(e.target))return;
    const command=e.metaKey||e.ctrlKey,key=e.key.toLowerCase();
    const handled=()=>{e.preventDefault();e.stopPropagation();};
    if(key==='escape'){
      handled();if(cancel())return;if(arrangeOpen){closeArrange();return;}if(objects){setObjects(false);return;}if(help){setHelp(false);return;}if(selected.size){choose([]);return;}
      setActive(false);const row=region.current?.closest<HTMLElement>('[data-block-row]');if(row){row.tabIndex=-1;row.focus();}else region.current?.blur();return;
    }
    if(e.target===region.current&&key==='enter'){handled();activate();if(objects&&scene.shapes.length)region.current?.querySelector<HTMLElement>(`[data-object-index="${Math.min(listFocus,scene.shapes.length-1)}"]`)?.focus();else viewport.current?.focus();return;}
    if(!active)return;
    if(command&&key==='a'){handled();choose(scene.shapes.map(s=>s.id));return;}
    if(command&&key==='z'){handled();undo(e.shiftKey);return;}
    if(e.ctrlKey&&key==='y'){handled();undo(true);return;}
    if(command&&key==='d'){handled();if(!readOnly)duplicate();return;}
    if(command&&(e.code==='BracketLeft'||e.code==='BracketRight')){handled();if(!readOnly)arrange(e.code==='BracketRight'?(e.shiftKey?'front':'forward'):(e.shiftKey?'back':'backward'));return;}
    if(command)return;
    if(key==='?'){handled();setObjects(false);setArrangeOpen(false);setHelp(v=>!v);return;}
    if(key==='+'||key==='='||key==='-'||key==='0'||key==='1'){handled();if(key==='0')fit();else zoom(key==='1'?1:camera.zoom*(key==='-'?1/1.2:1.2));return;}
    const nextTool=tools.find(t=>t[2].toLowerCase()===key);
    if(nextTool){if(!readOnly||nextTool[0]==='pan'){handled();cancel();setTool(nextTool[0]);setToolbarFocus(nextTool[0]);}return;}
    if((key==='delete'||key==='backspace')&&!readOnly){handled();remove(selected);return;}
    // Native toolbar/property buttons retain Enter and Space activation.
    if(e.target!==viewport.current&&e.target!==region.current)return;
    if(key===' '&&!keyboardPath){handled();if(spaceTool.current===null){spaceTool.current=tool;setTool('pan');}return;}
    if(key.startsWith('arrow')){
      handled();const axis=key==='arrowleft'||key==='arrowright'?'x':'y',sign=key==='arrowleft'||key==='arrowup'?-1:1;
      if(keyboardPath&&crosshair){setCrosshair({...crosshair,[axis]:crosshair[axis]+sign*(e.shiftKey?10:1)});return;}
      if(tool==='pan'){setCamera({...camera,[axis]:camera[axis]+sign*(e.shiftKey?160:40)});return;}
      if(!readOnly&&chosen.length){const step=sign*(e.shiftKey?10:1);commit('Move',chosen.map(s=>({shapeId:s.id,values:{[axis]:number(s,axis)+step}})));const first=chosen[0];announce(chosen.length===1?`${label(first)} moved to ${number(first,'x')+(axis==='x'?step:0)}, ${number(first,'y')+(axis==='y'?step:0)}`:`${chosen.length} objects moved`,true);}return;
    }
    if(readOnly)return;
    if(key===' '&&keyboardPath&&crosshair){handled();setKeyboardPath({...keyboardPath,points:[...keyboardPath.points,crosshair.x-number(keyboardPath,'x'),crosshair.y-number(keyboardPath,'y')]});return;}
    if(key==='enter'){
      handled();const p=center();
      if(keyboardPath){finishShape(keyboardPath);setKeyboardPath(null);setCrosshair(null);}
      else if(tool==='stroke'){setCrosshair(p);setKeyboardPath(makePreview('stroke',{x:p.x,y:p.y,w:1,h:1,basisW:1,basisH:1,stroke,strokeWidth},[0,0]));}
      else if(['rect','ellipse','arrow'].includes(tool))finishShape(createPreview(tool,{x:p.x-60,y:p.y-(tool==='arrow'?0:40)},{x:p.x+60,y:p.y+(tool==='arrow'?0:40)}));
      else if(tool==='text')startText({x:p.x-100,y:p.y-50});
      else if(tool==='select'&&chosen.length===1&&chosen[0].scalars.kind==='text')startText(p,chosen[0]);
      else if(tool==='erase'){setObjects(true);setTimeout(()=>region.current?.querySelector<HTMLElement>('[role="listbox"] [tabindex="0"]')?.focus(),0);}
    }
  };
  const setGeometry=(key:keyof Bounds,value:number)=>{
    if(!selectionBounds||!Number.isFinite(value))return;
    const target={...selectionBounds,[key]:key==='w'||key==='h'?Math.max(0,value):value};
    if(aspect&&selectionBounds.w&&selectionBounds.h){if(key==='w')target.h=target.w*selectionBounds.h/selectionBounds.w;if(key==='h')target.w=target.h*selectionBounds.w/selectionBounds.h;}
    commit(key==='x'||key==='y'?'Move':'Resize',chosen.map(s=>({shapeId:s.id,values:resized(s,selectionBounds,target)})));
  };
  const style=(key:string,value:string|number)=>{if(chosen.length&&tool==='select')commit('Style',chosen.map(s=>({shapeId:s.id,values:{[key]:value}})));else if(key==='stroke')setStroke(String(value));else if(key==='fill')setFill(String(value));else if(key==='strokeWidth')setStrokeWidth(Number(value));};
  const visibleShapes=gesture.current?.preview.length?gesture.current.preview:chosen;
  const outline=visibleShapes.length&&gesture.current?.kind!=='create'?union(visibleShapes):selectionBounds;
  const boxStyle=(b:Bounds)=>({left:0,top:0,transform:`translate(${b.x*camera.zoom+camera.x}px, ${b.y*camera.zoom+camera.y}px)`,width:b.w*camera.zoom,height:b.h*camera.zoom});
  const g=gesture.current;
  const visibleTools=readOnly?tools.filter(t=>t[0]==='pan'):tools;
  const canUndo=editor.undo.availability?.undo,canRedo=editor.undo.availability?.redo;
  const properties=chosen.length&&tool==='select'?chosen[0].scalars:{stroke,fill,strokeWidth};
  return <div ref={region} className="ob-canvas" role="region" aria-label={`Canvas, ${scene.shapes.length} objects, ${readOnly?'view only':'editable'}`} tabIndex={0}
    onFocus={activate} onKeyDown={onKey} onKeyUp={e=>{if(e.key===' '&&spaceTool.current){setTool(spaceTool.current);spaceTool.current=null;e.preventDefault();e.stopPropagation();}}}
    onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}
    onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setActive(false);setObjects(false);setHelp(false);setArrangeOpen(false);focusedObject.current=null;if(spaceTool.current){setTool(spaceTool.current);spaceTool.current=null;}if(textEdit)finishText(false);else cancel();}}}>
    <div className="ob-canvas-header">
      <div role="toolbar" aria-label="Canvas tools" className="ob-canvas-tools" onKeyDown={e=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();
        const index=visibleTools.findIndex(t=>t[0]===toolbarFocus),next=e.key==='Home'?0:e.key==='End'?visibleTools.length-1:(index+(e.key==='ArrowLeft'?-1:1)+visibleTools.length)%visibleTools.length;
        setToolbarFocus(visibleTools[next][0]);e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([aria-hidden=true])')[next]?.focus();
      }}>
        {(keepEditingChrome?tools:visibleTools).map(([value,name,shortcut])=><button key={value} type="button" aria-label={`${name} (${shortcut})`} title={`${name} (${shortcut})`} disabled={readOnly&&value!=='pan'} aria-hidden={readOnly&&value!=='pan'} style={{visibility:readOnly&&value!=='pan'?'hidden':'visible'}} aria-pressed={tool===value} tabIndex={active&&toolbarFocus===value?0:-1} onClick={()=>{activate();cancel();setTool(value);setToolbarFocus(value);viewport.current?.focus();}}>{(() => {const Icon=toolIcons[value];return <Icon size={18} aria-hidden="true"/>;})()}</button>)}
      </div>
      <span className="ob-canvas-title">Canvas</span><span className="ob-canvas-status">{readOnly?'View only':''}</span>
      {keepEditingChrome&&<div className="ob-canvas-history" aria-hidden={readOnly} style={{visibility:readOnly?'hidden':'visible'}}><button type="button" tabIndex={tab} aria-label={canUndo?`Undo ${canUndo.toLowerCase()}`:'Undo'} title={canUndo?`Undo ${canUndo.toLowerCase()}`:'Undo'} disabled={readOnly||!canUndo} onClick={()=>undo()}><Undo2 size={16} aria-hidden="true"/></button><button type="button" tabIndex={tab} aria-label={canRedo?`Redo ${canRedo.toLowerCase()}`:'Redo'} title={canRedo?`Redo ${canRedo.toLowerCase()}`:'Redo'} disabled={readOnly||!canRedo} onClick={()=>undo(true)}><Redo2 size={16} aria-hidden="true"/></button></div>}
      <div className="ob-canvas-popup-anchor"><button type="button" tabIndex={tab} aria-label="Help (?)" aria-expanded={help} onClick={()=>{setObjects(false);setArrangeOpen(false);setHelp(v=>!v);}}><HelpCircle size={16} aria-hidden="true"/></button>      {help&&<div className="ob-canvas-help" role="dialog" aria-label="Canvas help" onPointerDown={e=>e.stopPropagation()}>
        <strong>Canvas shortcuts</strong><p>Pen draws. Fingers move the view.</p>
        <p>{readOnly?'H Pan.':'V Select · P Pen · R Rectangle · O Ellipse · A Arrow · T Text · E Erase · H Pan.'} +/− Zoom · 0 Fit · 1 Actual size · ? Help.</p>
        {!readOnly&&<><p>Pen: Enter starts a path, arrows move 1 unit (Shift 10), Space places a point, Enter finishes. Shapes: Enter inserts at the center. Text: Cmd/Ctrl+Enter finishes.</p><p>Selection: arrows move 1 unit (Shift 10). Cmd/Ctrl+A selects all; D duplicates; [ / ] reorders (Shift sends to back/front); Z undoes; Shift+Z redoes; Ctrl+Y redoes. Delete erases.</p></>}
        <p>Pan: arrows move 40 pixels (Shift 160). Space temporarily selects Pan. Escape cancels, then clears selection, then leaves the canvas. Tab leaves naturally.</p>
        <button type="button" tabIndex={tab} onClick={()=>{setHelp(false);viewport.current?.focus();}}>Close help</button>
      </div>}</div>
    </div>
    <div ref={viewport} className="ob-canvas-viewport" tabIndex={tab} aria-label="Drawing viewport" style={{height,background:String(get(props,'background')??'#ffffff'),cursor:tool==='pan'?'grab':tool==='select'?'default':'crosshair'}}
      onPointerDown={e=>startGesture(e)} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={e=>{if(gesture.current?.pointer===e.pointerId||e.pointerType==='pen')cancel();else {touches.current.delete(e.pointerId);ignoredTouches.current.delete(e.pointerId);touchPair.current=null;}}}
      onLostPointerCapture={e=>{if(gesture.current?.pointer===e.pointerId)cancel();}}
      onDoubleClick={e=>{if(readOnly)return;const p=world(pointerPosition(e),camera),s=[...scene.shapes].reverse().find(s=>hit(s,p,camera.zoom));if(s?.scalars.kind==='text')startText(p,s);}}
      onWheel={e=>{if(!active)return;e.preventDefault();e.stopPropagation();if(e.ctrlKey||e.metaKey)zoom(camera.zoom*Math.exp(-e.deltaY*.01),pointerPosition(e));else setCamera({...camera,x:camera.x-e.deltaX,y:camera.y-e.deltaY});}}>
      <canvas ref={canvas} aria-hidden="true" style={{width:'100%',height:'100%'}} />
      {!scene.shapes.length&&!g&&!keyboardPath&&!textEdit&&<div className="ob-canvas-empty"><strong>{readOnly?'Empty canvas · View only':'Draw here, or choose a shape'}</strong>{!readOnly&&<span>Pen P · Select V</span>}</div>}
      {outline&&<div className="ob-canvas-outline" style={boxStyle(outline)} aria-hidden="true" />}
      {outline&&!readOnly&&tool==='select'&&chosen.length>0&&(chosen.length===1&&chosen[0].scalars.kind==='arrow'?['start','end']:Math.hypot(outline.w,outline.h)*camera.zoom<28?['nw']:outline.w*camera.zoom<56||outline.h*camera.zoom<56?['nw','se']:['nw','n','ne','e','se','s','sw','w']).map(handle=>{
        const endpoint=handle==='start'||handle==='end',p=endpoint?screen(endpoints(visibleShapes[0]??chosen[0])[handle==='start'?0:1],camera):screen({x:outline.x+(handle.includes('w')?0:handle.includes('e')?outline.w:outline.w/2),y:outline.y+(handle.includes('n')?0:handle.includes('s')?outline.h:outline.h/2)},camera);
        // Numeric properties are the keyboard equivalent; handles aren't extra Tab stops.
        return <span key={handle} className="ob-canvas-handle" aria-hidden="true" style={{left:0,top:0,transform:`translate(${p.x-14}px, ${p.y-14}px)`}} onPointerDown={e=>startGesture(e,endpoint?'endpoint':'resize',handle)}><i /></span>;
      })}
      {g?.kind==='marquee'&&<div className="ob-canvas-outline" style={boxStyle(pointBounds([g.start,g.at]))} aria-hidden="true"/>}
      {g?.kind==='erase'&&scene.shapes.filter(s=>g.ids.has(s.id)).map(s=><div key={s.id} className="ob-canvas-outline ob-canvas-erase" style={boxStyle(bounds(s))} aria-hidden="true"/>)}
      {crosshair&&<span className="ob-canvas-crosshair" style={{left:screen(crosshair,camera).x,top:screen(crosshair,camera).y}} aria-hidden="true">+</span>}
      {textEdit&&<textarea ref={textInput} aria-label="Canvas text" className="ob-canvas-text" style={{...boxStyle(textEdit),fontSize:(chosen[0]?.scalars.kind==='text'?number(chosen[0],'fontSize'):16)*camera.zoom}} value={textEdit.text}
        onPointerDown={e=>e.stopPropagation()} onChange={e=>setTextEdit({...textEdit,text:e.target.value})} onKeyDown={e=>{if(composing.current||e.nativeEvent.isComposing)return;if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.stopPropagation();e.preventDefault();finishText();}if(e.key==='Escape'){e.stopPropagation();e.preventDefault();cancel();viewport.current?.focus();}}}/>}

    </div>
    {active&&<ReservedProperties key={localChromeEpoch} reserve={remoteChrome.current||readOnly} visible={!readOnly&&(tool!=='select'||chosen.length>0)&&tool!=='pan'&&tool!=='erase'}>

      {!readOnly&&<>
        {(['stroke','rect','ellipse','arrow','text'].includes(tool)||tool==='select'&&chosen.length>0)&&<>
          <ColorControl name="Stroke" tab={tab} value={String(properties.stroke)} onChange={value=>style('stroke',value)}/>
          <label>Stroke width<select tabIndex={tab} aria-label="Stroke width" value={Number(properties.strokeWidth)} onChange={e=>style('strokeWidth',Number(e.target.value))}>{[1,2,3,5,8].map(n=><option key={n}>{n}</option>)}</select></label>
          {(tool==='rect'||tool==='ellipse'||tool==='select')&&<ColorControl name="Fill" tab={tab} fill value={String(properties.fill)} onChange={value=>style('fill',value)}/>}
        </>}
        {tool==='stroke'&&<label><input type="checkbox" tabIndex={tab} checked={pressure} onChange={e=>setPressure(e.target.checked)}/>Pressure width</label>}
        {selectionBounds&&tool==='select'&&<>
          {(['x','y','w','h'] as const).map((key,i)=><label key={key}>{['X','Y','Width','Height'][i]}<CoordinateField tabIndex={tab} aria-label={['X','Y','Width','Height'][i]} type="number" step="any" value={selectionBounds[key]} onChange={value=>setGeometry(key,value)}/></label>)}
          <label><input type="checkbox" tabIndex={tab} checked={aspect} onChange={e=>setAspect(e.target.checked)}/>Keep aspect ratio</label>
          {chosen.length===1&&chosen[0].scalars.kind==='arrow'&&(['start','end'] as const).flatMap((endpoint,i)=>(['x','y'] as const).map(axis=><label key={`${endpoint}${axis}`}>{endpoint==='start'?'Start':'End'} {axis.toUpperCase()}<CoordinateField tabIndex={tab} aria-label={`${endpoint==='start'?'Start':'End'} ${axis.toUpperCase()}`} type="number" step="any" value={endpoints(chosen[0])[i][axis]} onChange={value=>{const pair=endpoints(chosen[0]);pair[i]={...pair[i],[axis]:value};commit('Resize arrow',[{shapeId:chosen[0].id,values:arrowValues(...pair)}]);}}/></label>))}
          {chosen.length===1&&<label>Name<input tabIndex={tab} aria-label="Object name" value={String(chosen[0].scalars.name)} onChange={e=>commit('Rename',[{shapeId:chosen[0].id,values:{name:e.target.value}}])}/></label>}
          {chosen.length===1&&chosen[0].scalars.kind==='text'&&<><label>Text size<input type="number" min="1" tabIndex={tab} value={number(chosen[0],'fontSize')} onChange={e=>{if(Number.isFinite(Number(e.target.value))&&Number(e.target.value)>0)commit('Style',[{shapeId:chosen[0].id,values:{fontSize:Number(e.target.value)}}]);}}/></label><button type="button" tabIndex={tab} onClick={()=>startText(center(),chosen[0])}>Edit text</button></>}
          <button type="button" tabIndex={tab} onClick={duplicate}>Duplicate</button>
          <button type="button" tabIndex={tab} onClick={()=>remove(selected)}>Delete selected</button>
        </>}
      </>}
    </ReservedProperties>}
    {active&&<div className="ob-canvas-footer">
      {keepEditingChrome&&<div style={{visibility:readOnly?'hidden':'visible'}} aria-hidden={readOnly}>
        <div className="ob-canvas-popup-anchor"><button ref={arrangeTrigger} disabled={readOnly} type="button" tabIndex={tab} aria-disabled={readOnly||!chosen.length} aria-haspopup="menu" aria-expanded={arrangeOpen} onClick={()=>{if(readOnly||!chosen.length)return;setObjects(false);setHelp(false);setArrangeOpen(v=>!v);}}>Arrange</button>
          {arrangeOpen&&<div className="ob-canvas-arrange" role="menu" aria-label="Arrange" onKeyDown={e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const items=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')],index=items.indexOf(document.activeElement as HTMLButtonElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();}}>
            {(['back','backward','forward','front'] as const).map(direction=><button key={direction} role="menuitem" type="button" tabIndex={tab} onClick={()=>{arrange(direction);setArrangeOpen(false);viewport.current?.focus();}}>{({back:'Send to back',backward:'Send backward',forward:'Bring forward',front:'Bring to front'})[direction]}</button>)}
          </div>}
        </div>
      </div>}
      <div className="ob-canvas-popup-anchor"><button type="button" tabIndex={tab} aria-expanded={objects} onClick={()=>{setHelp(false);setArrangeOpen(false);setObjects(v=>!v);}}>Objects</button>      {objects&&<div className="ob-canvas-objects" onPointerDown={e=>e.stopPropagation()}>
        <div role="listbox" aria-label="Objects" aria-multiselectable="true">
          {scene.shapes.length?scene.shapes.map((s,i)=><div key={s.id} role="option" data-object-index={i} aria-selected={selected.has(s.id)} tabIndex={active&&i===listFocus?0:-1} onFocus={()=>{setListFocus(i);focusedObject.current=s.id;}} onClick={e=>{const ids=new Set(e.shiftKey?selected:[]);if(e.shiftKey&&ids.has(s.id))ids.delete(s.id);else ids.add(s.id);choose(ids);}}
            onKeyDown={e=>{
              if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const next=Math.max(0,Math.min(scene.shapes.length-1,e.key==='Home'?0:e.key==='End'?scene.shapes.length-1:i+(e.key==='ArrowUp'?-1:1)));setListFocus(next);choose(e.shiftKey?[...selected,scene.shapes[next].id]:[scene.shapes[next].id]);region.current?.querySelector<HTMLElement>(`[data-object-index="${next}"]`)?.focus();}
              else if(e.key===' '){e.preventDefault();e.stopPropagation();const ids=new Set(selected);if(ids.has(s.id))ids.delete(s.id);else ids.add(s.id);choose(ids);}
              else if(e.key==='Enter'&&s.scalars.kind==='text'&&!readOnly){e.preventDefault();e.stopPropagation();startText(center(),s);}
            }}>{label(s,i)}</div>):<span>No objects</span>}
        </div>
        <button type="button" tabIndex={tab} disabled={!selected.size} onClick={reveal}>Reveal selection</button>
        {!readOnly&&tool==='erase'&&<button type="button" tabIndex={tab} disabled={!selected.size} onClick={()=>remove(selected)}>Erase selected</button>}
      </div>}
      </div>

      <button type="button" tabIndex={tab} aria-label="Zoom out" onClick={()=>zoom(camera.zoom/1.2)}>−</button>
      <label>Zoom<input type="number" aria-label="Zoom percentage" tabIndex={tab} min="10" max="400" value={Math.round(camera.zoom*100)} onChange={e=>{if(e.target.value!=='')zoom(Number(e.target.value)/100);}}/></label>
      <button type="button" tabIndex={tab} aria-label="Zoom in" onClick={()=>zoom(camera.zoom*1.2)}>+</button><button type="button" tabIndex={tab} onClick={fit}>Fit</button><button type="button" tabIndex={tab} onClick={()=>zoom(1)}>Actual size</button>
      {keepEditingChrome&&<label aria-hidden={readOnly} style={{visibility:readOnly?'hidden':'visible'}}>Canvas height<input disabled={readOnly} type="number" tabIndex={tab} min="240" max="960" value={height} onChange={e=>{if(e.target.value!==''&&Number.isFinite(Number(e.target.value)))commit('Resize canvas',[{values:{height:Number(e.target.value)}}]);}}/></label>}
    </div>}
    {active&&keepEditingChrome&&<div className="ob-canvas-height-slot"><div aria-hidden={readOnly} style={{visibility:readOnly?'hidden':'visible'}} className="ob-canvas-height" role="separator" aria-label="Resize canvas height" aria-orientation="horizontal" aria-valuemin={240} aria-valuemax={960} aria-valuenow={height} tabIndex={tab}
      onPointerDown={e=>startGesture(e,'height')} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={()=>cancel()} onLostPointerCapture={e=>{if(gesture.current?.pointer===e.pointerId)cancel();}}
      onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();commit('Resize canvas',[{values:{height:height+(e.key==='ArrowUp'?-16:16)}}]);}}}/>
    </div>}
    <span className="ob-canvas-live" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    {!!scene.diagnostics.length&&<span className="ob-canvas-diagnostic" role="status">Canvas requires recovery</span>}
  </div>;
}
