import * as Y from 'yjs';
import {findBlock, rootBlocks, walkBlocks} from '../model';
import {registerLocalHistory} from '../localHistoryOrigin';
import {canvasDefaults, fixedFields, isEditableCanvas, isEditableShape, resolvePressureBatch, scalarValue, shapeDefaults, type Scalar} from './schema';

export const SEMANTIC_CANVAS = Symbol('semantic-canvas');
export const SEED_TOKEN = 'canvas:seed';
type StackItem = Y.UndoManager['undoStack'][number];
export interface CanvasChange {blockId: string; shapeId?: string; values: Readonly<Record<string, unknown>>}
interface Field {
  readonly blockId: string; readonly shapeId?: string; readonly key: string;
  readonly target: Y.Map<unknown>; readonly beforeValue: Scalar; readonly beforeToken: string;
  readonly afterValue: Scalar; readonly writtenToken: string;
}
export interface ErasedShape {
  readonly blockId: string; readonly shapeId: string;
  readonly scalars: Readonly<Record<string, Scalar>>;
  readonly tokens: Readonly<Record<string, string>>;
}
type Entry = {kind: 'scalar'; label: string; fields: readonly Field[]; applied: readonly Field[]} | {kind: 'root'; label: string; item: StackItem | null; erased: readonly ErasedShape[]};
export interface HistoryResult {label: string; appliedKeys: string[]; skippedKeys: string[]; reason: 'applied' | 'adjusted' | 'no-op' | 'read-only'; diagnostics?: readonly string[]}
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
  private erased: readonly ErasedShape[] = [];
  private repairDiagnostics: string[] = [];
  get diagnostics(): readonly string[] { return Object.freeze([...this.repairDiagnostics]); }
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
    this.past.push({kind: 'root', label, item: stackItem, erased: this.erased});
  };
  get writable(): boolean { return !this.disposed && this.canWrite(); }
  get availability(): {undo: string | null; redo: string | null} {
    return {undo: this.past[this.past.length - 1]?.label ?? null, redo: this.future[this.future.length - 1]?.label ?? null};
  }
  structural(label: string, mutate: () => void, erased: readonly ErasedShape[] = []): void {
    if (!this.writable) throw new Error('Read-only canvas');
    this.stopCapturing(); this.rootLabel = label; this.erased = Object.freeze([...erased]);
    try { this.doc.transact(mutate, 'local'); }
    finally { this.rootLabel = 'Edit page'; this.erased = []; this.stopCapturing(); }
  }
  stopCapturing(): void { this.manager.stopCapturing(); }
  /** Caches last only for one synchronous command/replay. Remote changes cannot
   * leave stale validity behind; each target and points array is checked once. */
  private resolver(): (blockId: string, shapeId?: string) => Y.Map<unknown> | null {
    const blocks = new Map<string, {props: Y.Map<unknown>; targets: Map<string | undefined, Y.Map<unknown> | null>} | null>();
    return (blockId, shapeId) => {
      if (!blocks.has(blockId)) {
        const props = findBlock(this.doc, blockId)?.block.get('props');
        blocks.set(blockId, isEditableCanvas(props) ? {props, targets: new Map()} : null);
      }
      const block = blocks.get(blockId);
      if (!block) return null;
      if (!block.targets.has(shapeId)) {
        const shape = shapeId === undefined ? block.props : (block.props.get('shapes') as Y.Map<unknown>).get(shapeId);
        block.targets.set(shapeId, shapeId === undefined || isEditableShape(shape, shapeId) ? shape as Y.Map<unknown> : null);
      }
      return block.targets.get(shapeId) ?? null;
    };
  }
  /** Capture valid pre-erase scalar/token pairs; root history retains the nested
   * point/pressure types. Missing fields after a concurrent erase/edit restore
   * must use this baseline, not reader defaults or the losing remote edit. */
  captureErase(blockId: string, shapeId: string): ErasedShape | null {
    const target = this.resolver()(blockId, shapeId);
    if (!target) return null;
    const scalars: Record<string, Scalar> = {}, tokens: Record<string, string> = {};
    for (const key of Object.keys(shapeDefaults)) {
      scalars[key] = scalarValue(key, target.get(key));
      tokens[key] = target.get(`op:${key}`) as string | undefined ?? SEED_TOKEN;
    }
    return Object.freeze({blockId, shapeId, scalars: Object.freeze(scalars), tokens: Object.freeze(tokens)});
  }

  private restoredShape(snapshot: ErasedShape): Y.Map<unknown> | null {
    const props = findBlock(this.doc, snapshot.blockId)?.block.get('props');
    if (!isEditableCanvas(props)) return null;
    const shape = (props.get('shapes') as Y.Map<unknown>).get(snapshot.shapeId);
    return shape instanceof Y.Map ? shape : null;
  }
  private repairRestored(erased: readonly ErasedShape[]): void {
    const missing: {shape: Y.Map<unknown>; snapshot: ErasedShape; key: string; value: Scalar; token: string}[] = [];
    for (const snapshot of erased) {
      const shape = this.restoredShape(snapshot);
      if (!shape) continue;
      for (const [key, value] of Object.entries(snapshot.scalars)) {
        if (!shape.has(key)) missing.push({shape, snapshot, key, value, token: snapshot.tokens[key]});
      }
    }
    const reanchor: {metadata: Y.Map<unknown>; batchId: string; context: string; value: unknown}[] = [];
    // Any root undo OR redo can recreate a points type, including page-level
    // block deletion. Recover from the LIVE batch via local redo pointers;
    // an old erase snapshot cannot know batches added between history legs.
    // This scan runs once per root dispatch, never in scalar command/replay.
    for (const {block} of walkBlocks(rootBlocks(this.doc))) {
      if (block.get('type') !== 'canvas') continue;
      const props = block.get('props');
      const shapes = props instanceof Y.Map ? props.get('shapes') : null;
      if (!(shapes instanceof Y.Map)) continue;
      for (const [shapeId, shape] of shapes) {
        if (!(shape instanceof Y.Map)) continue;
        const points = shape.get('points'), metadata = shape.get('pressureBatches');
        if (!(metadata instanceof Y.Map)) {
          this.repairDiagnostics.push(`Canvas ${block.get('id')} shape ${shapeId} batch <map>: missing pressure metadata map`);
          continue;
        }
        for (const [batchId, value] of metadata) {
          const context = `Canvas ${block.get('id')} shape ${shapeId} batch ${batchId}`;
          if (!(points instanceof Y.Array)) {
            this.repairDiagnostics.push(`${context}: missing points type; pressure repair skipped`);
            continue;
          }
          if (resolvePressureBatch(points, value, false)) continue;
          const batch = resolvePressureBatch(points, value, true);
          if (!batch) {
            this.repairDiagnostics.push(`${context}: anchor or batch is invalid; pressure repair skipped`);
            continue;
          }
          try {
            reanchor.push({metadata, batchId, context, value: {
              anchor: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(points, batch.offset * 2)),
              count: batch.q.length, q: batch.q,
            }});
          } catch {
            this.repairDiagnostics.push(`${context}: cannot create anchor; pressure repair skipped`);
          }
        }
      }
    }
    if (!missing.length && !reanchor.length) return;
    this.doc.transact(transaction => {
      transaction.meta.set(SEMANTIC_CANVAS, true);
      for (const {shape, snapshot, key, value, token} of missing) {
        try { shape.set(key, value); shape.set(`op:${key}`, token); }
        catch { this.repairDiagnostics.push(`Canvas ${snapshot.blockId} shape ${snapshot.shapeId} scalar ${key}: restore failed`); }
      }
      for (const {metadata, batchId, context, value} of reanchor) {
        // Recovery may replace values for existing IDs. Normal append still
        // never rewrites earlier batches. Diagnostics must not abort cleanup.
        try { metadata.set(batchId, value); }
        catch { this.repairDiagnostics.push(`${context}: cannot write anchor; pressure repair skipped`); }
      }
    }, 'local');
  }
  commitCanvasCommand(label: string, changes: readonly CanvasChange[]): HistoryResult {
    if (this.disposed || !this.canWrite()) return {label, appliedKeys: [], skippedKeys: [], reason: 'read-only'};
    // Validate the entire command before opening a transaction. Deduplicate grouped
    // updates: first current baseline, last proposed value for each field.
    const resolve = this.resolver();
    const fields = new Map<string, Field>();
    const skippedKeys: string[] = [];
    for (const change of changes) {
      const target = resolve(change.blockId, change.shapeId);
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
    this.repairDiagnostics = [];
    this.manager.stopCapturing(); this.replay = entry;
    try {
      if (entry.kind === 'root') {
        const stack = redo ? this.manager.redoStack : this.manager.undoStack;
        if (entry.item) {
          if (stack[stack.length - 1] !== entry.item) throw new Error('Canvas history root stack mismatch');
          if (redo && entry.erased.length) {
            // Redo is a NEW erase of the current shared shape: refresh scalar
            // baselines before it deletes peer edits made since the last undo.
            entry.erased = entry.erased.flatMap(snapshot => {
              const fresh = this.captureErase(snapshot.blockId, snapshot.shapeId);
              if (!fresh && this.restoredShape(snapshot)) this.repairDiagnostics.push(`Canvas ${snapshot.blockId} shape ${snapshot.shapeId}: invalid pre-erase scalar snapshot; skipped`);
              return fresh ? [fresh] : [];
            });
          }
          const older = stack.splice(0, stack.length - 1);
          entry.item = null;
          // Yjs has restored the root item at beforeObserverCalls, but has not
          // exposed it to type observers, afterTransaction, or update listeners.
          // A normal post-undo repair would expose incomplete geometry first.
          // 13.6.31 emits the original update from the live store, so its bytes
          // include this repair too (tested individually on a second provider).
          const erased = redo ? [] : entry.erased.filter(snapshot => !this.restoredShape(snapshot));
          const repair = (transaction: Y.Transaction): void => {
            if (transaction.origin !== this.manager) return;
            try { this.repairRestored(erased); }
            catch { this.repairDiagnostics.push('Canvas root restoration: repair interrupted; inspect scene diagnostics'); }
          };
          this.doc.on('beforeObserverCalls', repair);
          try {
            const popped = redo ? this.manager.redo() : this.manager.undo();
            if (popped) result.appliedKeys.push('@root');
          } finally { this.doc.off('beforeObserverCalls', repair); stack.unshift(...older); }
        }
      } else {
        const applied: Field[] = [];
        const resolve = this.resolver();
        this.doc.transact(transaction => {
          transaction.meta.set(SEMANTIC_CANVAS, true);
          for (const f of redo ? entry.applied : entry.fields) {
            const target = resolve(f.blockId, f.shapeId);
            const expected = redo ? f.beforeToken : f.writtenToken;
            if (!target || (target.get(`op:${f.key}`) ?? SEED_TOKEN) !== expected) {
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
      if (this.repairDiagnostics.length) result.diagnostics = this.diagnostics;
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
