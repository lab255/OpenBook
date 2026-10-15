import * as Y from 'yjs';
import {describe, expect, it} from 'vitest';
import {blockChildren, blockProp, blockText, createDoc, docToJSON, rootBlocks} from '../model';
import {generatedSummaryBlocks, materializeMeetingSummary, meetingSummaryContainer} from '../meetingSummaryBlocks';
import {blocksToHtml, blocksToMarkdown, projectBlocksForExport} from '../exportBlocks';

describe('editable meeting summary container', () => {
  it('seeds legacy lines atomically without replacing note CRDT nodes', () => {
    const doc = createDoc([{id: 'm', type: 'meeting', props: {summary: 'One\n\nTwo'}, children: [{type: 'paragraph', text: 'Note'}]}]);
    const meeting = rootBlocks(doc).get(0);
    const note = blockChildren(meeting)!.get(0);
    let updates = 0;
    doc.on('update', () => updates++);
    materializeMeetingSummary(doc, meeting);
    expect(updates).toBe(1);
    expect(blockChildren(meeting)!.get(1)).toBe(note);
    expect(blockProp(meeting, 'summary')).toBe('');
    const summary = meetingSummaryContainer(meeting)!;
    expect(summary.get('id')).toBe('m:summary');
    expect(blockChildren(summary)!.map((b) => blockText(b)!.toString())).toEqual(['One', 'Two']);
    doc.transact(() => blockText(blockChildren(summary)!.get(0))!.insert(3, ' edited'));
    expect(blocksToMarkdown(docToJSON(doc))).toContain('One edited');
  });
  it('materialises decisions and checkable action items', () => {
    expect(generatedSummaryBlocks('Summary:\nRecap\nDecisions:\n- Ship\nAction items:\n- Alex ships')).toEqual([
      {type: 'paragraph', text: 'Recap'}, {type: 'list', text: 'Ship'}, {type: 'todo', text: 'Alex ships', props: {checked: false}},
    ]);
  });
  it('deduplicates concurrent container creation on read and export while preserving notes', () => {
    const a = createDoc([{id: 'm', type: 'meeting', children: [{type: 'paragraph', text: 'Note'}]}]);
    const b = new Y.Doc(); Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    for (const doc of [a, b]) materializeMeetingSummary(doc, rootBlocks(doc).get(0), [{type: 'paragraph', text: 'Recap'}]);
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b)); Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(meetingSummaryContainer(rootBlocks(a).get(0))!.get('id')).toBe('m:summary');
    for (const output of [blocksToHtml(docToJSON(a)), blocksToMarkdown(docToJSON(a)), JSON.stringify(projectBlocksForExport(docToJSON(a)))]) {
      expect(output.match(/Recap/g)).toHaveLength(1);
      expect(output.indexOf('Recap')).toBeLessThan(output.indexOf('Note'));
    }
    expect(docToJSON(a)).toEqual(docToJSON(b));
  });
});
