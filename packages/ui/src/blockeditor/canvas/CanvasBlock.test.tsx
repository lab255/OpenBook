import {decimationDiagnostics} from './decimation';
import {Awareness,applyAwarenessUpdate,encodeAwarenessUpdate} from 'y-protocols/awareness';
import {registerOpenAwareness} from '../../lib/openAwareness';
import {registerBlockEditorDoc} from '../../lib/aiBridge';
import {canvasFacet} from './presence';
import {registerRemoteFrameBatching,remoteFrameQueue} from '../remoteFrame';
import {BlockEditor} from '../BlockEditor';
import {registerCustomBlock} from '../registry';
import {keyBetween} from '@book.dev/sdk';
import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, expect, test, vi} from 'vitest';
import * as Y from 'yjs';
import {createDoc, findBlock, registerPropsConstructor, rootBlocks} from '../model';
import {registerHistoryExtension} from '../historyExtension';
import {useBlockEditor, type BlockEditorController} from '../useBlockEditor';
import {CanvasBlock} from './CanvasBlock';
import {CanvasHistory} from './history';
import {insertShapes} from './commands';
import {canvasDefaults, constructCanvasProps, shapeDefaults, readCanvas} from './schema';
import {bounds, endpoints} from './geometry';

const context={drawImage:vi.fn(),setTransform:vi.fn(),clearRect:vi.fn(),translate:vi.fn(),scale:vi.fn(),save:vi.fn(),restore:vi.fn(),setLineDash:vi.fn(),beginPath:vi.fn(),arc:vi.fn(),ellipse:vi.fn(),rect:vi.fn(),clip:vi.fn(),fill:vi.fn(),stroke:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),bezierCurveTo:vi.fn(),fillText:vi.fn(),measureText:(s:string)=>({width:s.length*8})};
let controller:BlockEditorController;
let unregister:()=>void;
let presenceCleanup:(()=>void)[]=[];
beforeEach(()=>{
  unregister=registerHistoryExtension((doc,canWrite)=>new CanvasHistory(doc,canWrite));registerPropsConstructor('canvas',constructCanvasProps);
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const captures=new WeakMap<HTMLElement,Set<number>>();
  HTMLElement.prototype.setPointerCapture=vi.fn(function(this:HTMLElement,id:number){const ids=captures.get(this)??new Set<number>();ids.add(id);captures.set(this,ids);});
  HTMLElement.prototype.hasPointerCapture=vi.fn(function(this:HTMLElement,id:number){return captures.get(this)?.has(id)??false;});
  HTMLElement.prototype.releasePointerCapture=vi.fn(function(this:HTMLElement,id:number){captures.get(this)?.delete(id);});
});
afterEach(()=>{cleanup();unregister();for(const close of presenceCleanup)close();presenceCleanup=[];vi.restoreAllMocks();vi.useRealTimers();});
function setup(readOnly=false,quarantined=false,withPresence=false) {
  const doc=createDoc([{id:'canvas',type:'canvas',props:{...canvasDefaults,canvasVersion:quarantined?2:1,shapes:{}}}]);
  const awareness=withPresence?new Awareness(doc):undefined;
  if(awareness){presenceCleanup.push(registerBlockEditorDoc('test-canvas',doc),registerOpenAwareness('test-canvas',awareness),()=>awareness.destroy());}
  function App({viewOnly=false}:{viewOnly?:boolean}){controller=useBlockEditor(doc);return <><button>Before canvas</button><div data-block-row="canvas"><CanvasBlock block={rootBlocks(doc).get(0)} editor={controller} pageReadOnly={viewOnly}/></div><button>After canvas</button></>;}
  const view=render(<App viewOnly={readOnly}/>);
  const viewport=screen.getByLabelText('Drawing viewport');
  act(()=>screen.getByRole('region').focus());fireEvent.keyDown(screen.getByRole('region'),{key:'Enter'});
  const key=(key:string,more:Record<string,unknown>={})=>fireEvent.keyDown(viewport,{key,code:key==='['||key==='{'?'BracketLeft':key===']'||key==='}'?'BracketRight':undefined,...more});
  const tool=(shortcut:string)=>key(shortcut);
  const shapes=()=>readCanvas(findBlock(doc,'canvas')!.block.get('props')).shapes;
  const seed=(kind='rect',x=100)=>{let ids:string[]=[];act(()=>{ids=insertShapes(controller.history!() as CanvasHistory,'canvas',[{kind,ord:keyBetween(shapes()[shapes().length-1]?.scalars.ord as string??null,null),x,y:80,w:120,h:80,...(kind==='arrow'?{h:1,startX:0,startY:0,endX:1,endY:0}:{})}],'Seed');});return ids[0];};
  const select=()=>{tool('v');pointer(viewport,'down',130,100);pointer(viewport,'up',130,100);};
  const field=(name:string,value:string)=>{const el=screen.getByLabelText(name);act(()=>el.focus());fireEvent.change(el,{target:{value}});};
  return {doc,awareness,view,viewport,key,tool,shapes,seed,select,field,rerender:(readOnly:boolean)=>view.rerender(<App viewOnly={readOnly}/>)};
}
function pointer(el:Element,phase:'down'|'move'|'up',x:number,y:number,more:Record<string,unknown>={}) {
  fireEvent[phase==='down'?'pointerDown':phase==='move'?'pointerMove':'pointerUp'](el,{pointerId:1,pointerType:'mouse',button:0,buttons:phase==='up'?0:1,clientX:x,clientY:y,...more});
}
function equivalentScene(a:ReturnType<typeof setup>) {
  const fresh=new Y.Doc();Y.applyUpdate(fresh,Y.encodeStateAsUpdate(a.doc));expect(readCanvas(findBlock(fresh,'canvas')!.block.get('props')).shapes).toEqual(a.shapes());
  return a.shapes().map(s=>({kind:s.scalars.kind,bounds:bounds(s),points:s.points,text:s.scalars.text,stroke:s.scalars.stroke,fill:s.scalars.fill}));
}

// Enumeration is the acceptance inventory, including each pointer-only-looking handle.
const parity=['stroke creation','rectangle creation','ellipse creation','arrow creation','text creation','single selection','multi selection','move','bounds resize','arrow endpoints','style','erase','duplicate','order','pan','zoom','height resize','undo','redo'] as const;
test.each(parity)('keyboard parity enumeration: %s',action=>{
  const run=(keyboard:boolean)=>{
    const a=setup();let result:unknown;
    if(action.endsWith('creation')){
      const kind=action.split(' ')[0],shortcut=({stroke:'p',rectangle:'r',ellipse:'o',arrow:'a',text:'t'})[kind]!;
      a.tool(shortcut);
      if(keyboard)a.key('Enter');else {const x=kind==='text'?220:kind==='stroke'?320:260,y=kind==='text'?130:kind==='arrow'||kind==='stroke'?180:140;pointer(a.viewport,'down',x,y);if(kind!=='text'&&kind!=='stroke')pointer(a.viewport,'up',x,y);}
      if(kind==='stroke'){if(keyboard){a.key('ArrowRight',{shiftKey:true});a.key('ArrowDown',{shiftKey:true});a.key(' ');a.key('Enter');}else {pointer(a.viewport,'move',330,190);pointer(a.viewport,'up',330,190);}}
      if(kind==='text'){a.field('Canvas text','Hello\nWorld');fireEvent.keyDown(screen.getByLabelText('Canvas text'),{key:'Enter',ctrlKey:true});}
      expect(a.shapes()).toHaveLength(1);result=equivalentScene(a);
    }else{
      a.seed(action==='arrow endpoints'?'arrow':'rect');if(action==='multi selection'||action==='order')a.seed('ellipse',300);
      if(action==='single selection'||action==='multi selection'){
        a.tool('v');
        if(keyboard){fireEvent.click(screen.getByRole('button',{name:'Objects'}));const options=within(screen.getByRole('listbox')).getAllByRole('option');act(()=>options[0].focus());fireEvent.keyDown(options[0],{key:' '});if(action==='multi selection')fireEvent.keyDown(options[0],{key:'ArrowDown',shiftKey:true});}
        else {pointer(a.viewport,'down',130,100);pointer(a.viewport,'up',130,100);if(action==='multi selection'){pointer(a.viewport,'down',330,100,{shiftKey:true});pointer(a.viewport,'up',330,100,{shiftKey:true});}}
        fireEvent.click(screen.getByRole('button',{name:'Objects'})); // visibility may toggle; selection remains in outline/status.
        result=screen.getByRole('status').textContent;expect(result).toBe(`${action==='multi selection'?2:1} object${action==='multi selection'?'s':''} selected`);
      }else if(action==='pan'){
        a.tool('h');if(keyboard)a.key('ArrowRight');else {pointer(a.viewport,'down',0,0);pointer(a.viewport,'move',40,0);pointer(a.viewport,'up',40,0);}result=context.translate.mock.calls[context.translate.mock.calls.length-1];expect(result).toEqual([40,0]);
      }else if(action==='zoom'){if(keyboard)a.key('+');else fireEvent.click(screen.getByRole('button',{name:'Zoom in'}));result=(screen.getByLabelText('Zoom percentage') as HTMLInputElement).value;expect(result).toBe('120');}
      else if(action==='height resize'){
        const separator=screen.getByRole('separator');if(keyboard)fireEvent.keyDown(separator,{key:'ArrowDown'});else {pointer(separator,'down',0,360);pointer(separator,'move',0,376);pointer(separator,'up',0,376);}result=(findBlock(a.doc,'canvas')!.block.get('props') as Y.Map<unknown>).get('height');expect(result).toBe(376);
      }else{
        if(action==='arrow endpoints'){a.tool('v');pointer(a.viewport,'down',150,80);pointer(a.viewport,'up',150,80);}else a.select();
        if(action==='move'){if(keyboard){a.key('ArrowRight',{shiftKey:true});a.key('ArrowDown',{shiftKey:true});}else{pointer(a.viewport,'down',130,100);pointer(a.viewport,'move',140,110);pointer(a.viewport,'up',140,110);}expect(bounds(a.shapes()[0])).toMatchObject({x:110,y:90});}
        if(action==='bounds resize'){if(keyboard){a.field('Width','130');a.field('Height','90');}else{const handles=a.view.container.querySelectorAll('.ob-canvas-handle');pointer(handles[4],'down',220,160);pointer(a.viewport,'move',230,170);pointer(a.viewport,'up',230,170);}expect(bounds(a.shapes()[0])).toMatchObject({w:130,h:90});}
        if(action==='arrow endpoints'){if(keyboard){a.field('End X','240');a.field('End Y','90');}else{const handles=a.view.container.querySelectorAll('.ob-canvas-handle');pointer(handles[1],'down',220,80);pointer(a.viewport,'move',240,90);pointer(a.viewport,'up',240,90);}expect(endpoints(a.shapes()[0])[1]).toEqual({x:240,y:90});}
        if(action==='style'){if(!keyboard)fireEvent.click(screen.getByLabelText('Stroke color value'));a.field('Stroke color value','#b91c1c');expect(a.shapes()[0].scalars.stroke).toBe('#b91c1c');}
        if(action==='erase'){if(keyboard)a.key('Delete');else{a.tool('e');pointer(a.viewport,'down',130,100);expect(a.view.container.querySelector('.ob-canvas-erase')).not.toBeNull();pointer(a.viewport,'up',130,100);}expect(a.shapes()).toHaveLength(0);}
        if(action==='duplicate'){if(keyboard)a.key('d',{ctrlKey:true});else fireEvent.click(screen.getByRole('button',{name:'Duplicate'}));expect(a.shapes()).toHaveLength(2);expect(bounds(a.shapes()[1])).toMatchObject({x:110,y:90});}
        if(action==='order'){if(keyboard)a.key('}',{ctrlKey:true,shiftKey:true});else {fireEvent.click(screen.getByRole('button',{name:'Arrange'}));fireEvent.click(screen.getByRole('menuitem',{name:'Bring to front'}));}expect(a.shapes()[1].scalars.kind).toBe('rect');}
        if(action==='undo'||action==='redo'){
          a.key('ArrowRight');if(keyboard)a.key('z',{ctrlKey:true});else fireEvent.click(screen.getByRole('button',{name:'Undo move'}));
          if(action==='redo'){if(keyboard)a.key('z',{ctrlKey:true,shiftKey:true});else fireEvent.click(screen.getByRole('button',{name:'Redo move'}));}
          expect(bounds(a.shapes()[0]).x).toBe(action==='redo'?101:100);
        }
        result=equivalentScene(a);
      }
    }
    cleanup();return result;
  };
  const pointerResult=run(false),keyboardResult=run(true);expect(keyboardResult).toEqual(pointerResult);
});

test('text editing uses native field; composition and input focus suppress tool shortcuts (physical IME remains manual)',()=>{
  const a=setup();a.tool('t');a.key('Enter');const input=screen.getByLabelText('Canvas text');
  fireEvent.compositionStart(input);fireEvent.change(input,{target:{value:'日本語'}});expect((input as HTMLTextAreaElement).value).toBe('日本語');fireEvent.keyDown(input,{key:'r'});fireEvent.keyDown(input,{key:'Enter',ctrlKey:true});
  expect(screen.getByLabelText('Canvas text')).toBe(input);expect(a.shapes()).toHaveLength(0);
  fireEvent.compositionEnd(input);fireEvent.change(input,{target:{value:'日本語'}});fireEvent.keyDown(input,{key:'p'});
  expect(screen.getByRole('button',{name:'Text (T)'}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.keyDown(input,{key:'Enter',ctrlKey:true});expect(a.shapes()[0].scalars.text).toBe('日本語');
  a.field('Object name','Label');fireEvent.keyDown(screen.getByLabelText('Object name'),{key:'e'});expect(screen.getByRole('button',{name:'Select (V)'}).getAttribute('aria-pressed')).toBe('true');
});

test.each(['pointercancel','lostpointercapture','Escape'])('%s discards local ink without history or publication',event=>{
  const a=setup();const before=Y.encodeStateAsUpdate(a.doc);pointer(a.viewport,'down',10,10);pointer(a.viewport,'move',20,20);
  expect(context.stroke).toHaveBeenCalled();expect(a.shapes()).toHaveLength(0);
  if(event==='Escape')a.key('Escape');else fireEvent(a.viewport,new PointerEvent(event,{pointerId:1,bubbles:true}));
  expect(screen.getByRole('status').textContent).toBe('Stroke interrupted');expect(Y.encodeStateAsUpdate(a.doc)).toEqual(before);
  pointer(a.viewport,'down',100,100);pointer(a.viewport,'up',100,100);expect(a.shapes()[0].points).toEqual([0,0]);
});

test('pageReadOnly gates active gesture completion and hides edit tools while navigation remains operable',()=>{
  const a=setup();pointer(a.viewport,'down',10,10);a.rerender(true);pointer(a.viewport,'up',20,20);
  expect(a.shapes()).toHaveLength(0);expect(screen.queryByRole('button',{name:'Pen (P)'})).toBeNull();expect(screen.queryByRole('button',{name:/Undo/})).toBeNull();
  expect(screen.getAllByText('View only').length).toBeGreaterThan(0);a.key('r');a.key('Enter');expect(a.shapes()).toHaveLength(0);fireEvent.click(screen.getByRole('button',{name:'Zoom in'}));expect((screen.getByLabelText('Zoom percentage') as HTMLInputElement).value).toBe('120');
});

test('touch never inks, pen ignores touch and navigation requires a fresh contact after pen-up',()=>{
  const a=setup();pointer(a.viewport,'down',10,10,{pointerType:'touch'});pointer(a.viewport,'move',30,30,{pointerType:'touch'});pointer(a.viewport,'up',30,30,{pointerType:'touch'});expect(a.shapes()).toHaveLength(0);
  pointer(a.viewport,'down',50,50,{pointerType:'pen',pressure:.4});pointer(a.viewport,'down',100,100,{pointerType:'touch',pointerId:2});pointer(a.viewport,'move',150,150,{pointerType:'touch',pointerId:2});pointer(a.viewport,'up',50,50,{pointerType:'pen'});
  const previous=context.translate.mock.calls[context.translate.mock.calls.length-1];pointer(a.viewport,'move',200,200,{pointerType:'touch',pointerId:2});expect(context.translate.mock.calls[context.translate.mock.calls.length-1]).toEqual(previous);expect(a.shapes()).toHaveLength(1);
});

test('remote deletion moves focused Objects entry to nearest survivor, with fresh replica equivalence',()=>{
  const a=setup();const first=a.seed(),second=a.seed('ellipse',300);fireEvent.click(screen.getByRole('button',{name:'Objects'}));const options=within(screen.getByRole('listbox')).getAllByRole('option');act(()=>options[0].focus());fireEvent.keyDown(options[0],{key:' '});
  const remote=new Y.Doc();Y.applyUpdate(remote,Y.encodeStateAsUpdate(a.doc));const props=findBlock(remote,'canvas')!.block.get('props') as Y.Map<unknown>;(props.get('shapes') as Y.Map<unknown>).delete(first);
  act(()=>Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(remote)));expect(document.activeElement).toBe(within(screen.getByRole('listbox')).getByRole('option'));expect(a.shapes()[0].id).toBe(second);equivalentScene(a);
});

test('focus boundary, roving tools, Escape ladder and replayed Expand affordance',()=>{
  const a=setup();const toolbar=screen.getByRole('toolbar');const pen=screen.getByRole('button',{name:'Pen (P)'});act(()=>pen.focus());fireEvent.keyDown(pen,{key:'ArrowRight'});expect(document.activeElement).toBe(screen.getByRole('button',{name:'Rectangle (R)'}));
  expect(toolbar.querySelectorAll('[tabindex="0"]')).toHaveLength(1);a.seed();a.select();a.key('Escape');expect(screen.getByRole('status').textContent).toBe('0 objects selected');a.key('Escape');expect(document.activeElement?.getAttribute('data-block-row')).toBe('canvas');
  expect(screen.getByRole('button',{name:/Expand/})).toBeTruthy();expect(screen.queryByLabelText('Grid')).toBeNull();
  expect(screen.getByRole('button',{name:'After canvas'}).tabIndex).toBe(0);
});

test('parity detail: marquee and list range both select two; grouped resize and move use numeric/arrow controls',()=>{
  const a=setup();const rectangle=a.seed(),ellipse=a.seed('ellipse',300);a.tool('v');pointer(a.viewport,'down',50,50);pointer(a.viewport,'move',450,200);pointer(a.viewport,'up',450,200);
  expect(screen.getByRole('status').textContent).toBe('2 objects selected');a.field('Width','640');expect(a.shapes().map(s=>bounds(s).w)).toEqual([240,240]);
  act(()=>a.viewport.focus());a.key('ArrowRight');expect(Object.fromEntries(a.shapes().map(s=>[s.id,bounds(s).x]))).toEqual({[rectangle]:101,[ellipse]:501});
  a.key('z',{ctrlKey:true});a.key('z',{ctrlKey:true});expect(a.shapes().map(s=>bounds(s).w)).toEqual([120,120]);equivalentScene(a);
});

test.each([['back','{',true,'Send to back'],['backward','[',false,'Send backward'],['forward',']',false,'Bring forward'],['front','}',true,'Bring to front']])('parity detail: %s order control and shortcut',(_direction,key,shift,label)=>{
  const run=(keyboard:boolean)=>{const a=setup();a.seed();a.seed('ellipse',300);a.select();if(keyboard)a.key(String(key),{ctrlKey:true,shiftKey:shift});else {fireEvent.click(screen.getByRole('button',{name:'Arrange'}));fireEvent.click(screen.getByRole('menuitem',{name:String(label)}));}const result=a.shapes().map(s=>s.scalars.kind);cleanup();return result;};expect(run(true)).toEqual(run(false));
});

test('parity detail: existing text is editable through Objects Enter; box width never changes font size',()=>{
  const a=setup();a.seed('text');a.select();fireEvent.click(screen.getByRole('button',{name:'Objects'}));const option=within(screen.getByRole('listbox')).getByRole('option');fireEvent.keyDown(option,{key:'Enter'});a.field('Canvas text','Edited text');fireEvent.keyDown(screen.getByLabelText('Canvas text'),{key:'Enter',ctrlKey:true});
  a.field('Width','240');expect(a.shapes()[0].scalars.fontSize).toBe(16);a.field('Text size','24');expect(a.shapes()[0].scalars.fontSize).toBe(24);a.field('Fill color or none','#ffffff');a.field('Object name','Diagram note');expect(a.shapes()[0].scalars).toMatchObject({text:'Edited text',name:'Diagram note',fill:'#ffffff',w:240,fontSize:24});equivalentScene(a);
});

test('parity detail: aspect ratio, constrained rectangle, numeric zoom, fit, actual size, Reveal and Help',()=>{
  const a=setup();a.tool('r');pointer(a.viewport,'down',100,100);pointer(a.viewport,'move',160,140,{shiftKey:true});pointer(a.viewport,'up',160,140);expect(bounds(a.shapes()[0])).toMatchObject({w:60,h:60});
  fireEvent.click(screen.getByLabelText('Keep aspect ratio'));a.field('Width','120');expect(bounds(a.shapes()[0])).toMatchObject({w:120,h:120});a.field('Zoom percentage','200');expect((screen.getByLabelText('Zoom percentage') as HTMLInputElement).value).toBe('200');
  act(()=>a.viewport.focus());a.key('1');expect((screen.getByLabelText('Zoom percentage') as HTMLInputElement).value).toBe('100');a.key('0');expect(Number((screen.getByLabelText('Zoom percentage') as HTMLInputElement).value)).toBeGreaterThan(100);
  fireEvent.click(screen.getByRole('button',{name:'Objects'}));fireEvent.click(screen.getByRole('button',{name:'Reveal selection'}));expect(screen.getByRole('status').textContent).toBe('Selection revealed');a.key('?');expect(screen.getByRole('dialog',{name:'Canvas help'})).toBeTruthy();expect(screen.getByText(/F Expand\/return/)).toBeTruthy();a.key('Escape');expect(screen.queryByRole('dialog')).toBeNull();
});

test('real delivered pressure samples enable only subsequent strokes; coalesced points publish only on release',()=>{
  const a=setup();pointer(a.viewport,'down',10,10,{pointerType:'pen',pressure:.2});pointer(a.viewport,'move',20,20,{pointerType:'pen',pressure:.5});pointer(a.viewport,'move',30,30,{pointerType:'pen',pressure:.8});pointer(a.viewport,'up',30,30,{pointerType:'pen',pressure:0});expect(a.shapes()[0].pointArity).toBe(2);
  pointer(a.viewport,'down',50,50,{pointerType:'pen',pressure:.2});
  const event=new PointerEvent('pointermove',{bubbles:true,pointerId:1,pointerType:'pen',clientX:70,clientY:70,buttons:1,pressure:.8});
  Object.defineProperty(event,'getCoalescedEvents',{value:()=>[new PointerEvent('pointermove',{pointerId:1,pointerType:'pen',clientX:60,clientY:60,buttons:1,pressure:.5}),event]});fireEvent(a.viewport,event);
  expect(a.shapes()).toHaveLength(1);pointer(a.viewport,'up',70,70,{pointerType:'pen',pressure:0});expect(a.shapes()[1].pointArity).toBe(3);expect(a.shapes()[1].points).toEqual([0,0,51,20,20,204]);equivalentScene(a);
});

test.each(['start','mid','end'])('interruption at %s preserves remote geometry and clears local manipulation preview',phase=>{
  const a=setup();const id=a.seed();a.select();pointer(a.viewport,'down',130,100);if(phase!=='start')pointer(a.viewport,'move',phase==='mid'?150:200,100);
  const remote=new Y.Doc();Y.applyUpdate(remote,Y.encodeStateAsUpdate(a.doc));const remoteHistory=new CanvasHistory(remote);remoteHistory.commitCanvasCommand('Move',[{blockId:'canvas',shapeId:id,values:{x:250}}]);act(()=>Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(remote)));
  a.key('Escape');expect(bounds(a.shapes()[0]).x).toBe(250);expect(screen.getByRole('status').textContent).toBe('Move cancelled');equivalentScene(a);remoteHistory.destroy();
});


test.each(['capture loss','pointercancel','Escape','focus interruption','permission loss','tool shortcut','tool button','window blur','component unmount','remote deletion','pointerup'] as const)('%s tears down pen state: resting touch stays inert, fresh touch pans 40px',route=>{
  const eventWindow:Window=window;
  const add=vi.spyOn(eventWindow,'addEventListener'),remove=vi.spyOn(eventWindow,'removeEventListener');
  let a=setup();
  const removed=route==='remote deletion'?a.seed():null;if(removed)a.select();
  pointer(a.viewport,'down',removed?130:50,removed?100:50,{pointerType:'pen',pressure:.4});
  pointer(a.viewport,'down',100,100,{pointerType:'touch',pointerId:2});
  const before=context.translate.mock.calls[context.translate.mock.calls.length-1]!;
  if(route==='capture loss')fireEvent.lostPointerCapture(a.viewport,{pointerId:1,pointerType:'pen'});
  else if(route==='pointercancel')fireEvent.pointerCancel(a.viewport,{pointerId:1,pointerType:'pen'});
  else if(route==='Escape')a.key('Escape');
  else if(route==='focus interruption')act(()=>screen.getByRole('button',{name:'After canvas'}).focus());
  else if(route==='permission loss')a.rerender(true);
  else if(route==='tool shortcut')a.key('r');
  else if(route==='tool button')fireEvent.click(screen.getByRole('button',{name:'Rectangle (R)'}));
  else if(route==='window blur')fireEvent(window,new Event('blur'));
  else if(route==='component unmount'){
    const oldDoc=a.doc,oldViewport=a.viewport,bytes=Y.encodeStateAsUpdate(oldDoc),blurListeners=add.mock.calls.filter(([event])=>event==='blur').map(([,listener])=>listener);
    expect(blurListeners.length).toBeGreaterThan(0);expect(oldViewport.hasPointerCapture(1)).toBe(true);a.view.unmount();
    for(const listener of blurListeners)expect(remove).toHaveBeenCalledWith('blur',listener);
    expect(HTMLElement.prototype.releasePointerCapture).toHaveBeenCalledWith(1);expect(oldViewport.hasPointerCapture(1)).toBe(false);
    const paints=context.drawImage.mock.calls.length;fireEvent(window,new Event('blur'));expect(context.drawImage.mock.calls.length).toBe(paints);expect(Y.encodeStateAsUpdate(oldDoc)).toEqual(bytes);
    cleanup();a=setup();
  }
  else if(route==='remote deletion'){
    const peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(a.doc));const props=findBlock(peer,'canvas')!.block.get('props') as Y.Map<unknown>;(props.get('shapes') as Y.Map<unknown>).delete(removed!);act(()=>Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(peer)));
  } else pointer(a.viewport,'up',50,50,{pointerType:'pen',pressure:0});
  expect(a.shapes()).toHaveLength(route==='pointerup'?1:0);
  if(route!=='pointerup')expect(a.viewport.querySelector('.ob-canvas-empty')).not.toBeNull();
  if(!['component unmount','pointerup'].includes(route))expect(screen.getByRole('status').textContent).toBe(route==='permission loss'?'View only':route==='remote deletion'?'Selected object removed':'Stroke interrupted');
  pointer(a.viewport,'move',140,100,{pointerType:'touch',pointerId:2});
  expect(context.translate.mock.calls[context.translate.mock.calls.length-1]).toEqual(before);
  pointer(a.viewport,'up',140,100,{pointerType:'touch',pointerId:2});
  pointer(a.viewport,'down',100,100,{pointerType:'touch',pointerId:3});
  pointer(a.viewport,'move',140,100,{pointerType:'touch',pointerId:3});
  pointer(a.viewport,'up',140,100,{pointerType:'touch',pointerId:3});
  expect(context.translate.mock.calls[context.translate.mock.calls.length-1]).toEqual([before[0]+40,before[1]]);
  equivalentScene(a);
});


const nativeControls=['Canvas height','Zoom percentage','X','Y','Width','Height','Stroke color value','Fill color or none','Object name','Start X','Start Y','End X','End Y','Text size','Canvas text'];
test.each(nativeControls.flatMap(label=>['Delete','Backspace'].map(key=>({label,key}))))('full-page integration: $key stays inside $label while the block is selected',({label,key})=>{
  const unregisterBlock=registerCustomBlock({type:'canvas',render:props=>{controller=props.editor;return <CanvasBlock {...props}/>;}});
  try {
    const kind=label.startsWith('Start')||label.startsWith('End')?'arrow':label==='Text size'||label==='Canvas text'?'text':'rect';
    const doc=createDoc([{id:'canvas',type:'canvas',props:{...canvasDefaults,shapes:{s:{...shapeDefaults,id:'s',kind,x:100,y:80,w:120,h:80,text:'Native text',points:[],pointArity:2}}}}]);
    render(<BlockEditor doc={doc}/>);
    const region=screen.getByRole('region',{name:/Canvas, 1 objects/});act(()=>region.focus());fireEvent.keyDown(region,{key:'Enter'});
    const viewport=screen.getByLabelText('Drawing viewport');fireEvent.keyDown(viewport,{key:'v'});fireEvent.keyDown(viewport,{key:'a',ctrlKey:true});
    if(label==='Canvas text')fireEvent.keyDown(viewport,{key:'Enter'});
    act(()=>controller.setSelection(['canvas']));
    const field=screen.getByLabelText(label);act(()=>field.focus());
    expect(fireEvent.keyDown(field,{key})).toBe(true); // Native deletion is not preventDefaulted.
    expect(findBlock(doc,'canvas')).not.toBeNull();
    expect(readCanvas(findBlock(doc,'canvas')!.block.get('props')).shapes).toHaveLength(1);
  } finally {cleanup();unregisterBlock();}
});

test.each(['Delete','Backspace'])('full-page integration: page-level %s still removes the selected block outside canvas focus',key=>{
  const unregisterBlock=registerCustomBlock({type:'canvas',render:props=>{controller=props.editor;return <CanvasBlock {...props}/>;}});
  try {
    const doc=createDoc([{id:'canvas',type:'canvas',props:{...canvasDefaults,shapes:{}}}]);
    render(<><button>Page focus</button><BlockEditor doc={doc}/></>);
    act(()=>{controller.setSelection(['canvas']);screen.getByRole('button',{name:'Page focus'}).focus();});
    fireEvent.keyDown(screen.getByRole('button',{name:'Page focus'}),{key});
    expect(findBlock(doc,'canvas')).toBeNull();
  } finally {cleanup();unregisterBlock();}
});


test.each(['viewport','native input','text editor'])('app command palette shortcut bubbles from canvas %s while Delete remains owned',where=>{
  const a=setup();let target:HTMLElement=a.viewport;
  if(where==='native input')target=screen.getByLabelText('Canvas height');
  if(where==='text editor'){a.tool('t');a.key('Enter');target=screen.getByLabelText('Canvas text');}
  act(()=>target.focus());const palette=vi.fn((e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key==='k')e.preventDefault();});document.addEventListener('keydown',palette);
  try {fireEvent.keyDown(target,{key:'k',metaKey:true});expect(palette).toHaveBeenCalledTimes(1);fireEvent.keyDown(target,{key:'Delete'});expect(palette).toHaveBeenCalledTimes(1);}finally{document.removeEventListener('keydown',palette);}
});

test.each([['n',120,120],['s',120,80]] as const)('aspect-locked %s handle changes both dimensions and keeps opposite edge fixed', (handle,endY,expectedY)=>{
  const a=setup();a.seed();a.select();fireEvent.click(screen.getByLabelText('Keep aspect ratio'));
  const handles=a.viewport.querySelectorAll('.ob-canvas-handle'),el=handles[handle==='n'?1:5];
  pointer(el,'down',160,handle==='n'?80:160);pointer(a.viewport,'move',160,endY);pointer(a.viewport,'up',160,endY);
  const b=bounds(a.shapes()[0]);expect(b.h).toBe(40);expect(b.w).toBe(60);expect(b.y).toBe(expectedY);expect(b.x).toBe(130);
});

test('resize captures on stable viewport through handle removal below size threshold and releases outside',()=>{
  const a=setup();a.seed();a.select();const edge=a.viewport.querySelectorAll('.ob-canvas-handle')[3];
  const capture=vi.mocked(HTMLElement.prototype.setPointerCapture);capture.mockClear();pointer(edge,'down',220,120);
  expect(capture.mock.contexts[0]).toBe(a.viewport);pointer(a.viewport,'move',110,120);
  expect(edge.isConnected).toBe(false);pointer(a.viewport,'up',-50,120);expect(bounds(a.shapes()[0]).w).toBe(10);
  // The completed capture leaves no stranded gesture: the next creation works.
  a.tool('r');pointer(a.viewport,'down',300,200);pointer(a.viewport,'up',300,200);expect(a.shapes()).toHaveLength(2);
});

test.each(['forward','backward','front','back'] as const)('arrange %s writes only the selected ord in one journal action',direction=>{
  const a=setup();const ids=[a.seed('rect',100),a.seed('ellipse',300),a.seed('rect',500)];
  const selected=direction==='forward'||direction==='front'?ids[0]:ids[2];a.tool('v');
  const x=direction==='forward'||direction==='front'?130:530;pointer(a.viewport,'down',x,100);pointer(a.viewport,'up',x,100);
  const h=controller.history!() as CanvasHistory,commit=vi.spyOn(h,'commitCanvasCommand');
  fireEvent.click(screen.getByRole('button',{name:'Arrange'}));
  fireEvent.click(screen.getByRole('menuitem',{name:({forward:'Bring forward',backward:'Send backward',front:'Bring to front',back:'Send to back'})[direction]}));
  expect(commit).toHaveBeenCalledTimes(1);expect(commit.mock.calls[0][1]).toEqual([{blockId:'canvas',shapeId:selected,values:{ord:expect.any(String)}}]);
  let undo:ReturnType<CanvasHistory['undo']>|undefined;act(()=>{undo=h.undo();});expect(undo?.appliedKeys).toEqual([`canvas/${selected}/ord`]);equivalentScene(a);
});

test.each(['Canvas height','Zoom percentage','X','Y','Width','Height','Start X','Start Y','End X','End Y','Text size'])('non-finite 1e999 in %s is ignored without throwing or writing',label=>{
  const a=setup();a.seed(label==='Text size'?'text':'arrow');a.tool('v');a.key('a',{ctrlKey:true});const before=a.shapes();const props=findBlock(a.doc,'canvas')!.block.get('props') as Y.Map<unknown>,height=props.get('height');
  const input=screen.getByLabelText(label) as HTMLInputElement;const h=controller.history!() as CanvasHistory,commit=vi.spyOn(h,'commitCanvasCommand');
  // Use text type to keep the explicit overflow string observable to React;
  // browser number-input sanitization must not be the safety mechanism.
  input.type='text';expect(()=>fireEvent.change(input,{target:{value:'1e999'}})).not.toThrow();
  expect(commit).not.toHaveBeenCalled();expect(a.shapes()).toEqual(before);expect(props.get('height')).toBe(height);
});


test.each(['bc-remote','net'] as const)('%s continuous remote burst paints each frame without waiting for quiet',origin=>{
  const a=setup(),id=a.seed(),peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(a.doc));
  const shape=((findBlock(peer,'canvas')!.block.get('props') as Y.Map<unknown>).get('shapes') as Y.Map<Y.Map<unknown>>).get(id)!;
  const frames=new Map<number,FrameRequestCallback>();let counter=0;
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.set(++counter,callback);return counter;});vi.stubGlobal('cancelAnimationFrame',(frame:number)=>frames.delete(frame));
  const disable=registerRemoteFrameBatching(),queue=remoteFrameQueue(a.doc,origin);peer.on('update',update=>queue.receive(update));
  try {
    for(let frame=0;frame<30;frame++){
      shape.set('x',101+frame*5);const firstScheduled=[...frames.keys()][0];
      for(let sample=1;sample<5;sample++)shape.set('x',101+frame*5+sample);
      expect(frames.size).toBe(1);expect([...frames.keys()][0]).toBe(firstScheduled); // New input never moves the frame deadline.
      const before=context.drawImage.mock.calls.length;
      act(()=>{for(const callback of [...frames.values()])callback(frame*16);});
      expect(context.drawImage.mock.calls.length).toBeGreaterThan(before);
      expect(context.rect.mock.calls[context.rect.mock.calls.length-1][0]).toBe(105+frame*5);
      expect(a.shapes()[0].scalars.x).toBe(105+frame*5);
    }
    equivalentScene(a);expect(readCanvas(findBlock(peer,'canvas')!.block.get('props')).shapes).toEqual(a.shapes());
  } finally {queue.close();disable();vi.unstubAllGlobals();}
});

test('design: tools use named icons and hints; Undo and Redo stay in the header',()=>{
  const a=setup();
  for(const button of within(screen.getByRole('toolbar',{name:'Canvas tools'})).getAllByRole('button')){expect(button.querySelector('svg')).not.toBeNull();expect(button.textContent).toBe('');expect(button.title).toBe(button.getAttribute('aria-label'));}
  a.tool('r');a.key('Enter');const undo=screen.getByRole('button',{name:'Undo rectangle'});expect(undo.closest('.ob-canvas-header')).not.toBeNull();
  fireEvent.click(undo);expect(screen.getByRole('button',{name:'Redo rectangle'}).closest('.ob-canvas-header')).not.toBeNull();
});
test.each(['pointer','keyboard'])('design: %s finished pen leaves no selection and keeps Pen',input=>{
  const a=setup();if(input==='pointer'){pointer(a.viewport,'down',20,20);pointer(a.viewport,'move',40,40);pointer(a.viewport,'up',40,40);}else {a.key('Enter');a.key('ArrowRight');a.key(' ');a.key('Enter');}
  expect(a.shapes()).toHaveLength(1);expect(screen.getByRole('button',{name:'Pen (P)'}).getAttribute('aria-pressed')).toBe('true');expect(a.view.container.querySelector('.ob-canvas-outline')).toBeNull();expect(screen.getByRole('button',{name:'Undo stroke'})).toBeTruthy();equivalentScene(a);
});
test.each(['r','o','a','t'])('design: keyboard %s centers the whole shape in world coordinates',tool=>{
  const a=setup();a.tool('h');a.key('ArrowRight');a.key('+');a.tool(tool);a.key('Enter');if(tool==='t'){a.field('Canvas text','Centered');fireEvent.keyDown(screen.getByLabelText('Canvas text'),{key:'Enter',ctrlKey:true});}
  const b=bounds(a.shapes()[0]);expect(b.x+b.w/2).toBeCloseTo(280);expect(b.y+b.h/2).toBeCloseTo(180);equivalentScene(a);
});
test('design: inactive controls hide; active properties follow the tool and selection',()=>{
  const a=setup();act(()=>screen.getByRole('button',{name:'After canvas'}).focus());expect(screen.queryByLabelText('Stroke color value')).toBeNull();expect(screen.queryByLabelText('Zoom percentage')).toBeNull();expect(screen.queryByRole('separator')).toBeNull();
  act(()=>screen.getByRole('region').focus());a.tool('v');expect(screen.queryByLabelText('Stroke color value')).toBeNull();a.seed();a.select();expect(screen.getByLabelText('Width')).toBeTruthy();
  a.tool('h');expect(screen.queryByLabelText('Width')).toBeNull();expect(screen.queryByLabelText('Stroke color value')).toBeNull();expect(a.view.container.querySelector('.ob-canvas-properties')).toBeNull();expect(screen.getByLabelText('Zoom percentage')).toBeTruthy();
});
test('design: named color swatches and editable value both change the selection',()=>{
  const a=setup();a.seed();a.select();fireEvent.click(screen.getByRole('button',{name:'Stroke: Red'}));expect(a.shapes()[0].scalars.stroke).toBe('#b91c1c');a.field('Stroke color value','#123456');expect(a.shapes()[0].scalars.stroke).toBe('#123456');fireEvent.click(screen.getByRole('button',{name:'Fill: Blue'}));expect(a.shapes()[0].scalars.fill).toBe('#1d4ed8');equivalentScene(a);
});
test('design: coordinate display rounds only while unfocused, without rewriting exact geometry',()=>{
  const a=setup();a.seed();a.select();a.field('X','100.123456789');const field=screen.getByLabelText('X') as HTMLInputElement;expect(field.value).toBe('100.123456789');act(()=>a.viewport.focus());expect(field.value).toBe('100.12');expect(a.shapes()[0].scalars.x).toBe(100.123456789);act(()=>field.focus());expect(field.value).toBe('100.123456789');equivalentScene(a);
});
test('design: Arrange menu opens, roves, commits and closes; Help and Objects anchor at triggers',()=>{
  const a=setup();a.seed();a.seed('ellipse',300);a.select();const trigger=screen.getByRole('button',{name:'Arrange'});fireEvent.click(trigger);expect(document.activeElement).toBe(screen.getByRole('menuitem',{name:'Send to back'}));fireEvent.keyDown(document.activeElement!,{key:'End'});expect(document.activeElement).toBe(screen.getByRole('menuitem',{name:'Bring to front'}));fireEvent.click(document.activeElement!);expect(screen.queryByRole('menu')).toBeNull();expect(a.shapes()[1].scalars.kind).toBe('rect');
  fireEvent.click(screen.getByRole('button',{name:'Objects'}));expect(screen.getByRole('listbox').closest('.ob-canvas-popup-anchor')?.querySelector('button')?.textContent).toBe('Objects');
  fireEvent.click(screen.getByRole('button',{name:'Help (?)'}));expect(screen.queryByRole('listbox')).toBeNull();expect(screen.getByRole('dialog',{name:'Canvas help'}).closest('.ob-canvas-popup-anchor')?.querySelector('button')?.getAttribute('aria-label')).toBe('Help (?)');
});

test('design: pending slash insertion focuses and scrolls its named region into view',()=>{
  const a=setup(),scroll=vi.spyOn(HTMLElement.prototype,'scrollIntoView').mockImplementation(()=>{});
  act(()=>{controller.pendingCaret.current={blockId:'canvas',offset:0};});a.seed();
  expect(document.activeElement).toBe(screen.getByRole('region'));expect(controller.pendingCaret.current).toBeNull();expect(scroll).toHaveBeenCalledWith({block:'nearest'});expect(screen.getByRole('toolbar',{name:'Canvas tools'})).toBeTruthy();
});


test.each(['Escape','remote deletion'])('delta: Arrange %s returns focus to its persistent trigger',route=>{
  const a=setup();const id=a.seed();a.select();const trigger=screen.getByRole('button',{name:'Arrange'});fireEvent.click(trigger);expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
  if(route==='Escape')fireEvent.keyDown(document.activeElement!,{key:'Escape'});
  else {const peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(a.doc));const props=findBlock(peer,'canvas')!.block.get('props') as Y.Map<unknown>;(props.get('shapes') as Y.Map<unknown>).delete(id);act(()=>Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(peer),'net'));equivalentScene(a);}
  expect(screen.queryByRole('menu')).toBeNull();expect(document.activeElement).toBe(trigger);expect(trigger.isConnected).toBe(true);
});
test.each(['new','existing'])('delta: window blur commits %s text instead of cancelling it',kind=>{
  const a=setup();if(kind==='existing'){a.seed('text');a.select();fireEvent.click(screen.getByRole('button',{name:'Edit text'}));}else {a.tool('t');a.key('Enter');}
  a.field('Canvas text','Words survive window blur');fireEvent(window,new Event('blur'));expect(screen.queryByLabelText('Canvas text')).toBeNull();expect(a.shapes()).toHaveLength(1);expect(a.shapes()[0].scalars.text).toBe('Words survive window blur');equivalentScene(a);
});
test.each(['delete','quarantine'])('delta: remote %s hides editing controls while retaining their geometry nodes',change=>{
  const a=setup();const id=a.seed();a.select();const strip=a.view.container.querySelector('.ob-canvas-properties'),width=screen.getByLabelText('Width'),toolbar=screen.getByRole('toolbar',{name:'Canvas tools'}),toolNodes=[...toolbar.querySelectorAll('button')];
  const peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(a.doc));const props=findBlock(peer,'canvas')!.block.get('props') as Y.Map<unknown>;
  if(change==='delete')(props.get('shapes') as Y.Map<unknown>).delete(id);else props.set('canvasVersion',2);
  act(()=>Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(peer),'net'));
  expect(a.view.container.querySelector('.ob-canvas-properties')).toBe(strip);expect(width.isConnected).toBe(true);expect(strip?.getAttribute('aria-hidden')).toBe('true');expect(screen.queryByRole('spinbutton',{name:'Width'})).toBeNull();expect([...toolbar.querySelectorAll('button')]).toEqual(toolNodes);equivalentScene(a);
});


test('M2: quarantine while Width owns focus restores the region and makes the retained field inert',()=>{
  const a=setup();a.seed();a.select();const field=screen.getByLabelText('Width');act(()=>field.focus());
  const peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(a.doc));(findBlock(peer,'canvas')!.block.get('props') as Y.Map<unknown>).set('canvasVersion',2);act(()=>Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(peer),'net'));
  expect(document.activeElement).toBe(screen.getByRole('region'));expect(field.closest('[inert]')).not.toBeNull();expect(field.closest('fieldset')?.disabled).toBe(true);expect(screen.queryByRole('spinbutton',{name:'Width'})).toBeNull();expect(a.view.container.querySelector('.ob-canvas-live')?.textContent).toBe('View only');
  const before=Y.encodeStateAsUpdate(a.doc);fireEvent.change(field,{target:{value:'500'}});expect(Y.encodeStateAsUpdate(a.doc)).toEqual(before);
  act(()=>screen.getByRole('button',{name:'After canvas'}).focus());expect(a.view.container.querySelector('.ob-canvas-properties')).toBeNull();expect(a.view.container.querySelector('.ob-canvas-footer')).toBeNull();equivalentScene(a);
});


test('text blur commits words and resets pen contact without promoting a resting touch',()=>{
  const a=setup();a.tool('t');pointer(a.viewport,'down',100,100,{pointerType:'pen',pressure:.4});a.field('Canvas text','Pen-entered text');pointer(a.viewport,'down',100,100,{pointerType:'touch',pointerId:2});
  const before=context.translate.mock.calls[context.translate.mock.calls.length-1]!;fireEvent(window,new Event('blur'));expect(a.shapes()[0].scalars.text).toBe('Pen-entered text');expect(a.viewport.hasPointerCapture(1)).toBe(false);
  pointer(a.viewport,'move',140,100,{pointerType:'touch',pointerId:2});expect(context.translate.mock.calls[context.translate.mock.calls.length-1]).toEqual(before);pointer(a.viewport,'up',140,100,{pointerType:'touch',pointerId:2});
  pointer(a.viewport,'down',100,100,{pointerType:'touch',pointerId:3});pointer(a.viewport,'move',140,100,{pointerType:'touch',pointerId:3});pointer(a.viewport,'up',140,100,{pointerType:'touch',pointerId:3});expect(context.translate.mock.calls[context.translate.mock.calls.length-1]).toEqual([before[0]+40,before[1]]);equivalentScene(a);
});

test.each(['window','click-away'])('empty/nonempty text on %s blur commits only words',route=>{
  const a=setup();
  for(const text of ['', 'Typed words']){
    a.tool('t');a.key('Enter');a.field('Canvas text',text);
    const before=Y.encodeStateAsUpdate(a.doc),updates=vi.fn();a.doc.on('update',updates);
    if(route==='window')fireEvent(window,new Event('blur'));else act(()=>screen.getByRole('button',{name:'After canvas'}).focus());
    expect(screen.queryByLabelText('Canvas text')).toBeNull();expect(a.shapes()).toHaveLength(text?1:0);
    if(!text){expect(Y.encodeStateAsUpdate(a.doc)).toEqual(before);expect(updates).not.toHaveBeenCalled();expect(controller.history?.()?.availability?.undo).toBeNull();}
    a.doc.off('update',updates);act(()=>screen.getByRole('region').focus());
  }
  equivalentScene(a);
});
test.each(['permission','quarantine'])('static readonly %s has only Pan and no editing ghost slots',kind=>{
  const a=setup(kind==='permission',kind==='quarantine');expect(within(screen.getByRole('toolbar')).getAllByRole('button',{hidden:true})).toHaveLength(1);
  expect(screen.getByRole('button',{name:'Pan (H)'})).toBeTruthy();expect(screen.queryByLabelText('Canvas height')).toBeNull();expect(a.view.container.querySelector('.ob-canvas-history')).toBeNull();expect(a.view.container.querySelector('.ob-canvas-height-slot')).toBeNull();
});

test('local deselection and a local tool change after remote deletion reclaim properties',()=>{
  const a=setup();a.seed();a.select();a.key('Escape');expect(screen.queryByLabelText('Width')).toBeNull();expect(a.view.container.querySelector('.ob-canvas-properties')).toBeNull();
  a.select();const peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(a.doc));const props=findBlock(peer,'canvas')!.block.get('props') as Y.Map<unknown>;(props.get('shapes') as Y.Map<unknown>).clear();act(()=>Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(peer),'net'));
  expect(screen.getByLabelText('Width').closest('[aria-hidden="true"]')).toBeTruthy();a.tool('h');expect(screen.queryByLabelText('Width')).toBeNull();equivalentScene(a);
});
test('quarantine closes Arrange and local navigation reclaims reserved editing chrome',()=>{
  const a=setup();a.seed();a.select();fireEvent.click(screen.getByRole('button',{name:'Arrange'}));
  const peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(a.doc));const props=findBlock(peer,'canvas')!.block.get('props') as Y.Map<unknown>;props.set('canvasVersion',2);act(()=>Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(peer),'net'));
  expect(screen.queryByRole('menu',{hidden:true})).toBeNull();expect(document.activeElement).toBe(screen.getByRole('region'));
  a.tool('h');expect(screen.queryByLabelText('Width')).toBeNull();expect(screen.queryByLabelText('Canvas height')).toBeNull();expect(within(screen.getByRole('toolbar')).getAllByRole('button',{hidden:true})).toHaveLength(1);
  props.set('canvasVersion',1);act(()=>Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(peer),'net'));expect(screen.queryByRole('menu')).toBeNull();equivalentScene(a);
});


test('Duplicate preserves the connected focused properties button',()=>{
  const a=setup();a.seed();a.select();const button=screen.getByRole('button',{name:'Duplicate'});act(()=>button.focus());fireEvent.click(button);
  expect(a.shapes()).toHaveLength(2);expect(screen.getByRole('button',{name:'Duplicate'})).toBe(button);expect(button.isConnected).toBe(true);expect(document.activeElement).toBe(button);equivalentScene(a);
});
test('tool switching with focus inside properties preserves the strip and shared controls',()=>{
  const a=setup();const field=screen.getByLabelText('Stroke color value'),strip=a.view.container.querySelector('.ob-canvas-properties');act(()=>field.focus());
  // The toolbar action changes tools while the field still owns focus (click
  // handlers need not receive DOM focus, e.g. native macOS button activation).
  fireEvent.click(screen.getByRole('button',{name:'Rectangle (R)'}));
  expect(a.view.container.querySelector('.ob-canvas-properties')).toBe(strip);expect(screen.getByLabelText('Stroke color value')).toBe(field);expect(field.isConnected).toBe(true);expect(document.activeElement).toBe(a.viewport);
});
test.each(['finish','Escape'])('empty existing text: %s deletes undoably or reverts explicitly',route=>{
  const a=setup();a.tool('t');a.key('Enter');a.field('Canvas text','Original words');fireEvent.keyDown(screen.getByLabelText('Canvas text'),{key:'Enter',ctrlKey:true});
  const original=a.shapes()[0];fireEvent.click(screen.getByRole('button',{name:'Edit text'}));a.field('Canvas text','');
  fireEvent.keyDown(screen.getByLabelText('Canvas text'),route==='finish'?{key:'Enter',ctrlKey:true}:{key:'Escape'});
  if(route==='finish'){
    expect(a.shapes()).toHaveLength(0);equivalentScene(a);a.key('z',{ctrlKey:true});expect(a.shapes()).toEqual([original]);equivalentScene(a);
    a.key('z',{ctrlKey:true,shiftKey:true});expect(a.shapes()).toHaveLength(0);
  }else expect(a.shapes()).toEqual([original]);
  equivalentScene(a);
});


test.each([false,true])('BUILD-5: Expand replay preserves mounted canvas, document, selection, local camera and focus (viewer %s)',viewOnly=>{
  const a=setup(viewOnly);if(!viewOnly){expect(screen.getByText('Pen P · Select V · Expand F')).toBeTruthy();a.seed();a.select();}
  const surface=screen.getByRole('region'),canvas=a.view.container.querySelector('canvas'),before=Y.encodeStateAsUpdate(a.doc);
  a.key('h');a.key('ArrowRight',{code:'ArrowRight'});const camera=context.translate.mock.calls[context.translate.mock.calls.length-1];
  act(()=>a.viewport.focus());a.key('f',{code:'KeyF'});
  expect(screen.getByRole('button',{name:'Back'})).toBeTruthy();expect(screen.getByRole('region')).toBe(surface);expect(surface.querySelector('canvas')).toBe(canvas);expect(surface.classList.contains('ob-canvas-expanded')).toBe(true);
  expect(context.translate.mock.calls[context.translate.mock.calls.length-1]).toEqual(camera);expect(Y.encodeStateAsUpdate(a.doc)).toEqual(before);
  fireEvent.click(screen.getByRole('button',{name:'Back'}));expect(document.activeElement).toBe(a.viewport);expect(a.view.container.contains(surface)).toBe(true);expect(context.translate.mock.calls[context.translate.mock.calls.length-1]).toEqual(camera);expect(Y.encodeStateAsUpdate(a.doc)).toEqual(before);equivalentScene(a);
});
test('BUILD-5: F does not leak from fields; Escape follows selection then returns from expanded',()=>{
  const a=setup();a.seed();a.select();a.field('Object name','name');fireEvent.keyDown(screen.getByLabelText('Object name'),{key:'f',code:'KeyF'});expect(screen.queryByRole('button',{name:'Back'})).toBeNull();
  act(()=>a.viewport.focus());a.key('f',{code:'KeyF'});a.key('Escape',{code:'Escape'});expect(screen.getByRole('button',{name:'Back'})).toBeTruthy();a.key('Escape',{code:'Escape'});expect(screen.queryByRole('button',{name:'Back'})).toBeNull();
});
test('BUILD-5: grid/snap replay has working pointer creation, Alt mirror and exact numeric/keyboard edits',()=>{
  const a=setup();expect((screen.getByLabelText('Grid') as HTMLInputElement).checked).toBe(false);expect((screen.getByLabelText('Snap') as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByLabelText('Grid'));expect(a.view.container.querySelector('.ob-canvas-grid')).not.toBeNull();fireEvent.click(screen.getByLabelText('Snap'));
  a.tool('r');pointer(a.viewport,'down',15,15);pointer(a.viewport,'move',63,47);expect(a.view.container.querySelectorAll('.ob-canvas-guide').length).toBe(2);pointer(a.viewport,'up',63,47);expect(bounds(a.shapes()[0])).toEqual({x:16,y:16,w:48,h:32});
  a.key('ArrowRight',{code:'ArrowRight'});expect(bounds(a.shapes()[0]).x).toBe(17);a.field('X','19');expect(bounds(a.shapes()[0]).x).toBe(19);
  act(()=>a.viewport.focus());a.tool('r');pointer(a.viewport,'down',111,111,{altKey:true});pointer(a.viewport,'move',159,143,{altKey:true});pointer(a.viewport,'up',159,143,{altKey:true});expect(bounds(a.shapes()[1])).toEqual({x:111,y:111,w:48,h:32});equivalentScene(a);
});
test('BUILD-5: hidden clears, visible reasserts only with focus; clear/rejoin mirror; viewers point',()=>{
  vi.useFakeTimers();const a=setup(true,false,true);const aw=a.awareness!;
  expect(aw.getLocalState()?.canvas.tool).toBe('pan');pointer(a.viewport,'move',10,20);pointer(a.viewport,'move',30,40);
  vi.spyOn(document,'hidden','get').mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));expect(aw.getLocalState()?.canvas).toBeNull();act(()=>vi.advanceTimersByTime(100));expect(aw.getLocalState()?.canvas).toBeNull();
  vi.spyOn(document,'hidden','get').mockReturnValue(false);fireEvent(document,new Event('visibilitychange'));expect(aw.getLocalState()?.canvas.blockId).toBe('canvas');
  act(()=>screen.getByRole('button',{name:'After canvas'}).focus());expect(aw.getLocalState()?.canvas).toBeNull();fireEvent(document,new Event('visibilitychange'));expect(aw.getLocalState()?.canvas).toBeNull();act(()=>a.viewport.focus());expect(aw.getLocalState()?.canvas.blockId).toBe('canvas');expect(a.shapes()).toHaveLength(0);
});
test('BUILD-5: peers stay within their canvas; idle labels restore; remote selection has no handles',()=>{
  vi.useFakeTimers();const a=setup(false,false,true),id=a.seed();const peer=new Awareness(new Y.Doc());peer.setLocalStateField('user',{id:'peer',name:'Morgan',color:'#123456'});peer.setLocalStateField('canvas',canvasFacet('canvas',{x:12,y:24},'select',[id,'deleted']));
  const deliver=()=>act(()=>applyAwarenessUpdate(a.awareness!,encodeAwarenessUpdate(peer,[peer.clientID]),'net'));deliver();
  expect(screen.getByRole('img',{name:'Morgan, select'})).toBeTruthy();expect(a.view.container.querySelectorAll('.ob-canvas-peer-selection')).toHaveLength(1);expect(a.view.container.querySelectorAll('.ob-canvas-handle')).toHaveLength(0);
  act(()=>vi.advanceTimersByTime(3000));expect(screen.getByRole('img',{name:'Morgan, select'}).getAttribute('data-idle')).toBe('true');peer.setLocalStateField('canvas',canvasFacet('canvas',{x:14,y:24},'pen',[]));deliver();expect(screen.getByRole('img',{name:'Morgan, pen'}).getAttribute('data-idle')).toBe('false');
  peer.setLocalStateField('canvas',canvasFacet('other',{x:14,y:24},'pen',[]));deliver();expect(screen.queryByRole('img',{name:'Morgan, pen'})).toBeNull();peer.destroy();
});


test('BUILD-5: irreducible over-budget real-sample path keeps geometry, records and announces; ordinary stroke mirror',()=>{
  // Synthetic PointerEvents exercise the real commit path, not device latency.
  const a=setup(),overruns=decimationDiagnostics.overruns;
  pointer(a.viewport,'down',0,0);const samples=Array.from({length:1199},(_,j)=>{const i=j+1;return new PointerEvent('pointermove',{bubbles:true,pointerId:1,pointerType:'mouse',buttons:1,clientX:i/4,clientY:i%2?3:0});});const event=samples[samples.length-1];Object.defineProperty(event,'getCoalescedEvents',{value:()=>samples});fireEvent(a.viewport,event);pointer(a.viewport,'up',1199/4,3);
  expect(a.shapes()[0].points).toHaveLength(2400);expect(decimationDiagnostics.overruns).toBe(overruns+1);expect(screen.getByRole('status').textContent).toBe('Long stroke preserved · point budget exceeded');equivalentScene(a);
  pointer(a.viewport,'down',20,20);pointer(a.viewport,'move',30,30);pointer(a.viewport,'up',30,30);expect(decimationDiagnostics.overruns).toBe(overruns+1);expect(a.shapes()).toHaveLength(2);equivalentScene(a);
});
test('BUILD-5: snap applies to move and resize; freehand is never magnetic',()=>{
  const a=setup();a.seed();a.select();fireEvent.click(screen.getByLabelText('Snap'));
  pointer(a.viewport,'down',130,100);pointer(a.viewport,'move',141,100);pointer(a.viewport,'up',141,100);expect(bounds(a.shapes()[0]).x).toBe(112);
  const b=bounds(a.shapes()[0]),handles=a.view.container.querySelectorAll('.ob-canvas-handle');pointer(handles[4],'down',b.x+b.w,b.y+b.h);pointer(a.viewport,'move',b.x+b.w+9,b.y+b.h+17);pointer(a.viewport,'up',b.x+b.w+9,b.y+b.h+17);expect(bounds(a.shapes()[0])).toMatchObject({w:128,h:96});
  a.tool('p');pointer(a.viewport,'down',15,15);pointer(a.viewport,'move',31,31);pointer(a.viewport,'up',31,31);expect(a.shapes()[1].scalars.x).toBe(15);expect(a.shapes()[1].points).toEqual([0,0,16,16]);equivalentScene(a);
});

test('coordinates remain controlled through creation, drag, cancel and expansion',()=>{
  const errors=vi.spyOn(console,'error');
  const assertQuiet=()=>expect(errors.mock.calls).toEqual([]);
  // A planted warning proves the console-error meter rejects warnings.
  errors.mockImplementation(()=>{});
  console.error('A component is changing a controlled input to be uncontrolled.');
  expect(assertQuiet).toThrow();errors.mockClear();
  const a=setup();assertQuiet();
  a.tool('r');assertQuiet();a.key('Enter');assertQuiet();
  a.key('f');assertQuiet();a.key('f');assertQuiet();
  const x=screen.getByLabelText('X') as HTMLInputElement;
  const before=Number(x.value);
  pointer(a.viewport,'down',320,180);assertQuiet();
  pointer(a.viewport,'move',340,200);assertQuiet();
  expect(Number(x.value)).toBe(before+20);
  pointer(a.viewport,'up',340,200);assertQuiet();
  expect(Number(x.value)).toBe(before+20);
  pointer(a.viewport,'down',340,200);pointer(a.viewport,'move',350,210);
  expect(Number(x.value)).toBe(before+30);a.key('Escape');assertQuiet();
  expect(Number(x.value)).toBe(before+20);equivalentScene(a);
});
