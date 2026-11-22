import * as Y from 'yjs';
import {keyBetween, keysBetween, ORDER_KEY_REBALANCE_LENGTH} from '@book.dev/sdk';
import {findBlock} from '../model';
import {CanvasHistory} from './history';
import {createShape, isEditableCanvas, isEditableShape, readCanvas, validatePointValues, type PointData} from './schema';

function writableShapes(history: CanvasHistory, blockId: string): Y.Map<Y.Map<unknown>> {
  if (!history.writable) throw new Error('Read-only canvas');
  const props = findBlock(history.doc, blockId)?.block.get('props');
  if (!isEditableCanvas(props)) throw new Error('Canvas requires recovery');
  return props.get('shapes') as Y.Map<Y.Map<unknown>>;
}
export function insertShape(history: CanvasHistory, blockId: string, input: Record<string, unknown>): string {
  const shapes = writableShapes(history, blockId);
  const id = typeof input.id === 'string' ? input.id : crypto.randomUUID();
  if (shapes.has(id)) throw new Error('Duplicate shape id');
  const shape = createShape({...input, id});
  history.structural('Create shape', () => shapes.set(id, shape));
  return id;
}
export function eraseShape(history: CanvasHistory, blockId: string, shapeId: string): void {
  const shapes = writableShapes(history, blockId);
  if (!shapes.has(shapeId)) return;
  const snapshot = history.captureErase(blockId, shapeId);
  if (!snapshot) throw new Error('Shape requires recovery');
  history.structural('Erase shape', () => shapes.delete(shapeId), [snapshot]);
}
export function appendPoints(history: CanvasHistory, blockId: string, shapeId: string, data: PointData): void {
  const shape = writableShapes(history, blockId).get(shapeId);
  if (!shape) return;
  if (!isEditableShape(shape, shapeId)) throw new Error('Shape requires recovery');
  if (!data || ![2,3].includes(data.pointArity)) throw new TypeError('Tagged points required');
  validatePointValues(data.points, shape.get('pressureMode'), data.pointArity);
  if (shape.get('kind') !== 'stroke' || data.points.length === 0 || data.points.length / data.pointArity > 64) throw new TypeError('Invalid point batch');
  const points = shape.get('points') as Y.Array<number>;
  history.structural('Append points', () => points.push([...data.points]));
}
/** Place between adjacent entries in deterministic (ord,id) order. */
export function placementKey(history: CanvasHistory, blockId: string, beforeId: string | null, afterId: string | null, movingIds: readonly string[] = []): string {
  const shapes = writableShapes(history, blockId);
  const props = findBlock(history.doc, blockId)!.block.get('props');
  const current = readCanvas(props);
  const scene = {...current, shapes: current.shapes.filter(s=>!movingIds.includes(s.id))};
  const left = beforeId === null ? -1 : scene.shapes.findIndex(s => s.id === beforeId);
  const right = afterId === null ? scene.shapes.length : scene.shapes.findIndex(s => s.id === afterId);
  if ((beforeId !== null && left < 0) || right < 0 || right !== left + 1) throw new RangeError('Placement bounds must be adjacent');
  const ord = (id: string | null): string | null => id === null ? null : shapes.get(id)!.get('ord') as string;
  if ((beforeId !== null && afterId !== null && ord(beforeId) === ord(afterId)) || scene.shapes.some(s => String(s.scalars.ord).length > ORDER_KEY_REBALANCE_LENGTH)) {
    // Full-axis balancing is deterministic and also balances the tied run.
    const keys = keysBetween(null, null, scene.shapes.length);
    history.commitCanvasCommand('Rebalance shapes', scene.shapes.map((s,i) => ({blockId, shapeId: s.id, values: {ord: keys[i]}})));
  }
  return keyBetween(ord(beforeId), ord(afterId));
}

/** One structural journal entry for a whole creation/duplicate/erase gesture. */
export function insertShapes(history:CanvasHistory,blockId:string,inputs:readonly Record<string,unknown>[],label:string):string[] {
  const shapes=writableShapes(history,blockId);
  const prepared=inputs.map(input=>{const id=crypto.randomUUID();return {id,shape:createShape({...input,id})};});
  history.structural(label,()=>{for(const {id,shape} of prepared)shapes.set(id,shape);});
  return prepared.map(p=>p.id);
}
export function eraseShapes(history:CanvasHistory,blockId:string,ids:readonly string[]):void {
  const shapes=writableShapes(history,blockId);
  const snapshots=ids.filter(id=>shapes.has(id)).map(id=>history.captureErase(blockId,id));
  if(snapshots.some(s=>!s))throw new Error('Shape requires recovery');
  if(!snapshots.length)return;
  history.structural('Erase',()=>{for(const id of ids)shapes.delete(id);},snapshots.filter((s):s is NonNullable<typeof s>=>s!==null));
}
