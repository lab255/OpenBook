import {afterEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render} from '@testing-library/react';
import {BlockEditor} from '../BlockEditor';
import {blockProp, createDoc, rootBlocks} from '../model';
import {emojiPicker} from '@/lib/emojiPicker';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('text block controls', () => {
  it('keeps a native accessible todo input and paints the tick from checked state', () => {
    const doc = createDoc([{type: 'todo'}]);
    const {container, getByRole} = render(<BlockEditor doc={doc} />);
    expect(container.querySelector('.obe-todo-tick')).toBeNull();
    fireEvent.click(getByRole('checkbox', {name: 'Mark as done'}));
    expect(blockProp(rootBlocks(doc).get(0), 'checked')).toBe(true);
    expect(container.querySelector('.obe-todo-check .obe-todo-tick')).not.toBeNull();
    expect(getByRole('checkbox', {name: 'Mark as not done'})).toBeDefined();
  });

  it('persists a picked icon without cycling the legacy variant', () => {
    const open = vi.spyOn(emojiPicker, 'open');
    const doc = createDoc([{type: 'callout', props: {variant: 'warn'}}]);
    const {getByRole} = render(<BlockEditor doc={doc} />);
    fireEvent.click(getByRole('button', {name: 'Change callout icon'}));
    expect(open.mock.calls[0][1]).toBe('⚠️');
    act(() => open.mock.calls[0][2]('lucide:Star'));
    expect(blockProp(rootBlocks(doc).get(0), 'icon')).toBe('lucide:Star');
    expect(blockProp(rootBlocks(doc).get(0), 'variant')).toBe('warn');
  });

  it('renders the chosen icon without a picker in read-only mode', () => {
    const doc = createDoc([{type: 'callout', props: {icon: '🌱'}}, {type: 'todo', props: {checked: true}}]);
    const {container, queryByRole, getByRole} = render(<BlockEditor doc={doc} readOnly />);
    expect(container.querySelector('.obe-callout-icon')?.textContent).toBe('🌱');
    expect(queryByRole('button', {name: 'Change callout icon'})).toBeNull();
    expect((getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });
});
