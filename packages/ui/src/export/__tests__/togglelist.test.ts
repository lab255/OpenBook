import {describe, expect, it} from 'vitest';
import type {PageSnapshot} from '@book.dev/sdk';
import {blocksToHtml, blocksToMarkdown, projectBlocksForExport} from '../../blockeditor/exportBlocks';
import {createDoc, docToJSON, htmlToBlocks} from '../../blockeditor/model';
import {toHtml} from '../toHtml';
import {toMarkdown} from '../toMarkdown';
import {buildDocumentModel} from '../documentModel';

function exportsFor(collapsed: boolean) {
  const blocks = docToJSON(createDoc([
    {type: 'togglelist', text: [{t: '<Summary>', a: {b: true}}], props: {collapsed}, children: [
      {type: 'paragraph', text: 'Body'},
      {type: 'togglelist', text: 'Nested', props: {collapsed: false}, children: [{type: 'paragraph', text: 'Deep'}]},
    ]}, {type: 'paragraph', text: 'Outside'},
  ]));
  const projection = projectBlocksForExport(blocks);
  const snapshot: PageSnapshot = {editorjs: {blocks: projection.blocks}, values: projection.values, names: projection.names};
  return {blocks, snapshot};
}

describe('togglelist exports', () => {
  it.each([true, false])('exports native nested details and summary (collapsed=%s)', collapsed => {
    const {blocks, snapshot} = exportsFor(collapsed);
    for (const html of [blocksToHtml(blocks), toHtml(snapshot, 'T', '')]) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const details = doc.querySelector('details')!;
      expect(details.hasAttribute('open')).toBe(!collapsed);
      expect(details.querySelector('summary')?.textContent).toBe('<Summary>');
      expect(details.querySelector('summary strong, summary b')?.textContent).toBe('<Summary>');
      expect(details.querySelector('details')?.hasAttribute('open')).toBe(true);
      expect(details.textContent).toContain('Deep');
      expect(details.textContent).not.toContain('Outside');
      expect(details.nextElementSibling?.textContent).toBe('Outside');
    }
  });

  it('exports the summary and recursively indented children in both Markdown paths', () => {
    const {blocks, snapshot} = exportsFor(true);
    const expected = '**\\<Summary\\>**\n  Body\n\n  Nested\n    Deep\n\nOutside';
    expect(blocksToMarkdown(blocks)).toBe(expected.split('\\').join(''));
    expect(toMarkdown(buildDocumentModel({title: 'T', icon: '', snapshot}))).toBe('# T\n\n' + expected + '\n');
  });

  it('round trips native details through HTML paste without flattening children', () => {
    const {blocks} = exportsFor(true);
    const imported = docToJSON(createDoc(htmlToBlocks(blocksToHtml(blocks))));
    expect(imported[0]).toMatchObject({type: 'togglelist', props: {collapsed: true}, text: [{t: '<Summary>', a: {b: true}}], children: [
      {type: 'paragraph', text: [{t: 'Body'}]}, {type: 'togglelist', props: {collapsed: false}, children: [{type: 'paragraph', text: [{t: 'Deep'}]}]},
    ]});
  });

  it('keeps empty toggles and publishes reactive children', () => {
    const blocks = docToJSON(createDoc([{type: 'togglelist', text: 'Empty'},
      {type: 'togglelist', text: 'Input', children: [{id: 'n', type: 'number', props: {name: 'amount', value: 7}}]},
    ]));
    const projection = projectBlocksForExport(blocks);
    expect(blocksToHtml(blocks)).toContain('<details open><summary>Empty</summary></details>');
    expect(projection.names).toContainEqual(['amount', 'n']);
    expect(projection.values).toContainEqual(['n', 7]);
    expect(projection.blocks[1].data.children).toEqual([expect.objectContaining({id: 'n'})]);
  });
});
