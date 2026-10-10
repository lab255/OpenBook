import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {BlockEditor} from '../BlockEditor';
import {readSelection, readSelectionDirected, writeSelection} from '../richtext';
import {createDoc, docToJSON, encodeSnapshot, decodeSnapshot} from '../model';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('code media settings', () => {
  it('keeps viewing actions on locked code without exposing settings or changing the document', () => {
    const doc = createDoc([{id: 'code', type: 'code', text: '1 + 2', props: {live: true, collapsed: true}}]);
    const before = docToJSON(doc);
    const {container} = render(<BlockEditor doc={doc} readOnly />);
    expect(screen.getByLabelText('Copy code')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Run code'));
    expect(container.querySelector('.obe-kit-gear')).toBeNull();
    expect(screen.queryByLabelText('Choose code language')).toBeNull();
    expect(container.querySelector('.obe-code-lang')).toBeNull();
    fireEvent.click(container.querySelector('.obe-code-collapsed')!);
    expect(docToJSON(doc)).toEqual(before);
  });

  it('only offers Run for live code and keeps settings in the gear', () => {
    const doc = createDoc([{id: 'code', type: 'code', text: '1 + 2'}]);
    const {container} = render(<BlockEditor doc={doc} />);
    expect(screen.queryByLabelText('Run code')).toBeNull();
    expect(screen.getByLabelText('Copy code').getAttribute('data-chrome')).toBe('view');
    expect(container.querySelector('.obe-codeblock')?.getAttribute('data-wrap')).toBe('false');
    fireEvent.click(container.querySelector('.obe-kit-gear')!);
    expect(screen.queryByLabelText('Code language')).toBeNull();
    expect(screen.getByLabelText('File name')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', {name: 'Live'}));
    expect(screen.getByLabelText('Run code')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', {name: 'Hide code'}));
    expect(container.querySelector('.obe-code-collapsed')).toBeTruthy();
  });

  it('persists wrapping without remounting or changing a long line', () => {
    const line = 'const value = '+ 'x'.repeat(286);
    const doc = createDoc([{id: 'code', type: 'code', text: line}]);
    const {container} = render(<BlockEditor doc={doc} />);
    const text = container.querySelector('.obe-text') as HTMLElement;
    text.scrollLeft = 600;
    // Exercise actual key movement across highlighted spans and a scrolled line.
    vi.spyOn(text, 'getBoundingClientRect').mockReturnValue({left: 0, right: 100} as DOMRect);
    vi.spyOn(Range.prototype, 'getBoundingClientRect').mockImplementation(() => {
      const left = (readSelectionDirected(text)?.head ?? 0) * 8 - text.scrollLeft;
      return {left, right: left + 1} as DOMRect;
    });
    for (const [key, offset] of [['End', 300], ['Home', 0]] as const) {
      writeSelection(text, offset === 0 ? 300 : 0);
      expect(fireEvent.keyDown(text, {key})).toBe(false);
      expect(readSelection(text)).toEqual({start: offset, end: offset});
      expect(text.scrollLeft).toBe(offset === 0 ? 0 : 2301);
    }
    writeSelection(text, 300);
    fireEvent.keyDown(text, {key: 'Home', shiftKey: true});
    expect(readSelectionDirected(text)).toEqual({anchor: 300, head: 0});
    expect(window.getSelection()!.toString()).toBe(line);
    fireEvent.keyDown(text, {key: 'End', shiftKey: true});
    expect(readSelectionDirected(text)).toEqual({anchor: 300, head: 300});
    writeSelection(text, 20, 280);
    expect(readSelection(text)).toEqual({start: 20, end: 280});
    expect(window.getSelection()!.toString()).toBe(line.slice(20, 280));
    fireEvent.click(container.querySelector('.obe-kit-gear')!);
    fireEvent.click(screen.getByRole('checkbox', {name: 'Wrap code'}));
    expect(docToJSON(doc)[0].props?.wrap).toBe(true);
    expect(docToJSON(decodeSnapshot(encodeSnapshot(doc)))[0].props?.wrap).toBe(true);
    expect(container.querySelector('.obe-text')).toBe(text);
    expect(text.textContent).toBe(line);
    expect(readSelection(text)).toEqual({start: 20, end: 280});
    expect(container.querySelector('.obe-codeblock')?.getAttribute('data-wrap')).toBe('true');
    fireEvent.click(screen.getByRole('checkbox', {name: 'Wrap code'}));
    expect(docToJSON(doc)[0].props?.wrap).toBe(false);
  });
});

it('navigates logical code lines, preserves Shift direction, and leaves wrapped code native', () => {
  const doc = createDoc([{id: 'code', type: 'code', text: 'abc\ndefgh\nijk'}]);
  const {container} = render(<BlockEditor doc={doc} />);
  const text = container.querySelector('.obe-text') as HTMLElement;
  writeSelection(text, 6);
  fireEvent.keyDown(text, {key: 'Home'});
  expect(readSelection(text)).toEqual({start: 4, end: 4});
  fireEvent.keyDown(text, {key: 'End', shiftKey: true});
  expect(readSelectionDirected(text)).toEqual({anchor: 4, head: 9});
  fireEvent.keyDown(text, {key: 'Home', ctrlKey: true, shiftKey: true});
  expect(readSelectionDirected(text)).toEqual({anchor: 4, head: 0});
  fireEvent.keyDown(text, {key: 'End', ctrlKey: true});
  expect(readSelection(text)).toEqual({start: 13, end: 13});
  fireEvent.click(container.querySelector('.obe-kit-gear')!);
  fireEvent.click(screen.getByRole('checkbox', {name: 'Wrap code'}));
  expect(fireEvent.keyDown(text, {key: 'Home'})).toBe(true);
});
