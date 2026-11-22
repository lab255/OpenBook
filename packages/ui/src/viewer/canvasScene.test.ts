import {expect,it} from 'vitest';
import * as Y from 'yjs';
import {canvasDefaults,constructCanvasProps,createShape,projectCanvas,readCanvas,shapeDefaults} from '@/blockeditor/canvas/schema';
import {readViewerCanvas} from './canvasScene';

function fixture(kind='stroke',variable=true):Y.Map<unknown> {
  const doc=new Y.Doc(),props=constructCanvasProps({...canvasDefaults,shapes:{}});
  doc.getMap('root').set('canvas',props);
  (props.get('shapes') as Y.Map<unknown>).set('shape',createShape({id:'shape',kind,pressureMode:variable?'variable':'constant',pointArity:variable?3:2,points:kind==='stroke'?(variable?[0,0,0,10,20,255,30,0,80]:[0,0,10,20,30,0]):[]}));
  return props;
}
for(const kind of ['stroke','rect','ellipse','arrow','text'])for(const variable of [false,true]) {
  it(`reads ${kind}/${variable} exactly like app, binary and projected JSON, after fresh import`,()=>{
    const props=fixture(kind,variable),before=Y.encodeStateAsUpdate(props.doc!);
    const expected=readCanvas(props).shapes;
    expect(readViewerCanvas(props).shapes).toEqual(expected);
    expect(readViewerCanvas(projectCanvas(props))).toEqual({shapes:expected,diagnostics:[]});
    const fresh=new Y.Doc();Y.applyUpdate(fresh,before);
    expect(readViewerCanvas(fresh.getMap('root').get('canvas'))).toEqual({shapes:expected,diagnostics:[]});
    expect(Y.encodeStateAsUpdate(props.doc!)).toEqual(before);
  });
}
for(const key of Object.keys(shapeDefaults))for(const invalid of [undefined,null,{},NaN]) {
  it(`quarantines invalid committed scalar ${key}/${String(invalid)}`,()=>{
    const props=fixture(),shape=(props.get('shapes') as Y.Map<Y.Map<unknown>>).get('shape')!;
    if(invalid===undefined)shape.delete(key);else shape.set(key,invalid);
    const app=readCanvas(props),viewer=readViewerCanvas(props);
    expect(app.shapes).toHaveLength(0);expect(viewer.shapes).toHaveLength(0);
    expect(viewer.diagnostics.some(message=>message.includes('Quarantined shape shape'))).toBe(true);
  });
}
it('preserves app normalization and ordering without mutation',()=>{
  const props=fixture(),shapes=props.get('shapes') as Y.Map<Y.Map<unknown>>,first=shapes.get('shape')!;
  for(const [key,value] of Object.entries({w:-1,h:-2,opacity:3}))first.set(key,value);
  shapes.set('a',createShape({id:'a'}));
  expect(readViewerCanvas(props).shapes).toEqual(readCanvas(props).shapes);
});
for(const points of [[0,0],[0,0,256],[0,0,-1],[0,0,.5],[NaN,0,1]]) {
  it(`quarantines malformed committed pressure ${JSON.stringify(points)}`,()=>{
    const data=projectCanvas(fixture()) as {shapes:Record<string,Record<string,unknown>>};data.shapes.shape.points=points;
    expect(readViewerCanvas(data).shapes).toEqual(readCanvas(data).shapes);
    expect(readViewerCanvas(data).diagnostics.join()).toContain('Quarantined');
  });
}
it('defaults missing JSON arity to 2, never silently treats variable triplets as pairs',()=>{
  const data=projectCanvas(fixture()) as {shapes:Record<string,Record<string,unknown>>};delete data.shapes.shape.pointArity;
  expect(readViewerCanvas(data).shapes).toEqual([]);
  expect(readViewerCanvas(data).diagnostics.join()).toContain('pointArity');
  const constant=projectCanvas(fixture('stroke',false)) as typeof data;delete constant.shapes.shape.pointArity;
  expect(readViewerCanvas(constant).shapes).toHaveLength(1);
});
it('diagnoses malformed containers and board fields, while valid empty boards stay empty',()=>{
  expect(readViewerCanvas({...canvasDefaults,shapes:{}})).toEqual({shapes:[],diagnostics:[]});
  for(const shapes of [null,[],false,undefined])expect(readViewerCanvas({...canvasDefaults,shapes}).diagnostics).toContain('Invalid canvas shapes');
  for(const key of Object.keys(canvasDefaults))expect(readViewerCanvas({...canvasDefaults,shapes:{},[key]:null}).diagnostics).toContain(`Invalid canvas ${key}`);
});
