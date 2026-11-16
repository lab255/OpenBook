import type * as Y from 'yjs';

/** Synchronous app-only installation, before editors mount. The viewer leaves
 * this unset and keeps its existing root UndoManager and dispatch behavior. */
export interface EditorHistory {
  undo(): unknown;
  redo(): unknown;
  stopCapturing(): void;
  destroy(): void;
  readonly availability?: {undo: string | null; redo: string | null};
}
type HistoryFactory = (doc: Y.Doc, canWrite: () => boolean) => EditorHistory;
export let historyExtension: HistoryFactory | undefined;
export function registerHistoryExtension(factory: HistoryFactory): () => void {
  historyExtension = factory;
  return () => { if (historyExtension === factory) historyExtension = undefined; };
}
