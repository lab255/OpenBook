import * as Y from 'yjs';
import type {DataClient, StoredPage} from '@book.dev/sdk';
import {decodeSnapshot, encodeSnapshot, type BlockDocSnapshot} from '@/blockeditor/model';

export type StoredPageClient = Pick<DataClient, 'getPage' | 'savePage' | 'applyPageUpdate'>;

/** Persist only this mutation when supported; older/local stores re-read before saving. */
export async function saveStoredPageUpdate(
  client: StoredPageClient, page: StoredPage, doc: Y.Doc,
  assertStore: () => void = () => {},
): Promise<void> {
  assertStore();
  // JSON-only legacy snapshots have no shared CRDT identities to address with a delta.
  const storedUpdate = (page.data.blockdoc as BlockDocSnapshot | undefined)?.update;
  if (storedUpdate && client.applyPageUpdate) {
    // Decode may add an empty-page placeholder. Diff against the stored vector,
    // not the reconstructed doc, so those new dependencies travel with the edit.
    const stateVector = Y.encodeStateVectorFromUpdate(Uint8Array.from(atob(storedUpdate), (c) => c.charCodeAt(0)));
    const delta = Y.encodeStateAsUpdate(doc, stateVector);
    let binary = '';
    for (const byte of delta) binary += String.fromCharCode(byte);
    const applied = await client.applyPageUpdate(page.id, btoa(binary), doc.clientID);
    assertStore();
    if (applied) return;
  }
  const latest = await client.getPage(page.id);
  assertStore();
  if (!latest) throw Object.assign(new Error('page no longer exists'), {status: 404});
  const merged = decodeSnapshot(latest.data.blockdoc as BlockDocSnapshot | undefined);
  try {
    // A legacy snapshot was independently reconstructed, so preserve the mutated
    // document's projection rather than merging unrelated synthetic identities.
    if ((page.data.blockdoc as BlockDocSnapshot | undefined)?.update) {
      Y.applyUpdate(merged, Y.encodeStateAsUpdate(doc));
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(merged));
    }
    await client.savePage({id: page.id, name: latest.name, data: {...latest.data, editor: 'blocks', blockdoc: encodeSnapshot(doc)}});
    assertStore();
  } finally { merged.destroy(); }
}
