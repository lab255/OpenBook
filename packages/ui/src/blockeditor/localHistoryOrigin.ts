import type * as Y from 'yjs';

// Only effect-owned, registered page history managers are known local origins.
const managers = new WeakMap<Y.Doc, Set<unknown>>();
export function registerLocalHistory(doc: Y.Doc, manager: unknown): () => void {
  let set = managers.get(doc);
  if (!set) { set = new Set(); managers.set(doc, set); }
  set.add(manager);
  return () => { set.delete(manager); };
}
export function isLocalEditOrigin(doc: Y.Doc, origin: unknown): boolean {
  return origin === 'local' || (managers.get(doc)?.has(origin) ?? false);
}
