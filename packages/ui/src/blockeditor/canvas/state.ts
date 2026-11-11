import * as Y from 'yjs';
import type {NewBlock} from '../model';
export type Shape = typeof defaults & {id: string; kind: string; points: number[]; [key: string]: unknown};
export const defaults = {shapeVersion: 1, name: '', ord: 'a0', x: 0, y: 0, w: 120, h: 80, stroke: '#2563eb', fill: 'none', strokeWidth: 3, opacity: 1, dash: 'solid', basisW: 1, basisH: 1, text: '', fontSize: 16, fontFamily: 'sans', textAlign: 'left', startX: 0, startY: 0, endX: 1, endY: 1, startHead: 'none', endHead: 'arrow', pressureMode: 'constant'};
export function newCanvas(): NewBlock {return {type: 'canvas', props: {canvasVersion: 1, height: 360, background: '#ffffff', shapes: new Y.Map()}};}
export function newShape(kind: string, values: Record<string, unknown> = {}): Y.Map<unknown> {
  const shape = new Y.Map<unknown>();
  for (const [k,v] of Object.entries({...defaults, id: crypto.randomUUID(), kind, ...values})) shape.set(k,v);
  shape.set('points', new Y.Array<number>()); shape.set('pressureBatches', new Y.Map()); return shape;
}
export function appendPoints(shape: Y.Map<unknown>, points: number[], pressure?: number[]): void {
  if (points.length % 2 || !points.every(Number.isFinite) || (pressure && pressure.length !== points.length / 2)) throw new Error('Invalid point batch');
  const array = shape.get('points') as Y.Array<number>, batches = shape.get('pressureBatches') as Y.Map<unknown>;
  for (let at = 0; at < points.length; at += 128) {
    const chunk = points.slice(at, at + 128), offset = array.length;
    array.push(chunk);
    if (pressure) batches.set(crypto.randomUUID(), {anchor: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(array, offset)), count: chunk.length / 2, q: pressure.slice(at / 2, (at + chunk.length) / 2).map(p => Math.round(255 * Math.max(0, Math.min(1,p))))});
  }
}
export function projectCanvas(props: Y.Map<unknown>): Record<string, unknown> {
  const projected = props.toJSON();
  const shapes = props.get('shapes');
  if (shapes instanceof Y.Map) shapes.forEach((shape, id) => {
    if (!(shape instanceof Y.Map)) return;
    const points = shape.get('points'), batches = shape.get('pressureBatches');
    if (points instanceof Y.Array && batches instanceof Y.Map) batches.forEach((batch, bid) => {
      const position = props.doc && Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(batch.anchor), props.doc);
      projected.shapes[id].pressureBatches[bid] = {pointOffset: position && position.type === points ? position.index / 2 : null, count: batch.count, q: [...batch.q]};
    });
  });
  return projected;
}
export function readScene(value: unknown): {shapes: Shape[]; diagnostics: string[]; editable: boolean} {
  const source = value instanceof Y.Map ? value.toJSON() : value;
  const diagnostics: string[] = [], shapes: Shape[] = [];
  if (!source || typeof source !== 'object') return {shapes, diagnostics: ['Missing canvas data'], editable: false};
  for (const raw of Object.values(source)) {
    const s = raw as Shape;
    if (!s || !['stroke','rect','arrow'].includes(s.kind) || s.shapeVersion !== 1 || !['x','y','w','h','basisW','basisH','strokeWidth'].every(k => typeof s[k] === 'number' && Number.isFinite(s[k])) || s.w < 0 || s.h < 0 || s.basisW <= 0 || s.basisH <= 0 || s.strokeWidth <= 0 || !Array.isArray(s.points) || s.points.length % 2 || !s.points.every(Number.isFinite)) {diagnostics.push('Unsupported or invalid object retained'); continue;}
    shapes.push(s);
  }
  shapes.sort((a,b) => String(a.ord).localeCompare(String(b.ord)) || a.id.localeCompare(b.id));
  const nested = value instanceof Y.Map && [...value.values()].every(s => s instanceof Y.Map && s.get('points') instanceof Y.Array && s.get('pressureBatches') instanceof Y.Map);
  return {shapes, diagnostics, editable: nested && !diagnostics.length};
}
export function pressureAt(shape: Y.Map<unknown>): Map<number, number> {
  const values = new Map<number, number>(), points = shape.get('points'), batches = shape.get('pressureBatches');
  if (!(points instanceof Y.Array) || !(batches instanceof Y.Map) || !shape.doc) return values;
  batches.forEach(batch => {
    try {
      if (!batch || !Array.isArray(batch.q) || !Number.isInteger(batch.count) || batch.count < 0 || batch.count > 64 || batch.q.length !== batch.count || !batch.q.every((q: unknown) => typeof q === 'number' && q >= 0 && q <= 255)) return;
      const pos = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(batch.anchor), shape.doc!);
      if (pos?.type === points && pos.index + batch.count * 2 <= points.length) for (let i = 0; i < batch.count; i++) values.set(pos.index / 2 + i, batch.q[i] / 255);
    } catch { /* Malformed pressure metadata falls back to constant width. */ }
  }); return values;
}
