/** Pressure shares each point's lifecycle: constant strokes store x,y pairs;
 * variable strokes store x,y,q triplets. Future decimation must retain each
 * selected point's q and pressure extrema (architecture §7). Binary arity is
 * derived from creation-fixed pressureMode; JSON alone carries pointArity. */
import * as Y from 'yjs';
import {isOrderKey, keyBetween} from '@book.dev/sdk';

export type Scalar = string | number;
export const shapeDefaults: Readonly<Record<string, Scalar>> = Object.freeze({
  id: '', kind: 'rect', shapeVersion: 1, name: '', ord: keyBetween(null, null),
  x: 0, y: 0, w: 1, h: 1, stroke: '#000000', fill: 'none', strokeWidth: 3,
  opacity: 1, dash: 'solid', basisW: 1, basisH: 1, text: '', fontSize: 16,
  fontFamily: 'sans', textAlign: 'left', startX: 0, startY: 0, endX: 1, endY: 1,
  startHead: 'none', endHead: 'arrow', pressureMode: 'constant',
});
export const canvasDefaults: Readonly<Record<string, Scalar>> = Object.freeze({canvasVersion: 1, height: 360, background: '#ffffff'});
export const fixedFields = new Set(['id', 'kind', 'shapeVersion', 'basisW', 'basisH', 'pressureMode']);
const enums: Record<string, readonly string[]> = {
  kind: ['stroke', 'rect', 'ellipse', 'arrow', 'text'], dash: ['solid', 'dashed'],
  fontFamily: ['sans', 'serif', 'mono'], textAlign: ['left', 'center', 'right'],
  startHead: ['none', 'arrow'], endHead: ['none', 'arrow'], pressureMode: ['constant', 'variable'],
};
export function scalarValue(key: string, value: unknown, canvas = false): Scalar {
  const fallback = (canvas ? canvasDefaults : shapeDefaults)[key];
  if (fallback === undefined || typeof value !== typeof fallback) throw new TypeError(`Invalid ${key}`);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Non-finite ${key}`);
    if (key === 'w' || key === 'h') return Math.max(0, value);
    if (['basisW', 'basisH', 'strokeWidth', 'fontSize'].includes(key) && value <= 0) throw new RangeError(`Non-positive ${key}`);
    if (key === 'height') return Math.min(960, Math.max(240, value));
    if (key === 'opacity') return Math.min(1, Math.max(0, value));
    if (key.endsWith('Version') && value !== 1) throw new RangeError(`Unsupported ${key}`);
    return value;
  }
  if (typeof value !== 'string' || (enums[key] && !enums[key].includes(value))) throw new TypeError(`Invalid ${key}`);
  if (key === 'ord' && !isOrderKey(value)) throw new TypeError('Invalid ord');
  return value;
}
export function createShape(input: Record<string, unknown> = {}): Y.Map<unknown> {
  const shape = new Y.Map<unknown>();
  for (const [key, value] of Object.entries({...shapeDefaults, id: crypto.randomUUID(), ...input})) {
    if (key in shapeDefaults) shape.set(key, scalarValue(key, value));
    else if (key !== 'points' && key !== 'pointArity' && !key.startsWith('op:')) shape.set(key, value);
  }
  const points = new Y.Array<number>();
  const values = input.points ?? [];
  if (input.points !== undefined && input.pressureMode === 'variable' && input.pointArity !== 3) throw new TypeError('Variable points require explicit pointArity: 3');
  validatePointValues(values, input.pressureMode ?? 'constant', input.pointArity);
  if ((values as number[]).length && (input.kind ?? 'rect') !== 'stroke') throw new TypeError('Only strokes have points');
  points.push(values as number[]);
  shape.set('points', points);
  return shape;
}
export function createCanvasProps(): Y.Map<unknown> {
  const props = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(canvasDefaults)) props.set(key, value);
  props.set('shapes', new Y.Map());
  return props;
}
export const get = (object: unknown, key: string): unknown => object instanceof Y.Map ? object.get(key) : object && typeof object === 'object' ? (object as Record<string, unknown>)[key] : undefined;
const entries = (object: unknown): [string, unknown][] => object instanceof Y.Map ? [...object.entries()] : object && typeof object === 'object' && !Array.isArray(object) ? Object.entries(object) : [];
export interface PointData {readonly pointArity: 2 | 3; readonly points: readonly number[]}
export interface SceneShape extends PointData {readonly id: string; readonly scalars: Readonly<Record<string, Scalar>>}
export interface Scene {readonly shapes: readonly SceneShape[]; readonly diagnostics: readonly string[]; readonly editable: boolean}
/** Mutation validation touches only the addressed canvas/shape, never builds a scene. */
export function isEditableCanvas(props: unknown): props is Y.Map<unknown> {
  if (!(props instanceof Y.Map) || !(props.get('shapes') instanceof Y.Map)) return false;
  try {
    for (const key of Object.keys(canvasDefaults)) scalarValue(key, props.get(key), true);
    return true;
  } catch { return false; }
}
export function isEditableShape(shape: unknown, id: string): shape is Y.Map<unknown> {
  if (!(shape instanceof Y.Map) || shape.get('id') !== id) return false;
  try {
    for (const key of Object.keys(shapeDefaults)) {
      scalarValue(key, shape.get(key));
      const token = shape.get(`op:${key}`);
      if (token !== undefined && typeof token !== 'string') return false;
    }
    const points = shape.get('points');
    if (!(points instanceof Y.Array)) return false;
    validatePointValues(points.toArray(), shape.get('pressureMode'), shape.get('pointArity'));
    return true;
  } catch { return false; }
}
/** Defensive, non-mutating reader. Malformed objects remain in source for recovery. */
export function readCanvas(props: unknown): Scene {
  const diagnostics: string[] = [];
  const shapes: SceneShape[] = [];
  let editable = props instanceof Y.Map && get(props, 'shapes') instanceof Y.Map && get(props, 'canvasVersion') === 1;
  if (!editable) diagnostics.push('Canvas requires a common v1 binary identity before editing');
  for (const key of Object.keys(canvasDefaults)) {
    try { scalarValue(key, get(props, key), true); } catch { editable = false; diagnostics.push(`Invalid canvas ${key}`); }
  }
  for (const [id, source] of entries(get(props, 'shapes'))) {
    try {
      const scalars: Record<string, Scalar> = {};
      const missing = Object.keys(shapeDefaults).filter(key => get(source, key) === undefined);
      for (const key of missing) diagnostics.push(`Shape ${id}: missing required scalar ${key}`);
      if (missing.length) throw new TypeError('Missing required scalars');
      for (const key of Object.keys(shapeDefaults)) scalars[key] = scalarValue(key, get(source, key));
      if (get(source, 'id') !== id || get(source, 'shapeVersion') !== 1) throw new TypeError('Identity/version');
      const raw = get(source, 'points');
      const points: unknown = raw instanceof Y.Array ? raw.toArray() : raw;
      validatePointValues(points, scalars.pressureMode, source instanceof Y.Map ? get(source, 'pointArity') : get(source, 'pointArity') ?? 2);
      if (!(source instanceof Y.Map) || !(raw instanceof Y.Array)) editable = false;
      shapes.push(Object.freeze({id, scalars: Object.freeze(scalars), pointArity: scalars.pressureMode === 'variable' ? 3 : 2, points: Object.freeze((points as number[]).slice())}));
    } catch (error) { editable = false; diagnostics.push(`Quarantined shape ${id}: ${error instanceof Error ? error.message : 'invalid shape'}`); }
  }
  shapes.sort((a,b) => String(a.scalars.ord) < String(b.scalars.ord) ? -1 : String(a.scalars.ord) > String(b.scalars.ord) ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return Object.freeze({shapes: Object.freeze(shapes), diagnostics: Object.freeze(diagnostics), editable});
}

/** Shared binary/JSON validation: never interpret malformed triplets as pairs. */
export function validatePointValues(values: unknown, mode: unknown, projectedArity?: unknown): asserts values is number[] {
  if (mode !== 'constant' && mode !== 'variable') throw new TypeError('Invalid pressureMode');
  const arity = mode === 'variable' ? 3 : 2;
  if (projectedArity !== undefined && projectedArity !== arity) throw new TypeError('pointArity disagrees with pressureMode');
  if (!Array.isArray(values) || values.length % arity) throw new TypeError(`Points length must be divisible by arity ${arity}`);
  for (let i = 0; i < values.length; i++) {
    if (typeof values[i] !== 'number' || !Number.isFinite(values[i])) throw new TypeError(`Non-finite point value at ${i}`);
    if (arity === 3 && i % 3 === 2 && (!Number.isInteger(values[i]) || values[i] < 0 || values[i] > 255)) throw new TypeError(`Invalid pressure q at ${i}`);
  }
}
/** Malformed pressure quarantines the shape; there is no constant-width default. */
export function readPressure(shape: Y.Map<unknown>): {q: number[]; degraded: boolean; diagnostics: string[]} {
  try {
    const points = shape.get('points');
    if (!(points instanceof Y.Array)) throw new TypeError('Missing points type');
    const values = points.toArray();
    validatePointValues(values, shape.get('pressureMode'), shape.get('pointArity'));
    return {q: shape.get('pressureMode') === 'variable' ? values.filter((_,i) => i % 3 === 2) : [], degraded:false, diagnostics:[]};
  } catch (error) {
    return {q:[], degraded:true, diagnostics:[`Shape ${String(shape.get('id'))}: ${error instanceof Error ? error.message : 'invalid points'}`]};
  }
}
/** Additive per-shape marker for defensive JSON/fallback readers. Binary data
 * stores no pointArity key; mixed canvases freely contain both representations. */
export function projectCanvas(props: Y.Map<unknown>): Record<string, unknown> {
  const projection = props.toJSON();
  const shapes = props.get('shapes');
  if (shapes instanceof Y.Map) for (const [id, shape] of shapes) {
    if (shape instanceof Y.Map) projection.shapes[id].pointArity = shape.get('pressureMode') === 'variable' ? 3 : 2;
  }
  return projection;
}

/** App construction seam: projected clones regain fresh nested CRDT types.
 * Preserve scalar tokens and unknown fields, but never persist JSON's arity tag. */
export function constructCanvasProps(input: Record<string, unknown>): Y.Map<unknown> {
  const props = new Y.Map<unknown>(Object.entries(input).filter(([key]) => key !== 'shapes'));
  const shapes = new Y.Map<unknown>();
  for (const [id, value] of entries(input.shapes)) {
    const data = value instanceof Y.Map ? {...value.toJSON(), pointArity: value.get('pressureMode') === 'variable' ? 3 : 2} : value as Record<string, unknown>;
    const shape = createShape({...data, id});
    for (const [key, token] of Object.entries(data)) if (key.startsWith('op:')) shape.set(key, token);
    shapes.set(id, shape);
  }
  props.set('shapes', shapes);
  return props;
}

/** Input conversion only; create and append both consume tagged stored values. */
export function pointData(xy: readonly number[], pressures?: readonly number[]): PointData {
  if (xy.length % 2 || !xy.every(Number.isFinite)) throw new TypeError('Invalid point coordinates');
  if (pressures && (pressures.length * 2 !== xy.length || !pressures.every(Number.isFinite))) throw new TypeError('Invalid pressure samples');
  return pressures ? {pointArity: 3, points: pressures.flatMap((p, i) => [xy[i*2], xy[i*2+1], Math.round(255 * Math.min(1, Math.max(0, p)))])} : {pointArity: 2, points: [...xy]};
}
