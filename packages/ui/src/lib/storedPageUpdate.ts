import * as Y from 'yjs';
import type {DataClient, StoredPage} from '@book.dev/sdk';
import {decodeSnapshot, encodeSnapshot, type BlockDocSnapshot} from '@/blockeditor/model';

export type StoredPageClient = Pick<DataClient, 'getPage' | 'savePage' | 'applyPageUpdate'>;

/** Own the read/mutate/delta cycle. The caller destroys the returned document. */
export async function saveStoredPageUpdate(
  client: StoredPageClient, pageId: string, mutate: (doc: Y.Doc) => void,
  assertStore: () => void = () => {},
): Promise<{doc: Y.Doc; page: StoredPage}> {
  const read = async () => {
    assertStore();
    const page = await client.getPage(pageId);
    assertStore();
    if (!page) throw Object.assign(new Error('page no longer exists'), {status: 404});
    return page;
  };
  for (let attempt = 0; ; attempt++) {
    const page = await read();
    let doc = decodeSnapshot(page.data.blockdoc as BlockDocSnapshot | undefined);
    try {
      mutate(doc);
      const storedUpdate = (page.data.blockdoc as BlockDocSnapshot | undefined)?.update;
      if (storedUpdate && client.applyPageUpdate) {
        // Include any placeholder dependencies added by decoding an empty document.
        const sv = Y.encodeStateVectorFromUpdate(Uint8Array.from(atob(storedUpdate), (c) => c.charCodeAt(0)));
        const delta = Y.encodeStateAsUpdate(doc, sv);
        let binary = '';
        for (const byte of delta) binary += String.fromCharCode(byte);
        let applied: boolean;
        try {
          applied = await client.applyPageUpdate(pageId, btoa(binary), doc.clientID);
        } catch (error) {
          assertStore();
          if ((error as {status?: number}).status !== 409 || attempt === 1) throw error;
          doc.destroy();
          continue;
        }
        assertStore();
        if (applied) return {doc, page};
      }
      const latest = await read();
      const merged = decodeSnapshot(latest.data.blockdoc as BlockDocSnapshot | undefined);
      try {
        if (storedUpdate && (latest.data.blockdoc as BlockDocSnapshot | undefined)?.update) {
          Y.applyUpdate(merged, Y.encodeStateAsUpdate(doc));
        } else {
          // JSON projections rebuild identities: replay the edit on the latest projection.
          mutate(merged);
        }
      } catch (error) { merged.destroy(); throw error; }
      doc.destroy();
      doc = merged;
      await client.savePage({id: pageId, name: latest.name, data: {...latest.data, editor: 'blocks', blockdoc: encodeSnapshot(doc)}});
      assertStore();
      return {doc, page: storedUpdate ? latest : page};
    } catch (error) { doc.destroy(); throw error; }
  }
}
