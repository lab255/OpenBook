import {afterEach, describe, expect, it} from 'vitest';
import {act, cleanup, render} from '@testing-library/react';
import {BlockEditor} from '../BlockEditor';
import {blockId, blockPlainText, blockProp, blockType, createDoc, rootBlocks, type BlockType} from '../model';
import {writeSelection} from '../richtext';

afterEach(cleanup);

function mount(type: BlockType = 'paragraph', text = '') {
  const doc = createDoc([{id: 'p', type, text}]);
  const {container} = render(<BlockEditor doc={doc} />);
  const el = container.querySelector('[data-block-text="p"]') as HTMLElement;
  act(() => { el.focus(); writeSelection(el, text.length); });
  return {doc, container, el};
}
function typeText(el: HTMLElement, text: string) {
  for (const data of text) act(() => {
    el.dispatchEvent(new InputEvent('beforeinput', {inputType: 'insertText', data, bubbles: true, cancelable: true}));
  });
}

describe('text shortcuts', () => {
  it('turns the third dash into a divider and puts the caret in a new paragraph', () => {
    const {doc, el} = mount();
    typeText(el, '---');
    const blocks = rootBlocks(doc).toArray();
    expect(blocks.map(blockType)).toEqual(['divider', 'paragraph']);
    expect(blockPlainText(blocks[1])).toBe('');
    expect(document.activeElement?.getAttribute('data-block-text')).toBe(blockId(blocks[1]));
    typeText(document.activeElement as HTMLElement, 'Next');
    expect(blockPlainText(blocks[1])).toBe('Next');
  });
  it.each(['"', '>'])('converts %s plus space to quote', prefix => {
    const {doc, el} = mount();
    typeText(el, prefix + ' ');
    expect(blockType(rootBlocks(doc).get(0))).toBe('quote');
    expect(blockPlainText(rootBlocks(doc).get(0))).toBe('');
  });
  it.each(['1.', '12.', '123.'])('converts %s plus space to a numbered list', prefix => {
    const {doc, el} = mount();
    typeText(el, prefix + ' ');
    expect(blockType(rootBlocks(doc).get(0))).toBe('list');
    expect(blockProp(rootBlocks(doc).get(0), 'kind')).toBe('number');
  });
  it.each(['code', 'quote', 'list'] as const)('keeps triple dash literal in %s', type => {
    const {doc, el} = mount(type);
    typeText(el, '---');
    expect(rootBlocks(doc).length).toBe(1);
    expect(blockType(rootBlocks(doc).get(0))).toBe(type);
    expect(blockPlainText(rootBlocks(doc).get(0))).toBe('---');
  });
  it('keeps triple dash literal when other paragraph content exists', () => {
    const {doc, el} = mount('paragraph', '--tail');
    act(() => writeSelection(el, 2));
    typeText(el, '-');
    expect(blockPlainText(rootBlocks(doc).get(0))).toBe('---tail');
    expect(blockType(rootBlocks(doc).get(0))).toBe('paragraph');
  });
  it('does not convert a dash replacing a selection', () => {
    const {doc, el} = mount('paragraph', '--');
    act(() => writeSelection(el, 1, 2));
    typeText(el, '-');
    expect(blockType(rootBlocks(doc).get(0))).toBe('paragraph');
    expect(blockPlainText(rootBlocks(doc).get(0))).toBe('--');
  });
});
