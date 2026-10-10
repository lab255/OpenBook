import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {BlockEditor} from '../BlockEditor';
import {createDoc, docToJSON} from '../model';

afterEach(cleanup);

describe('code media settings', () => {
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
    const line = 'x'.repeat(300);
    const doc = createDoc([{id: 'code', type: 'code', text: line}]);
    const {container} = render(<BlockEditor doc={doc} />);
    const text = container.querySelector('.obe-text') as HTMLElement;
    text.scrollLeft = 600;
    const range = document.createRange();
    range.setStart(text.firstChild!, 20);
    range.setEnd(text.firstChild!, 280);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    expect(window.getSelection()!.toString()).toBe(line.slice(20, 280));
    fireEvent.click(container.querySelector('.obe-kit-gear')!);
    fireEvent.click(screen.getByRole('checkbox', {name: 'Wrap code'}));
    expect(docToJSON(doc)[0].props?.wrap).toBe(true);
    expect(container.querySelector('.obe-text')).toBe(text);
    expect(text.textContent).toBe(line);
    expect(container.querySelector('.obe-codeblock')?.getAttribute('data-wrap')).toBe('true');
    fireEvent.click(screen.getByRole('checkbox', {name: 'Wrap code'}));
    expect(docToJSON(doc)[0].props?.wrap).toBe(false);
  });
});
