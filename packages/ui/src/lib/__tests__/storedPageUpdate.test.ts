import * as Y from 'yjs';
import {describe, expect, it, vi} from 'vitest';
import type {StoredPage} from '@book.dev/sdk';
import {createDoc, decodeSnapshot, encodeSnapshot, rootBlocks, setBlockProp, blockProp} from '@/blockeditor/model';
import {saveStoredPageUpdate, type StoredPageClient} from '../storedPageUpdate';
import {applyProposal, type ApplyClient} from '../aiBridge';

function fixture() {
  const doc = createDoc([{id: 'a', type: 'paragraph', text: 'base', props: {color: 'black', align: 'left'}}]);
  const page = {id: 'page', name: 'before', data: {editor: 'blocks', blockdoc: encodeSnapshot(doc), names: []}} as unknown as StoredPage;
  const sv = Y.encodeStateVector(doc);
  setBlockProp(rootBlocks(doc).get(0), 'color', 'red');
  return {doc, page, sv};
}

describe('stored page writes', () => {
  it.each([false, true])('re-reads metadata and merges concurrent content in fallback (method present=%s)', async (method) => {
    const {doc, page, sv} = fixture();
    const concurrent = decodeSnapshot(page.data.blockdoc as ReturnType<typeof encodeSnapshot>);
    setBlockProp(rootBlocks(concurrent).get(0), 'align', 'center');
    const latest = {...page, name: 'renamed', data: {...page.data, names: [['key', 'new']] as Array<[string, string]>, blockdoc: encodeSnapshot(concurrent)}};
    const client: StoredPageClient = {
      getPage: vi.fn(async () => latest), savePage: vi.fn(async (input) => ({...latest, ...input} as StoredPage)),
      ...(method ? {applyPageUpdate: vi.fn(async () => false)} : {}),
    };
    await saveStoredPageUpdate(client, page, doc, sv);
    expect(client.savePage).toHaveBeenCalledWith(expect.objectContaining({name: 'renamed', data: expect.objectContaining({names: [['key', 'new']] as Array<[string, string]>})}));
    expect(blockProp(rootBlocks(doc).get(0), 'align')).toBe('center');
    expect(blockProp(rootBlocks(doc).get(0), 'color')).toBe('red');
    doc.destroy(); concurrent.destroy();
  });

  it.each([403, 404, 500])('never falls back from a delta HTTP %s failure', async (status) => {
    const {doc, page, sv} = fixture();
    const client = {getPage: vi.fn(), savePage: vi.fn(), applyPageUpdate: vi.fn(async () => { throw Object.assign(new Error('failed'), {status}); })};
    await expect(saveStoredPageUpdate(client, page, doc, sv)).rejects.toMatchObject({status});
    expect(client.getPage).not.toHaveBeenCalled(); expect(client.savePage).not.toHaveBeenCalled(); doc.destroy();
  });

  it('does not save when fallback re-read finds a deleted page', async () => {
    const {doc, page, sv} = fixture();
    const client = {getPage: vi.fn(async () => null), savePage: vi.fn()};
    await expect(saveStoredPageUpdate(client, page, doc, sv)).rejects.toMatchObject({status: 404});
    expect(client.savePage).not.toHaveBeenCalled(); doc.destroy();
  });

  it('checks captured ownership after the async capability/delta call before fallback', async () => {
    const {doc, page, sv} = fixture();
    let owns = true;
    const client = {getPage: vi.fn(), savePage: vi.fn(), applyPageUpdate: vi.fn(async () => { owns = false; return false; })};
    await expect(saveStoredPageUpdate(client, page, doc, sv, () => { if (!owns) throw new Error('switched'); })).rejects.toThrow('switched');
    expect(client.getPage).not.toHaveBeenCalled(); expect(client.savePage).not.toHaveBeenCalled(); doc.destroy();
  });

  it('aiBridge sends a mergeable delta and preserves concurrent metadata/content', async () => {
    const {doc, page} = fixture();
    const concurrent = decodeSnapshot(page.data.blockdoc as ReturnType<typeof encodeSnapshot>);
    let stored = page;
    const client = {
      getPage: vi.fn(async () => stored), savePage: vi.fn(),
      applyPageUpdate: vi.fn(async (_id: string, update: string) => {
        setBlockProp(rootBlocks(concurrent).get(0), 'align', 'center');
        Y.applyUpdate(concurrent, Uint8Array.from(atob(update), (c) => c.charCodeAt(0)));
        stored = {...stored, name: 'renamed', data: {...stored.data, names: [['key', 'new']] as Array<[string, string]>, blockdoc: encodeSnapshot(concurrent)}};
        return true;
      }),
    };
    await applyProposal(client as unknown as ApplyClient, {id: 'proposal', kind: 'update_block', summary: '', payload: {pageId: page.id, blockId: 'a', text: 'agent edit'}});
    expect(client.applyPageUpdate).toHaveBeenCalledOnce(); expect(client.savePage).not.toHaveBeenCalled();
    expect(stored.name).toBe('renamed'); expect(stored.data.names).toEqual([['key', 'new']]);
    expect(encodeSnapshot(concurrent).blocks[0].text).toEqual([{t: 'agent edit'}]);
    expect(blockProp(rootBlocks(concurrent).get(0), 'align')).toBe('center');
    doc.destroy(); concurrent.destroy();
  });
});
