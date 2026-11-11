import {describe, it, expect} from 'vitest';
import * as Y from 'yjs';
import {CanvasHistory, isLocalHistoryOrigin} from './history';
import {newShape, appendPoints, readScene, projectCanvas} from './state';

function harness(aid = 101, bid = 202) {
  const seed = new Y.Doc(); seed.clientID = 1;
  const root = seed.getArray<Y.Map<unknown>>('blocks'), props = new Y.Map<unknown>(), shapes = new Y.Map<Y.Map<unknown>>();
  seed.transact(() => {root.push([props]); props.set('shapes', shapes); shapes.set('s', newShape('rect', {id: 's'})); shapes.set('t', newShape('stroke', {id: 't', pressureMode: 'variable'}));});
  const replica = (id: number) => {
    const doc = new Y.Doc(); doc.clientID = id; Y.applyUpdate(doc, Y.encodeStateAsUpdate(seed));
    const blocks = doc.getArray<Y.Map<unknown>>('blocks'), props = blocks.get(0), shapes = props.get('shapes') as Y.Map<Y.Map<unknown>>;
    const history = new CanvasHistory(doc, blocks);
    doc.on('afterTransaction', () => {const scene = readScene(shapes); expect(scene.diagnostics).toEqual([]); for (const s of scene.shapes) for (const key of ['x','y','w','h']) expect(Number.isFinite(s[key])).toBe(true);});
    return {doc, props, shapes, history, move(values: Record<string, unknown>, ids = ['s']) {history.commitCanvasCommand('move', ids.map(id => ({target: shapes.get(id)!, resolve: () => shapes.get(id), values})));}, x: () => shapes.get('s')?.get('x')};
  };
  const a = replica(aid), b = replica(bid);
  const sync = () => {const au = Y.encodeStateAsUpdate(a.doc), bu = Y.encodeStateAsUpdate(b.doc); Y.applyUpdate(a.doc, bu, 'net'); Y.applyUpdate(b.doc, au, 'net'); expect(a.shapes.toJSON()).toEqual(b.shapes.toJSON());};
  return {a,b,sync};
}
describe('D3 required proof', () => {
  for (const [aid,bid] of [[101,202],[202,101]]) {
    it(`winning move undo/redo and losing undo; client ids ${aid}/${bid}`, () => {
      const {a,b,sync} = harness(aid,bid); a.move({x:20,y:20}); b.move({x:40,y:40}); sync();
      const winner = aid > bid ? a : b, loser = aid > bid ? b : a, value = winner === a ? 20 : 40;
      expect(a.x()).toBe(value); loser.history.undo(); sync(); expect(a.x()).toBe(value); expect(loser.history.result.appliedKeys).toBe(0);
      winner.history.undo(); sync(); expect(a.x()).toBe(0); winner.history.redo(); sync(); expect(a.x()).toBe(value);
    });
    it(`token/value pairing unequal lengths, x-only vs x/y, inverse reuse ${aid}/${bid}`, () => {
      const {a,b,sync} = harness(aid,bid); a.move({x:20}); b.move({x:40,y:50,w:200});
      const at = a.shapes.get('s')!.get('op:x'), bt = b.shapes.get('s')!.get('op:x'); sync();
      expect(a.shapes.get('s')!.get('op:x')).toBe(a.x() === 20 ? at : bt); expect(a.shapes.get('s')!.get('y')).toBe(50);
      const winner = aid > bid ? a : b; winner.history.undo(); sync(); winner.history.redo(); sync(); expect(a.shapes.get('s')!.get('op:x')).toBe(a.x() === 20 ? at : bt);
    });
  }
  for (const [aid,bid] of [[101,202],[202,101]]) it(`concurrent inverse token reuse vs new move ${aid}/${bid}`, () => {const {a,b,sync}=harness(aid,bid);a.move({x:20,y:30});sync();const old=a.shapes.get('s')!.get('op:x');a.history.undo();b.move({x:80});const remote=b.shapes.get('s')!.get('op:x');sync();expect([0,80]).toContain(a.x());expect(a.shapes.get('s')!.get('op:x')).toBe(a.x()===0?'seed':remote);a.history.redo();sync();expect(a.shapes.get('s')!.get('op:x')).toBe(a.x()===20?old:remote);});
  it('token lineage: two edits, two undos, two redos', () => {const {a,sync} = harness(); a.move({x:10}); a.move({x:20}); a.history.undo(); sync(); expect(a.x()).toBe(10); a.history.undo(); sync(); expect(a.x()).toBe(0); a.history.redo(); sync(); expect(a.x()).toBe(10); a.history.redo(); sync(); expect(a.x()).toBe(20);});
  it('redo after remote move partially skips', () => {const {a,b,sync} = harness(); a.move({x:20,y:30}); sync(); a.history.undo(); sync(); b.move({x:80}); sync(); a.history.redo(); sync(); expect(a.x()).toBe(80); expect(a.shapes.get('s')!.get('y')).toBe(30); expect(a.history.result.skippedKeys).toBe(1);});
  it('remote erase before undo never resurrects', () => {const {a,b,sync} = harness(); a.move({x:20}); sync(); b.history.structural('erase', () => b.shapes.delete('s')); sync(); a.history.undo(); sync(); expect(a.shapes.has('s')).toBe(false);});
  it('append + pressure undo/redo is atomic and projects offsets', () => {const {a,sync} = harness(); a.history.structural('append', () => appendPoints(a.shapes.get('t')!, [0,0,10,20], [.2,.8])); sync(); const projected = projectCanvas(a.props) as {shapes: Record<string, {x: number; points: number[]; pressureBatches: Record<string, unknown>}>}; expect(Object.values(projected.shapes.t.pressureBatches)[0]).toMatchObject({pointOffset:0,count:2,q:[51,204]}); a.history.undo(); sync(); expect((a.shapes.get('t')!.get('points') as Y.Array<number>).length).toBe(0); expect((a.shapes.get('t')!.get('pressureBatches') as Y.Map<unknown>).size).toBe(0); a.history.redo(); sync(); expect((a.shapes.get('t')!.get('points') as Y.Array<number>).length).toBe(4); expect((projected.shapes.t.points as number[]).length).toBe(4);});
  it('erase restores complete geometry after semantic edits', () => {const {a,sync} = harness(); a.move({x:25,w:200}); a.history.structural('erase', () => a.shapes.delete('s')); sync(); a.history.undo(); sync(); expect(a.x()).toBe(25); expect(a.shapes.get('s')!.get('w')).toBe(200); a.history.undo(); sync(); expect(Number.isFinite(a.x())).toBe(true);});
  it('grouped multi-selection one history entry', () => {const {a,sync} = harness(); a.move({x:10,y:15}, ['s','t']); expect(a.history.past.length).toBe(1); a.history.undo(); sync(); expect(a.x()).toBe(0); expect(a.shapes.get('t')!.get('x')).toBe(0);});
  it('cancel unpublished preview preserves remote geometry', () => {const {a,b,sync} = harness(); const preview = {...a.shapes.get('s')!.toJSON(), x:200}; b.move({x:60}); sync(); expect(preview.x).toBe(200); expect(a.x()).toBe(60); expect(a.history.past.length).toBe(0);});
  it('interleaved page/canvas history and new edit clears both redos', () => {const {a,sync} = harness(); a.history.structural('page', () => a.props.set('title','hello')); a.move({x:20}); a.history.structural('page', () => a.props.set('title','world')); a.history.undo(); expect(a.props.get('title')).toBe('hello'); a.history.undo(); expect(a.x()).toBe(0); a.history.undo(); expect(a.props.get('title')).toBeUndefined(); a.history.redo(); a.history.redo(); sync(); expect(a.x()).toBe(20); a.move({y:50}); expect(a.history.future).toHaveLength(0); expect(a.history.manager.redoStack).toHaveLength(0);});
  it('root no-op cannot skip across semantic entry', () => {const {a,b,sync} = harness(); a.history.structural('page', () => a.props.set('title','old')); a.move({x:20}); a.history.structural('new shape', () => a.shapes.set('z',newShape('rect',{id:'z'}))); sync(); b.history.structural('erase', () => b.shapes.delete('z')); sync(); a.history.undo(); expect(a.x()).toBe(20); expect(a.props.get('title')).toBe('old'); a.history.undo(); expect(a.x()).toBe(0); a.history.undo(); expect(a.props.get('title')).toBeUndefined();});
  it('raw undo bytes use recognized local origin, remote updates never echo', () => {const {a,b} = harness(); const origins: unknown[] = []; a.doc.on('update',(u:Uint8Array,o:unknown) => {if (o === 'local' || isLocalHistoryOrigin(o)) {origins.push(o); Y.applyUpdate(b.doc,u,'net');}}); a.history.structural('erase', () => a.shapes.delete('s')); a.history.undo(); expect(b.x()).toBe(0); expect(origins.length).toBe(2); expect(isLocalHistoryOrigin(origins[1])).toBe(true); expect(isLocalHistoryOrigin('net')).toBe(false);});
  it('read-only command/structural/history guards', () => {const {a} = harness(); a.move({x:20}); a.history.undo(true); a.history.structural('erase',()=>a.shapes.delete('s'),true); a.history.commitCanvasCommand('move',[{target:a.shapes.get('s')!,resolve:()=>a.shapes.get('s'),values:{x:80}}],true); expect(a.x()).toBe(20);});
  it('invalid/fallback docs are quarantined and immutable projection survives edits', () => {const {a} = harness(); expect(readScene(a.shapes.toJSON()).editable).toBe(false); expect(readScene({bad:{kind:'rect',x:NaN}}).diagnostics).toHaveLength(1); expect(()=>a.move({x:NaN})).toThrow(); const p = projectCanvas(a.props) as {shapes: Record<string, {x: number; points: number[]; pressureBatches: Record<string, unknown>}>}; a.move({x:20}); expect(p.shapes.s.x).toBe(0);});
  it('erase versus concurrent edit and append converges delete-wins', () => {const {a,b,sync} = harness(); a.history.structural('erase',()=>a.shapes.delete('t')); b.move({x:70},['t']); b.history.structural('append',()=>appendPoints(b.shapes.get('t')!,[1,2],[.5])); sync(); expect(a.shapes.has('t')).toBe(false);});
});
