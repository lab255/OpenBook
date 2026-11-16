import * as Y from 'yjs';
import {expect, test} from 'vitest';

const semantic = Symbol('semantic');
function seed() {
  const doc = new Y.Doc(); doc.clientID = 1;
  const shapes = doc.getMap<Y.Map<unknown>>('shapes');
  const shape = new Y.Map<unknown>();
  for (const [k, v] of Object.entries({id: 's', x: 0, y: 0, w: 10, h: 10})) shape.set(k, v);
  shapes.set('s', shape);
  return Y.encodeStateAsUpdate(doc);
}
function peer(bytes: Uint8Array, id: number) {
  const doc = new Y.Doc(); doc.clientID = id; Y.applyUpdate(doc, bytes);
  const shapes = doc.getMap<Y.Map<unknown>>('shapes');
  const manager = new Y.UndoManager(shapes, {trackedOrigins: new Set(['local']), captureTransaction: t => !t.meta.has(semantic)});
  return {doc, shapes, manager};
}
function write(p: ReturnType<typeof peer>, x: number, token: string) {
  p.doc.transact(t => {
    t.meta.set(semantic, true);
    const shape = p.shapes.get('s')!;
    shape.set('x', x); shape.set('op:x', token);
  }, 'local');
}
function exchange(a: ReturnType<typeof peer>, b: ReturnType<typeof peer>) {
  const au = Y.encodeStateAsUpdate(a.doc), bu = Y.encodeStateAsUpdate(b.doc);
  Y.applyUpdate(a.doc, bu, 'net'); Y.applyUpdate(b.doc, au, 'net');
}
test('D3 gate: erase restore after semantic edits retains complete finite geometry', () => {
  const bytes = seed(), a = peer(bytes, 10), b = peer(bytes, 20);
  write(a, 20, 'A'); exchange(a, b);
  a.doc.transact(() => a.shapes.delete('s'), 'local'); exchange(a,b);
  a.manager.undo(); exchange(a,b);
  const states = [a.shapes.toJSON(), b.shapes.toJSON()];
  expect(states, JSON.stringify({seed: Array.from(bytes), operations: ['A semantic x=20', 'exchange', 'A erase', 'exchange', 'A raw undo', 'exchange'], states})).toEqual([{s: {id:'s',x:20,y:0,w:10,h:10,'op:x':'A'}},{s: {id:'s',x:20,y:0,w:10,h:10,'op:x':'A'}}]);
});
test('D3 gate: decisive example in both client-id orders', () => {
  for (const ids of [[10,20], [20,10]]) {
    const bytes = seed(), a = peer(bytes,ids[0]), b = peer(bytes,ids[1]);
    write(a,20,'A'); write(b,40,'B'); exchange(a,b);
    const winner = ids[0] > ids[1] ? a : b;
    write(winner,0,'seed'); exchange(a,b);
    expect(a.shapes.get('s')!.get('x')).toBe(0);
    expect(b.shapes.get('s')!.get('x')).toBe(0);
    write(winner,ids[0] > ids[1] ? 20 : 40,ids[0] > ids[1] ? 'A':'B'); exchange(a,b);
    expect(a.shapes.toJSON()).toEqual(b.shapes.toJSON());
  }
});
