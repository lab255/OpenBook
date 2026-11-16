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
    else if (key !== 'points' && key !== 'pressureBatches' && !key.startsWith('op:')) shape.set(key, value);
  }
  const points = new Y.Array<number>();
  const values = input.points ?? [];
  if (!Array.isArray(values) || values.length % 2 || !values.every(v => typeof v === 'number' && Number.isFinite(v))) throw new TypeError('Invalid points');
  if (values.length && (input.kind ?? 'rect') !== 'stroke') throw new TypeError('Only strokes have points');
  if (values.length && input.pressureMode === 'variable') throw new TypeError('Append pressure points with their metadata after insertion');
  points.push(values);
  shape.set('points', points); shape.set('pressureBatches', new Y.Map());
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
export interface SceneShape {readonly id: string; readonly scalars: Readonly<Record<string, Scalar>>; readonly points: readonly number[]}
export interface Scene {readonly shapes: readonly SceneShape[]; readonly diagnostics: readonly string[]; readonly editable: boolean}
/** Defensive, non-mutating reader. Malformed objects remain in source for recovery. */
export function readCanvas(props: unknown): Scene {
  const diagnostics: string[] = [];
  const shapes: SceneShape[] = [];
  let editable = props instanceof Y.Map && get(props, 'shapes') instanceof Y.Map && get(props, 'canvasVersion') === 1;
  if (!editable) diagnostics.push('Canvas requires a common v1 binary identity before editing');
  for (const key of Object.keys(canvasDefaults)) {
    try { scalarValue(key, get(props, key) ?? canvasDefaults[key], true); } catch { editable = false; diagnostics.push(`Invalid canvas ${key}`); }
  }
  for (const [id, source] of entries(get(props, 'shapes'))) {
    try {
      const scalars: Record<string, Scalar> = {};
      for (const [key, fallback] of Object.entries(shapeDefaults)) scalars[key] = scalarValue(key, get(source, key) ?? fallback);
      if (get(source, 'id') !== id || get(source, 'shapeVersion') !== 1) throw new TypeError('Identity/version');
      const raw = get(source, 'points');
      const points: unknown = raw instanceof Y.Array ? raw.toArray() : raw;
      if (!Array.isArray(points) || points.length % 2 || !points.every(p => typeof p === 'number' && Number.isFinite(p))) throw new TypeError('Points');
      if (!(source instanceof Y.Map) || !(raw instanceof Y.Array) || !(get(source, 'pressureBatches') instanceof Y.Map)) editable = false;
      for (const key of Object.keys(shapeDefaults)) if (get(source, key) === undefined) editable = false;
      shapes.push(Object.freeze({id, scalars: Object.freeze(scalars), points: Object.freeze(points.slice() as number[])}));
    } catch { editable = false; diagnostics.push(`Quarantined shape ${id}`); }
  }
  shapes.sort((a,b) => String(a.scalars.ord) < String(b.scalars.ord) ? -1 : String(a.scalars.ord) > String(b.scalars.ord) ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return Object.freeze({shapes: Object.freeze(shapes), diagnostics: Object.freeze(diagnostics), editable});
}

/** Resolve pressure against the same points identity, never a parallel index array. */
export function readPressure(shape: Y.Map<unknown>): {batches: {offset: number; q: number[]}[]; degraded: boolean} {
  const points = shape.get('points'), metadata = shape.get('pressureBatches');
  const batches: {offset: number; q: number[]}[] = [];
  let degraded = false;
  if (!(points instanceof Y.Array) || !(metadata instanceof Y.Map) || !points.doc) return {batches, degraded: true};
  for (const value of metadata.values()) {
    try {
      const {anchor, count, q} = value as {anchor: Parameters<typeof Y.createRelativePositionFromJSON>[0]; count: number; q: number[]};
      const position = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(anchor), points.doc);
      if (!position || position.type !== points || position.index % 2 || !Number.isInteger(count) || count < 1 || count > 64 || position.index + count * 2 > points.length || !Array.isArray(q) || q.length !== count || !q.every(p => Number.isInteger(p) && p >= 0 && p <= 255)) throw new TypeError('Pressure batch');
      batches.push({offset: position.index / 2, q: q.slice()});
    } catch { degraded = true; }
  }
  if (shape.get('pressureMode') === 'variable' && batches.reduce((sum,b) => sum + b.q.length,0) * 2 !== points.length) degraded = true;
  return {batches, degraded};
}
