import {describe, expect, it} from 'vitest';
import {createDoc, rootBlocks} from '../model';
import {alpha, roman, listNumber, listNumberLabel} from '../listMarkers';

describe('list markers', () => {
  it.each([[1, 'a'], [26, 'z'], [27, 'aa'], [52, 'az'], [53, 'ba'], [703, 'aaa']])('formats alpha %s', (n, label) => {
    expect(alpha(Number(n))).toBe(label);
  });
  it.each([[1, 'i'], [4, 'iv'], [9, 'ix'], [49, 'xlix'], [99, 'xcix'], [944, 'cmxliv'], [2026, 'mmxxvi']])('formats roman %s', (n, label) => {
    expect(roman(Number(n))).toBe(label);
  });
  it('cycles the format every three depths', () => {
    expect([0, 1, 2, 3, 4, 5].map(d => listNumberLabel(27, d))).toEqual(['27.', 'aa.', 'xxvii.', '27.', 'aa.', 'xxvii.']);
  });
  it('counts per depth across nested bullets and restarts at same-depth bullets, shallower items and non-lists', () => {
    const doc = createDoc([
      ...[[0, 'number'], [1, 'number'], [2, 'bullet'], [1, 'number'], [0, 'number'], [1, 'number'], [0, 'bullet'], [0, 'number']].map(([indent, kind]) => ({type: 'list' as const, props: {indent, kind}})),
      {type: 'paragraph', props: {indent: 2}},
      {type: 'list', props: {kind: 'number'}},
    ]);
    expect(rootBlocks(doc).toArray().map(b => listNumber(doc, b))).toEqual([1, 1, 1, 2, 2, 1, 3, 1, 1, 1]);
  });
});
