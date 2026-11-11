import * as Y from 'yjs';

export const SEMANTIC = Symbol('canvas semantic transaction');
const localManagers = new WeakSet<object>();
/** Only managers registered by our editor are genuine local history origins. */
export const isLocalHistoryOrigin = (origin: unknown): boolean => typeof origin === 'object' && origin !== null && localManagers.has(origin);
const histories = new WeakMap<Y.Doc, CanvasHistory>();
export const canvasHistory = (doc: Y.Doc): CanvasHistory | undefined => histories.get(doc);
type StackItem = Y.UndoManager['undoStack'][number];
type Field = {target: Y.Map<unknown>; resolve: () => Y.Map<unknown> | undefined; key: string; before: unknown; beforeToken: unknown; after: unknown; token: string};
type Entry = {kind: 'root'; item: StackItem | null; label: string} | {kind: 'scalar'; fields: Field[]; applied?: Field[]; label: string};
export interface HistoryResult {label: string; appliedKeys: number; skippedKeys: number; reason: string}
export interface ScalarEdit {target: Y.Map<unknown>; resolve: () => Y.Map<unknown> | undefined; values: Record<string, unknown>}

export class CanvasHistory {
  readonly manager: Y.UndoManager;
  readonly past: Entry[] = [];
  readonly future: Entry[] = [];
  result: HistoryResult = {label: '', appliedKeys: 0, skippedKeys: 0, reason: ''};
  private replaying = false;
  private label = 'page edit';
  constructor(readonly doc: Y.Doc, root: Y.Array<Y.Map<unknown>>) {
    this.manager = new Y.UndoManager(root, {trackedOrigins: new Set(['local']), captureTimeout: 400, captureTransaction: t => !t.meta.has(SEMANTIC)});
    localManagers.add(this.manager);
    histories.set(doc, this);
    const record = ({stackItem}: {stackItem: StackItem}) => {
      if (this.replaying) return;
      this.future.length = 0;
      stackItem.meta.set('label', this.label);
      const last = this.past[this.past.length - 1];
      if (!last || last.kind !== 'root' || last.item !== stackItem) this.past.push({kind: 'root', item: stackItem, label: this.label});
    };
    this.manager.on('stack-item-added', record);
    this.manager.on('stack-item-updated', record);
  }
  destroy(): void {this.manager.destroy(); localManagers.delete(this.manager); if (histories.get(this.doc) === this) histories.delete(this.doc);}
  stopCapturing(): void {this.manager.stopCapturing();}
  structural(label: string, mutate: () => void, readOnly = false): void {
    if (readOnly) return;
    this.stopCapturing(); this.label = label;
    try {this.doc.transact(mutate, 'local');} finally {this.label = 'page edit'; this.stopCapturing();}
  }
  commitCanvasCommand(label: string, edits: ScalarEdit[], readOnly = false): void {
    if (readOnly) return;
    const fields: Field[] = [];
    for (const edit of edits) {
      if (edit.resolve() !== edit.target) continue;
      for (const [key, after] of Object.entries(edit.values)) {
        if (key.startsWith('op:') || key === 'points' || key === 'pressureBatches') throw new Error('Not a scalar field');
        if (typeof after === 'number' && (!Number.isFinite(after) || (['w','h'].includes(key) && after < 0))) throw new Error('Invalid geometry');
        const before = edit.target.get(key);
        if (before === undefined) throw new Error(`Missing before-value: ${key}`);
        if (before === after) continue;
        fields.push({target: edit.target, resolve: edit.resolve, key, before, beforeToken: edit.target.get(`op:${key}`) ?? 'seed', after, token: crypto.randomUUID()});
      }
    }
    if (!fields.length) return;
    this.stopCapturing(); this.future.length = 0; this.manager.clear(false, true);
    this.doc.transact(t => {t.meta.set(SEMANTIC, true); for (const f of fields) {f.target.set(f.key, f.after); f.target.set(`op:${f.key}`, f.token);}}, 'local');
    this.past.push({kind: 'scalar', fields, label}); this.stopCapturing();
  }
  undo(readOnly = false): void {this.dispatch(false, readOnly);}
  redo(readOnly = false): void {this.dispatch(true, readOnly);}
  private dispatch(redo: boolean, readOnly: boolean): void {
    if (readOnly) return;
    const source = redo ? this.future : this.past, destination = redo ? this.past : this.future;
    const entry = source.pop(); if (!entry) return;
    this.stopCapturing(); this.replaying = true;
    let applied = 0, skipped = 0;
    try {
      if (entry.kind === 'scalar') {
        const candidates = redo ? entry.applied ?? [] : entry.fields;
        const eligible: Field[] = [];
        this.doc.transact(t => {
          t.meta.set(SEMANTIC, true);
          for (const f of candidates) {
            const target = f.resolve();
            if (target !== f.target || (target.get(`op:${f.key}`) ?? 'seed') !== (redo ? f.beforeToken : f.token)) {skipped++; continue;}
            target.set(f.key, redo ? f.after : f.before);
            target.set(`op:${f.key}`, redo ? f.token : f.beforeToken);
            eligible.push(f); applied++;
          }
        }, 'local');
        if (!redo) entry.applied = eligible;
      } else if (entry.item) {
        // Raw Yjs skips no-op items. Isolate exactly this journal entry so it
        // cannot jump across a semantic operation to an older page edit.
        const stack = redo ? this.manager.redoStack : this.manager.undoStack;
        const opposite = redo ? this.manager.undoStack : this.manager.redoStack;
        const index = stack.indexOf(entry.item);
        if (index !== stack.length - 1) throw new Error('History journal/root stack drift');
        const older = stack.splice(0, index);
        try {const result = redo ? this.manager.redo() : this.manager.undo(); entry.item = result ? opposite[opposite.length - 1] : null; applied = result ? 1 : 0;}
        finally {stack.unshift(...older);}
      }
      destination.push(entry);
      this.result = {label: `${redo ? 'Redo' : 'Undo'} ${entry.label}`, appliedKeys: applied, skippedKeys: skipped,
        reason: skipped ? (applied ? 'Adjusted because this object changed' : 'Nothing changed; this object changed') : applied ? 'Applied' : 'Nothing changed'};
    } finally {this.replaying = false; this.stopCapturing();}
  }
}
