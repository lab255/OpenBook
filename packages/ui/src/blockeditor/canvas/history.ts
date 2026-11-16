import * as Y from 'yjs';
import {findBlock, rootBlocks} from '../model';
import {registerLocalHistory} from '../localHistoryOrigin';
import {canvasDefaults, fixedFields, readCanvas, scalarValue, shapeDefaults, type Scalar} from './schema';

export const SEMANTIC_CANVAS = Symbol('semantic-canvas');
export const SEED_TOKEN = 'canvas:seed';
type StackItem = Y.UndoManager['undoStack'][number];
export interface CanvasChange {blockId: string; shapeId?: string; values: Readonly<Record<string, unknown>>}
interface Field {
  readonly blockId: string; readonly shapeId?: string; readonly key: string;
  readonly target: Y.Map<unknown>; readonly beforeValue: Scalar; readonly beforeToken: string;
  readonly afterValue: Scalar; readonly writtenToken: string;
}
type Entry = {kind: 'scalar'; label: string; fields: readonly Field[]; applied: readonly Field[]} | {kind: 'root'; label: string; item: StackItem | null};
export interface HistoryResult {label: string; appliedKeys: string[]; skippedKeys: string[]; reason: 'applied' | 'adjusted' | 'no-op' | 'read-only'}
const fieldName = (f: Field) => `${f.blockId}/${f.shapeId ?? '@canvas'}/${f.key}`;

/** One session-local journal over the existing root scope and semantic scalars. */
export class CanvasHistory {
  readonly manager: Y.UndoManager;
  private past: Entry[] = [];
  private future: Entry[] = [];
  private replay: Entry | null = null;
  private unregister: () => void;
  private disposed = false;
  private rootLabel = 'Edit page';
  constructor(readonly doc: Y.Doc, private readonly canWrite: () => boolean = () => true) {
    this.manager = new Y.UndoManager(rootBlocks(doc), {
      trackedOrigins: new Set(['local']), captureTimeout: 400,
      captureTransaction: transaction => !transaction.meta.has(SEMANTIC_CANVAS),
    });
    this.unregister = registerLocalHistory(doc, this.manager);
    this.manager.on('stack-item-added', this.onRoot);
    this.manager.on('stack-item-updated', this.onRoot);
  }
  private onRoot = ({stackItem}: {stackItem: StackItem}): void => {
    if (this.replay?.kind === 'root') { this.replay.item = stackItem; return; }
    if (this.replay) return;
    this.future = [];
    const last = this.past[this.past.length - 1];
    if (last?.kind === 'root' && last.item === stackItem) return;
    const label = String(stackItem.meta.get('label') ?? this.rootLabel);
    stackItem.meta.set('label', label);
    this.past.push({kind: 'root', label, item: stackItem});
  };
  get writable(): boolean { return !this.disposed && this.canWrite(); }
  get availability(): {undo: string | null; redo: string | null} {
    return {undo: this.past[this.past.length - 1]?.label ?? null, redo: this.future[this.future.length - 1]?.label ?? null};
  }
  structural(label: string, mutate: () => void): void {
    if (!this.writable) throw new Error('Read-only canvas');
    this.stopCapturing(); this.rootLabel = label;
    try { this.doc.transact(mutate, 'local'); }
    finally { this.rootLabel = 'Edit page'; this.stopCapturing(); }
  }
  stopCapturing(): void { this.manager.stopCapturing(); }
  private resolve(blockId: string, shapeId?: string): Y.Map<unknown> | null {
    const props = findBlock(this.doc, blockId)?.block.get('props');
    if (!(props instanceof Y.Map) || !readCanvas(props).editable) return null;
    if (shapeId === undefined) return props;
    const shapes = props.get('shapes');
    const shape = shapes instanceof Y.Map ? shapes.get(shapeId) : null;
    return shape instanceof Y.Map ? shape : null;
  }
  commitCanvasCommand(label: string, changes: readonly CanvasChange[]): HistoryResult {
    if (this.disposed || !this.canWrite()) return {label, appliedKeys: [], skippedKeys: [], reason: 'read-only'};
    // Validate the entire command before opening a transaction. Deduplicate grouped
    // updates: first current baseline, last proposed value for each field.
    const fields = new Map<string, Field>();
    const skippedKeys: string[] = [];
    for (const change of changes) {
      const target = this.resolve(change.blockId, change.shapeId);
      for (const [key, value] of Object.entries(change.values)) {
        if (change.shapeId === undefined ? !['height','background'].includes(key) : fixedFields.has(key)) throw new TypeError(`Immutable field ${key}`);
        const afterValue = scalarValue(key, value, change.shapeId === undefined);
        const name = `${change.blockId}/${change.shapeId ?? '@canvas'}/${key}`;
        if (!target) { skippedKeys.push(name); continue; }
        const rawToken = target.get(`op:${key}`);
        if (rawToken !== undefined && typeof rawToken !== 'string') { skippedKeys.push(name); continue; }
        const defaults = change.shapeId === undefined ? canvasDefaults : shapeDefaults;
        const beforeValue = scalarValue(key, target.get(key) ?? defaults[key], change.shapeId === undefined);
        if (Object.is(beforeValue, afterValue)) { fields.delete(name); continue; }
        fields.set(name, Object.freeze({blockId: change.blockId, shapeId: change.shapeId, key, target, beforeValue,
          beforeToken: rawToken as string | undefined ?? SEED_TOKEN, afterValue, writtenToken: crypto.randomUUID()}));
      }
    }
    if (!fields.size) return {label, appliedKeys: [], skippedKeys, reason: 'no-op'};
    const command: Entry = {kind: 'scalar', label, fields: Object.freeze([...fields.values()]), applied: []};
    this.manager.stopCapturing();
    this.manager.clear(false, true); this.future = [];
    this.doc.transact(transaction => {
      transaction.meta.set(SEMANTIC_CANVAS, true);
      for (const f of command.fields) { f.target.set(f.key, f.afterValue); f.target.set(`op:${f.key}`, f.writtenToken); }
    }, 'local');
    this.past.push(command); this.manager.stopCapturing();
    return {label, appliedKeys: [...fields.keys()], skippedKeys, reason: skippedKeys.length ? 'adjusted' : 'applied'};
  }
  undo(): HistoryResult { return this.dispatch(false); }
  redo(): HistoryResult { return this.dispatch(true); }
  private dispatch(redo: boolean): HistoryResult {
    const source = redo ? this.future : this.past, destination = redo ? this.past : this.future;
    const entry = source[source.length - 1];
    const result: HistoryResult = {label: entry?.label ?? '', appliedKeys: [], skippedKeys: [], reason: 'no-op'};
    if (this.disposed || !this.canWrite()) return {...result, reason: 'read-only'};
    if (!entry) return result;
    this.manager.stopCapturing(); this.replay = entry;
    try {
      if (entry.kind === 'root') {
        const stack = redo ? this.manager.redoStack : this.manager.undoStack;
        if (entry.item) {
          if (stack[stack.length - 1] !== entry.item) throw new Error('Canvas history root stack mismatch');
          const older = stack.splice(0, stack.length - 1);
          entry.item = null;
          try {
            const popped = redo ? this.manager.redo() : this.manager.undo();
            if (popped) result.appliedKeys.push('@root');
          } finally { stack.unshift(...older); }
        }
      } else {
        const applied: Field[] = [];
        this.doc.transact(transaction => {
          transaction.meta.set(SEMANTIC_CANVAS, true);
          for (const f of redo ? entry.applied : entry.fields) {
            const target = this.resolve(f.blockId, f.shapeId);
            const expected = redo ? f.beforeToken : f.writtenToken;
            if (!target || target !== f.target || (target.get(`op:${f.key}`) ?? SEED_TOKEN) !== expected) {
              result.skippedKeys.push(fieldName(f)); continue;
            }
            target.set(f.key, redo ? f.afterValue : f.beforeValue);
            target.set(`op:${f.key}`, redo ? f.writtenToken : f.beforeToken);
            applied.push(f); result.appliedKeys.push(fieldName(f));
          }
        }, 'local');
        if (!redo) entry.applied = Object.freeze(applied);
      }
      source.pop(); destination.push(entry);
      result.reason = result.appliedKeys.length ? result.skippedKeys.length ? 'adjusted' : 'applied' : 'no-op';
      return result;
    } finally { this.replay = null; this.manager.stopCapturing(); }
  }
  /** Pointerup-only publication: cancellation has no document/history mutation. */
  cancelPreview(): void { /* Caller discards its local preview and rereads readCanvas. */ }
  destroy(): void {
    this.disposed = true; this.unregister();
    this.manager.off('stack-item-added', this.onRoot); this.manager.off('stack-item-updated', this.onRoot);
    this.manager.destroy(); this.past = []; this.future = [];
  }
}
export function commitCanvasCommand(history: CanvasHistory, label: string, changes: readonly CanvasChange[]): HistoryResult {
  return history.commitCanvasCommand(label, changes);
}
