import {afterEach, describe, expect, it} from 'vitest';
import {act, cleanup, render} from '@testing-library/react';
import {BlockEditor} from '../BlockEditor';
import {createDoc, type BlockType} from '../model';

afterEach(cleanup);

describe('text placeholders', () => {
  it.each([
    ['list', 'List item'], ['todo', 'To-do'], ['quote', 'Quote'],
    ['callout', 'Callout'], ['notes', 'Note for the presenter'],
  ])('shows %s hint only while focused', (type, hint) => {
    const doc = createDoc([{id: 'a', type: type as BlockType}, {id: 'b', type: 'paragraph'}]);
    const {container} = render(<BlockEditor doc={doc} />);
    const a = container.querySelector('[data-block-text="a"]') as HTMLElement;
    const b = container.querySelector('[data-block-text="b"]') as HTMLElement;
    expect(a.getAttribute('data-placeholder')).toBeNull();
    act(() => a.focus());
    expect(a.getAttribute('data-placeholder')).toBe(hint);
    act(() => b.focus());
    expect(a.getAttribute('data-placeholder')).toBeNull();
  });
  it('keeps heading, code and sole-paragraph hints without focus', () => {
    const doc = createDoc([{id: 'h', type: 'heading', props: {level: 3}}, {id: 'c', type: 'code'}]);
    const {container, unmount} = render(<BlockEditor doc={doc} />);
    expect(container.querySelector('[data-block-text="h"]')?.getAttribute('data-placeholder')).toBe('Heading 3');
    expect(container.querySelector('[data-block-text="c"]')?.getAttribute('data-placeholder')).toBe('Code');
    unmount();
    const page = render(<BlockEditor doc={createDoc([{type: 'paragraph'}])} />);
    expect(page.container.querySelector('[data-block-text]')?.getAttribute('data-placeholder')).toBe('Type “/” for commands…');
  });
});
