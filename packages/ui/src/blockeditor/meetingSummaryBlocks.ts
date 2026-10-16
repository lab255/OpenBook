import {t} from '@/i18n';
import {blockText, blockChildren, blockId, blockProp, blockType, insertBlock, setBlockProp, type BlockMap, type NewBlock} from './model';
import type * as Y from 'yjs';

/** Concurrent lazy creation uses the same ID; readers select the first replica,
 * just as deterministic table migration does. Never move existing note nodes. */
export function meetingSummaryContainer(meeting: BlockMap): BlockMap | undefined {
  return blockChildren(meeting)?.toArray().find((child) => String(blockType(child)) === 'meetingsummary');
}

export function hasMeetingSummary(meeting: BlockMap): boolean {
  const container = meetingSummaryContainer(meeting);
  const hasText = (block: BlockMap): boolean => !!blockText(block)?.toString().trim() || !!blockChildren(block)?.toArray().some(hasText);
  return container ? hasText(container) : !!String(blockProp(meeting, 'summary') ?? '').trim();
}

export function materializeMeetingSummary(doc: Y.Doc, meeting: BlockMap, blocks?: NewBlock[]): void {
  doc.transact(() => {
    let container = meetingSummaryContainer(meeting);
    if (!container) {
      const children = blockChildren(meeting)!;
      const seed = blocks ?? generatedSummaryBlocks(String(blockProp(meeting, 'summary') ?? ''));
      insertBlock(doc, children, 0, {id: `${blockId(meeting)}:summary`, type: 'meetingsummary', children: seed.length ? seed : [{type: 'paragraph'}]});
      container = children.get(0);
    } else if (blocks) {
      const children = blockChildren(container)!;
      children.delete(0, children.length);
      blocks.forEach((block, index) => insertBlock(doc, children, index, block));
    }
    if (!blockChildren(container)!.length) insertBlock(doc, blockChildren(container)!, 0, {type: 'paragraph'});
    setBlockProp(meeting, 'summary', '');
  }, 'local');
}

/** The prompt requests explicit section labels; tolerate ordinary plain-text replies. */
export function generatedSummaryBlocks(text: string): NewBlock[] {
  let section: 'paragraph' | 'list' | 'todo' = 'paragraph';
  let headed: 'paragraph' | 'list' | 'todo' = 'paragraph';
  return text.split('\n').flatMap((raw): NewBlock[] => {
    let line = raw.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '');
    if (!line) return [];
    const label = /^(summary|decisions|action items)(?::\s*(.*)|$)/i.exec(line);
    if (label) {
      section = /^decisions/i.test(label[1]) ? 'list' : /^action/i.test(label[1]) ? 'todo' : 'paragraph';
      headed = 'paragraph';
      line = label[2]?.trim() ?? '';
      if (!line) return [];
    }
    const action = /^action(?: item)?:\s*/i.test(line);
    const decision = /^decision:\s*/i.test(line);
    const type = action ? 'todo' : decision ? 'list' : section;
    const content = line.replace(/^(?:[-*]|\d+[.)])\s+/, '').replace(/^\[[ x]\]\s*/i, '').replace(/^(?:action(?: item)?|decision):\s*/i, '').trim();
    if (!content) return [];
    const blocks: NewBlock[] = [];
    if (type !== 'paragraph' && headed !== type) {
      blocks.push({type: 'heading', props: {level: 3}, text: t(type === 'list' ? 'meetingBlock.decisions' : 'meetingBlock.actionItems')});
    }
    headed = type;
    blocks.push({type, text: content, ...(type === 'todo' ? {props: {checked: false}} : {})});
    return blocks;
  });
}
