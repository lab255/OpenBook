import * as Y from 'yjs';
import {keyBetween, keysBetween, ORDER_KEY_REBALANCE_LENGTH} from '@book.dev/sdk';
import {findBlock} from '../model';
import {CanvasHistory} from './history';
import {createShape, isEditableCanvas, isEditableShape, readCanvas} from './schema';

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
export function appendPoints(history: CanvasHistory, blockId: string, shapeId: string, values: readonly number[], pressures?: readonly number[]): void {
  const shape = writableShapes(history, blockId).get(shapeId);
  if (!shape) return;
  if (!isEditableShape(shape, shapeId)) throw new Error('Shape requires recovery');
  if (shape.get('kind') !== 'stroke' || values.length === 0 || values.length % 2 || values.length > 128 || !values.every(Number.isFinite)) throw new TypeError('Invalid point batch');
  const variable = shape.get('pressureMode') === 'variable';
  if (variable && (!pressures || pressures.length * 2 !== values.length || !pressures.every(Number.isFinite))) throw new TypeError('Invalid pressure batch');
  if (!variable && pressures) throw new TypeError('Constant stroke has no pressure metadata');
  const points = shape.get('points') as Y.Array<number>;
  const metadata = shape.get('pressureBatches') as Y.Map<unknown>;
  history.structural('Append points', () => {
    const start = points.length;
    points.push([...values]);
    if (variable) metadata.set(crypto.randomUUID(), {
      anchor: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(points, start)),
      count: values.length / 2, q: pressures!.map(p => Math.round(255 * Math.min(1, Math.max(0, p)))),
    });
  });
}
/** Place between adjacent entries in deterministic (ord,id) order. */
export function placementKey(history: CanvasHistory, blockId: string, beforeId: string | null, afterId: string | null): string {
  const shapes = writableShapes(history, blockId);
  const props = findBlock(history.doc, blockId)!.block.get('props');
  const scene = readCanvas(props);
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
