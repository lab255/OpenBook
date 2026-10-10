import type * as Y from 'yjs';
import {blockId, blockProp, blockType, findBlock, type BlockMap} from './model';

/** Spreadsheet-style lowercase alphabetic numbering, starting at one. */
export function alpha(n: number): string {
  let label = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(97 + (n - 1) % 26) + label;
  return label;
}

export function roman(n: number): string {
  let label = '';
  for (const [value, glyph] of [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']] as const) {
    while (n >= value) { label += glyph; n -= value; }
  }
  return label;
}

export function listNumberLabel(n: number, depth: number): string {
  return `${depth % 3 === 1 ? alpha(n) : depth % 3 === 2 ? roman(n) : n}.`;
}

/** Count siblings at this indent, ignoring any deeper list items. */
export function listNumber(doc: Y.Doc, block: BlockMap): number {
  const found = findBlock(doc, blockId(block));
  if (!found) return 1;
  const depth = blockProp<number>(block, 'indent') ?? 0;
  let n = 1;
  for (let i = found.index - 1; i >= 0; i -= 1) {
    const prev = found.parent.get(i);
    const d = blockProp<number>(prev, 'indent') ?? 0;
    if (blockType(prev) === 'list' && d > depth) continue;
    if (blockType(prev) === 'list' && d === depth && blockProp<string>(prev, 'kind') === 'number') { n += 1; continue; }
    break;
  }
  return n;
}
