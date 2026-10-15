import {blockChildren, blockId, blockProp, blockType, insertBlock, setBlockProp, type BlockMap, type NewBlock} from './model';
import type * as Y from 'yjs';

/** Concurrent lazy creation uses the same ID; readers select the first replica,
 * just as deterministic table migration does. Never move existing note nodes. */
export function meetingSummaryContainer(meeting: BlockMap): BlockMap | undefined {
  return blockChildren(meeting)?.toArray().find((child) => String(blockType(child)) === 'meetingsummary');
}

export function materializeMeetingSummary(doc: Y.Doc, meeting: BlockMap, blocks?: NewBlock[]): void {
  doc.transact(() => {
    let container = meetingSummaryContainer(meeting);
    if (!container) {
      const children = blockChildren(meeting)!;
      const seed = blocks ?? String(blockProp(meeting, 'summary') ?? '').split('\n').filter(Boolean).map((text): NewBlock => ({type: 'paragraph', text}));
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
  return text.split('\n').flatMap((raw): NewBlock[] => {
    const line = raw.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '');
    if (!line) return [];
    if (/^(summary|decisions|action items):?$/i.test(line)) {
      section = /^decisions/i.test(line) ? 'list' : /^action/i.test(line) ? 'todo' : 'paragraph';
      return [];
    }
    const action = /^action(?: item)?:\s*/i.test(line);
    const decision = /^decision:\s*/i.test(line);
    const type = action ? 'todo' : decision ? 'list' : section;
    return [{type, text: line.replace(/^(?:[-*]|\d+[.)])\s+/, '').replace(/^\[[ x]\]\s*/i, '').replace(/^(?:action(?: item)?|decision):\s*/i, ''), ...(type === 'todo' ? {props: {checked: false}} : {})}];
  });
}
