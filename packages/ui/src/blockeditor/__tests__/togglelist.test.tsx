import {afterEach, describe, expect, it} from 'vitest';
import {act, cleanup, fireEvent, render, renderHook, screen} from '@testing-library/react';
import {BlockEditor} from '../BlockEditor';
import {SlashMenu} from '../SlashMenu';
import {useBlockEditor} from '../useBlockEditor';
import {blockChildren, blockPlainText, blockProp, createDoc, decodeSnapshot, docToJSON, encodeSnapshot, findBlock, migrateLegacyBlocks, rootBlocks} from '../model';
import {writeSelection} from '../richtext';
import {setLocale} from '@/i18n';

afterEach(() => {cleanup(); setLocale('en');});

function input(el: HTMLElement, inputType: string, data: string | null = null) {
  act(() => {el.dispatchEvent(new InputEvent('beforeinput', {inputType, data, bubbles: true, cancelable: true}));});
}
function focus(el: HTMLElement, offset = 0) {act(() => {el.focus(); writeSelection(el, offset);});}

describe('togglelist', () => {
  it('edits the summary, adds a child from the empty hint and persists collapse across reload', () => {
    const doc = createDoc([{id: 't', type: 'togglelist'}]);
    const {container, unmount} = render(<BlockEditor doc={doc} />);
    const summary = container.querySelector<HTMLElement>('[data-block-text="t"]')!;
    focus(summary);
    input(summary, 'insertText', 'Summary');
    fireEvent.click(screen.getByRole('button', {name: 'Empty toggle. Click to add content.'}));
    input(document.activeElement as HTMLElement, 'insertText', 'Child');
    expect(blockPlainText(blockChildren(findBlock(doc, 't')!.block)!.get(0))).toBe('Child');
    fireEvent.click(screen.getByRole('button', {name: 'Expand or collapse toggle list'}));
    expect(container.querySelector('.obe-togglelist-children')).toBeNull();
    expect(blockProp(findBlock(doc, 't')!.block, 'collapsed')).toBe(true);
    const snapshot = encodeSnapshot(doc);
    unmount();
    const reloaded = decodeSnapshot(snapshot);
    render(<BlockEditor doc={reloaded} />);
    expect(screen.getByRole('button', {name: 'Expand or collapse toggle list'}).getAttribute('aria-expanded')).toBe('false');
    expect(blockPlainText(rootBlocks(reloaded).get(0))).toBe('Summary');
    fireEvent.click(screen.getByRole('button', {name: 'Expand or collapse toggle list'}));
    expect(screen.getByText('Child')).toBeTruthy();
  });

  it('Enter splits rich summary into a child; Tab nests and Shift+Tab/Backspace outdent', () => {
    const doc = createDoc([{id: 't', type: 'togglelist', text: [{t: 'Summary'}, {t: 'Tail', a: {b: true}}]}, {id: 'p', type: 'paragraph', text: 'Sibling'}]);
    const {container} = render(<BlockEditor doc={doc} />);
    const summary = container.querySelector<HTMLElement>('[data-block-text="t"]')!;
    focus(summary, 7); input(summary, 'insertParagraph');
    expect(docToJSON(doc)[0].children?.[0].text).toEqual([{t: 'Tail', a: {b: true}}]);
    const sibling = container.querySelector<HTMLElement>('[data-block-text="p"]')!;
    focus(sibling); fireEvent.keyDown(sibling, {key: 'Tab'});
    expect(docToJSON(doc)[0].children?.map(b => b.text?.[0].t)).toEqual(['Tail', 'Sibling']);
    fireEvent.keyDown(document.activeElement!, {key: 'Tab', shiftKey: true});
    expect(docToJSON(doc).map(b => b.id)).toEqual(['t', 'p']);
    const child = container.querySelector<HTMLElement>('.obe-togglelist-children [data-block-text]')!;
    focus(child); input(child, 'deleteContentBackward');
    expect(docToJSON(doc)[0].children).toEqual([]);
    expect(docToJSON(doc)[1].text).toEqual([{t: 'Tail', a: {b: true}}]);
  });

  it('Enter on a closed toggle creates a sibling, and Backspace unwraps without losing children', () => {
    const doc = createDoc([{id: 't', type: 'togglelist', text: 'Title', props: {collapsed: true}, children: [{type: 'paragraph', text: 'Child'}]}]);
    const {container} = render(<BlockEditor doc={doc} />);
    const summary = container.querySelector<HTMLElement>('[data-block-text="t"]')!;
    focus(summary, 5); input(summary, 'insertParagraph');
    expect(docToJSON(doc).map(b => b.type)).toEqual(['togglelist', 'paragraph']);
    focus(summary); input(summary, 'deleteContentBackward');
    expect(docToJSON(doc).map(b => b.type)).toEqual(['paragraph', 'paragraph', 'paragraph']);
    expect(docToJSON(doc)[1].text).toEqual([{t: 'Child'}]);
  });

  it.each([['en', 'Toggle list'], ['de', 'Aufklappbare Liste'], ['ja', 'トグルリスト'], ['zh', '折叠列表']] as const)('creates from the localized slash menu in %s', (locale, label) => {
    setLocale(locale);
    const doc = createDoc([{id: 'p', type: 'paragraph', text: 'Keep summary'}]);
    const {result} = renderHook(() => useBlockEditor(doc));
    render(<SlashMenu state={{open: true, blockId: 'p', anchorOffset: 0, query: 'togglelist', index: 0}} editor={result.current} anchorEl={null} rootEl={null} onClose={() => {}} />);
    fireEvent.mouseDown(screen.getByText(label));
    expect(docToJSON(doc)[0]).toMatchObject({type: 'togglelist', children: [], text: [{t: 'Keep summary'}]});
  });

  it('migrates legacy accordion summary, rich content and state', () => {
    expect(migrateLegacyBlocks([{type: 'accordion', data: {title: '<b>Title</b>', content: '<i>Body</i>', open: false}}])).toEqual([
      {type: 'togglelist', text: [{t: 'Title', a: {b: true}}], props: {collapsed: true}, children: [{type: 'paragraph', text: [{t: 'Body', a: {i: true}}]}]},
    ]);
  });
});
