import * as Y from 'yjs';
import {rootBlocks, walkBlocks} from '../model';
import {isEditableShape, scalarValue, shapeDefaults} from './schema';
import type {ErasedShape} from './history';

export type CanvasScope = Map<string, Set<string>>;
export interface RootCapture {scope: CanvasScope; erased: ErasedShape[]}
interface TrackedShape {blockId: string; shapeId: string; snapshot: ErasedShape | null}
export function mergeScope(target: CanvasScope, source: CanvasScope): void {
  for (const [blockId, ids] of source) {
    const merged = target.get(blockId) ?? new Set<string>();
    ids.forEach(id => merged.add(id)); target.set(blockId, merged);
  }
}
function touch(scope: CanvasScope, shape: TrackedShape): void {
  mergeScope(scope, new Map([[shape.blockId, new Set([shape.shapeId])]]));
}
/** Retain validated preimages while types are live. Deleted nested maps cannot
 * be read in afterTransaction. Refresh only changed shapes, before the root
 * manager records that transaction; remote and semantic edits update this cache
 * too. The cache is session-local and retains scalar preimages only. */
export class CanvasRootCapture {
  private shapes = new Map<Y.Map<unknown>, TrackedShape>();
  constructor(private readonly doc: Y.Doc) { this.refresh(new Map(), new Set()); }
  private snapshot(shape: Y.Map<unknown>, blockId: string, shapeId: string): ErasedShape | null {
    if (!isEditableShape(shape, shapeId)) return null;
    const scalars: ErasedShape['scalars'] = Object.fromEntries(Object.keys(shapeDefaults).map(key => [key, scalarValue(key, shape.get(key))]));
    const tokens = Object.fromEntries(Object.keys(shapeDefaults).map(key => [key, shape.get(`op:${key}`) as string | undefined ?? 'canvas:seed']));
    return {blockId, shapeId, scalars, tokens};
  }
  private refresh(scope: CanvasScope, changed: Set<Y.Map<unknown>>): ErasedShape[] {
    const next = new Map<Y.Map<unknown>, TrackedShape>();
    for (const {block} of walkBlocks(rootBlocks(this.doc))) {
      if (block.get('type') !== 'canvas') continue;
      const blockId = block.get('id');
      const props = block.get('props'), shapes = props instanceof Y.Map ? props.get('shapes') : null;
      if (typeof blockId !== 'string' || !(shapes instanceof Y.Map)) continue;
      for (const [shapeId, shape] of shapes) {
        if (!(shape instanceof Y.Map)) continue;
        const old = this.shapes.get(shape);
        const record = old && !changed.has(shape) ? old : {blockId, shapeId, snapshot:this.snapshot(shape,blockId,shapeId)};
        next.set(shape, record);
        if (!old) touch(scope,record);
      }
    }
    const erased: ErasedShape[] = [];
    for (const [shape, record] of this.shapes) if (!next.has(shape)) {
      touch(scope,record);
      if (record.snapshot) erased.push(record.snapshot);
    }
    this.shapes = next;
    return erased;
  }
  inspect(transaction: Y.Transaction): RootCapture {
    const scope: CanvasScope = new Map(), changed = new Set<Y.Map<unknown>>();
    let topology = false;
    for (const type of transaction.changed.keys()) {
      let parent: typeof type | null = type;
      while (parent && (!(parent instanceof Y.Map) || !this.shapes.has(parent))) parent = parent.parent;
      if (parent instanceof Y.Map) {
        touch(scope,this.shapes.get(parent)!); changed.add(parent);
      } else {
        // Root arrays and untracked/malformed types have no tracked shape map.
        // Refresh membership without interpreting them as shapes; readCanvas
        // quarantines malformed entries with a shape-named diagnostic.
        topology = true;
      }
    }
    if (topology) return {scope, erased:this.refresh(scope,changed)};
    for (const shape of changed) {
      const record = this.shapes.get(shape)!;
      record.snapshot = this.snapshot(shape,record.blockId,record.shapeId);
    }
    return {scope, erased:[]};
  }
}
