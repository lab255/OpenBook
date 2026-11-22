import {describe, expect, it} from 'vitest';
import {readAssetsIsland, type PageSnapshot} from '@book.dev/sdk';
import {zipSync, unzipSync, strToU8, strFromU8} from 'fflate';
import {createDoc, encodeSnapshot} from '../../blockeditor/model';
import {collectAssetIds, resolveExportAssets} from '../exportAssets';
import {buildDocumentModel} from '../documentModel';
import {toMarkdown} from '../toMarkdown';
import {toHtml, toHtmlSite} from '../toHtml';
import {staticizeForms} from '../toPdf';
import type {SiteBundle} from '../exportSite';

const snapshot: PageSnapshot = {
  editor: 'blocks', blockdoc: encodeSnapshot(createDoc([{type: 'columns', children: [{type: 'column', children: [{type: 'meeting', props: {
    title: 'Team sync', status: 'done', transcript: [{startMs: 0, endMs: 100, text: 'Ship on Friday'}],
    summary: 'Decision: ship\nOwner: Alex', audioChunks: [{assetId: 'audio-a', durationMs: 45000}, {assetId: 'audio-a', durationMs: 45000}],
  }, children: [{type: 'paragraph', text: 'Manual notes'}]}]}]}])), editorjs: {blocks: []}, values: [], names: [],
};
const bytes = new Uint8Array([0, 1, 2, 255]);
const client = {getAsset: async () => ({bytes, mime: 'audio/webm'})};

describe('MEET-7 document audio integration', () => {
  it('collects nested meeting audio and deduplicates references', () => {
    expect(collectAssetIds(snapshot)).toEqual(['audio-a']);
    expect(collectAssetIds({editorjs: {blocks: [{type: 'meeting', data: {audioChunks: [{assetId: 'legacy'}]}}]}, values: [], names: []})).toEqual(['legacy']);
  });
  it('carries exact audio bytes in page, zipped page, and site assets islands', async () => {
    const assets = await resolveExportAssets(client, [snapshot]);
    const html = toHtml(snapshot, 'Meeting', '', assets);
    const zip = unzipSync(zipSync({'Meeting.html': strToU8(html)}));
    const bundle = {rootId: 'p', pages: [{id: 'p', title: 'Meeting', icon: '', snapshot}], space: {pages: [{id: 'p', name: 'Meeting', data: snapshot}], databases: []}} as unknown as SiteBundle;
    for (const output of [html, strFromU8(zip['Meeting.html']), toHtmlSite(bundle, assets)]) {
      expect(readAssetsIsland(output)!.assets['audio-a']).toEqual({mime: 'audio/webm', encoding: 'base64', data: 'AAEC/w=='});
      expect(output).toContain('Ship on Friday');
      expect(output).toContain('Manual notes');
    }
  });
  it('retains transcript, multiline summary, notes and audio links in Markdown and HTML/PDF input', async () => {
    const assets = await resolveExportAssets(client, [snapshot]);
    const html = toHtml(snapshot, 'Meeting', '', assets);
    const markdown = toMarkdown(buildDocumentModel({title: 'Meeting', icon: '', snapshot, audioAssets: assets.audio}));
    const root = document.createElement('main');
    root.innerHTML = new DOMParser().parseFromString(html, 'text/html').querySelector('main')!.innerHTML;
    staticizeForms(root); // PDF consumes this same static HTML before browser layout/SVG rendering.
    for (const output of [markdown, root.textContent!]) {
      for (const text of ['Ship on Friday', 'Decision: ship', 'Owner: Alex', 'Manual notes', 'Export audio (0:00)', 'Export audio (0:45)']) expect(output).toContain(text);
      expect(output).not.toContain('[object Object]');
    }
    expect(markdown).toContain('data:audio/webm;base64,AAEC/w==');
    expect(root.querySelector('a[href="data:audio/webm;base64,AAEC/w=="]')).toBeTruthy();
  });
  it('omits unreadable audio bytes while retaining meeting text', async () => {
    const assets = await resolveExportAssets({getAsset: async () => { throw new Error('403'); }}, [snapshot]);
    const html = toHtml(snapshot, 'Meeting', '', assets);
    expect(readAssetsIsland(html)).toBeNull();
    expect(html).toContain('Manual notes');
    expect(assets.audio?.size).toBe(0);
  });
});
