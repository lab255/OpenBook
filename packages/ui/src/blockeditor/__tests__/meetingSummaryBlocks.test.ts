import {setLocale} from '@/i18n';
import * as Y from 'yjs';
import {describe, expect, it} from 'vitest';
import {blockChildren, blockProp, blockText, createDoc, docToJSON, rootBlocks} from '../model';
import {generatedSummaryBlocks, materializeMeetingSummary, meetingSummaryContainer, hasMeetingSummary} from '../meetingSummaryBlocks';
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
      {type: 'paragraph', text: 'Recap'}, {type: 'heading', props: {level: 3}, text: 'Decisions'}, {type: 'list', text: 'Ship'}, {type: 'heading', props: {level: 3}, text: 'Action items'}, {type: 'todo', text: 'Alex ships', props: {checked: false}},
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

describe('summary parsing and presence', () => {
  it('accepts inline English labels with non-English content and localized editable headings', () => {
    setLocale('de');
    try {
      expect(generatedSummaryBlocks('Summary: Besprochen.\nDecisions: Liefern.\nAction items: Alex liefert.')).toEqual([
        {type: 'paragraph', text: 'Besprochen.'},
        {type: 'heading', props: {level: 3}, text: 'Entscheidungen'},
        {type: 'list', text: 'Liefern.'},
        {type: 'heading', props: {level: 3}, text: 'Aufgaben'},
        {type: 'todo', text: 'Alex liefert.', props: {checked: false}},
      ]);
      expect(generatedSummaryBlocks('Summary: 本日の会議。\nDecisions:\nAction items:')).toEqual([{type: 'paragraph', text: '本日の会議。'}]);
    } finally { setLocale('en'); }
  });
  it('ignores empty container text and selects the first summary without cleanup', () => {
    const doc = createDoc([{type: 'meeting', props: {summary: 'Legacy'}, children: [
      {type: 'meetingsummary', children: [{type: 'paragraph', text: '  '}]},
      {type: 'meetingsummary', children: [{type: 'paragraph', text: 'Second'}]},
    ]}]);
    const meeting = rootBlocks(doc).get(0);
    expect(hasMeetingSummary(meeting)).toBe(false);
    expect(meetingSummaryContainer(meeting)).toBe(blockChildren(meeting)!.get(0));
    expect(blockChildren(meeting)!.length).toBe(2);
    expect(blocksToMarkdown(docToJSON(doc))).not.toContain('Second');
    expect(blocksToMarkdown(docToJSON(doc))).not.toContain('Legacy');
  });
});
