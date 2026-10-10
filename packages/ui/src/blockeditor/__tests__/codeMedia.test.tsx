import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {BlockEditor} from '../BlockEditor';
import {readSelection, writeSelection} from '../richtext';
import {createDoc, docToJSON, encodeSnapshot, decodeSnapshot} from '../model';

afterEach(cleanup);

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
    // Home/End are native browser navigation: unit-check the offset mapping
    // and that the editor leaves those keys unconsumed; e2e exercises movement.
    for (const [key, offset] of [['End', 300], ['Home', 0]] as const) {
      writeSelection(text, offset);
      expect(readSelection(text)).toEqual({start: offset, end: offset});
      expect(fireEvent.keyDown(text, {key})).toBe(true);
    }
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
