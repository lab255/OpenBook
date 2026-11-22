import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {setLocale} from '@/i18n';
import {BlockEditor} from '../BlockEditor';
import {blockChildren, blockProp, createDoc, findBlock} from '../model';

afterEach(() => { cleanup(); setLocale('en'); });

describe('container presentation', () => {
  it.each([
    ['en', 'Item 1', 'Add item', 'Item label'],
    ['de', 'Element 1', 'Element hinzufügen', 'Elementbeschriftung'],
    ['ja', '項目 1', '項目を追加', '項目のラベル'],
    ['zh', '项目 1', '添加项目', '项目标签'],
  ] as const)('names new accordion items in %s', (locale, label, add, aria) => {
    setLocale(locale);
    const doc = createDoc([{id: 'acc', type: 'accordion', children: []}]);
    render(<BlockEditor doc={doc} />);
    fireEvent.click(screen.getByRole('button', {name: add}));
    const item = blockChildren(findBlock(doc, 'acc')!.block)!.get(0);
    expect(blockProp(item, 'label')).toBe(label);
    expect((screen.getByRole('textbox', {name: aria}) as HTMLInputElement).value).toBe(label);
  });

  it('keeps the same chevron when an item collapses and leaves its body navigable', () => {
    const doc = createDoc([{id: 'acc', type: 'accordion', children: [
      {id: 'item', type: 'accordionsection', props: {label: 'Existing section'}, children: [{type: 'paragraph', text: [{t: 'Body'}]}]},
    ]}]);
    const {container} = render(<BlockEditor doc={doc} />);
    const toggle = container.querySelector('.obe-acc-toggle')!;
    const chevron = toggle.querySelector('svg');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.obe-acc-body')).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.querySelector('svg')).toBe(chevron);
    expect(container.querySelector('.obe-acc-body')).toBeNull();
    fireEvent.click(toggle);
    expect(container.querySelector('.obe-acc-body')).toBeTruthy();
    expect(blockProp(findBlock(doc, 'item')!.block, 'label')).toBe('Existing section');
  });
});
