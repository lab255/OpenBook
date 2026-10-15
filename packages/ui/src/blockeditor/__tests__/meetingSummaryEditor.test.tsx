import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {BlockEditor} from '../BlockEditor';
import {registerArtifactKit} from '../kit';
import {createDoc, docToJSON} from '../model';
import {writeSelection} from '../richtext';
import {setAiBridge} from '@/lib/aiBridge';

registerArtifactKit();
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setAiBridge(null); });

describe('meeting summary editor', () => {
  it('edits ordinary summary blocks, checks todos, and isolates notes across tab switches', () => {
    const doc = createDoc([{id: 'm', type: 'meeting', children: [
      {id: 'm:summary', type: 'meetingsummary', children: [{type: 'paragraph', text: 'Recap'}, {type: 'todo', text: 'Ship', props: {checked: false}}]},
      {type: 'paragraph', text: 'Notes'},
    ]}]);
    const {container} = render(<BlockEditor doc={doc} />);
    const text = container.querySelector('.obe-meeting-summary .obe-text') as HTMLElement;
    act(() => { text.focus(); writeSelection(text, 0, 5); });
    act(() => { text.dispatchEvent(new InputEvent('beforeinput', {inputType: 'insertText', data: 'Edited recap', bubbles: true, cancelable: true})); });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(JSON.stringify(docToJSON(doc))).toContain('Edited recap');
    expect(docToJSON(doc)[0].children?.[0].children?.[1].props?.checked).toBe(true);
    fireEvent.click(screen.getByRole('tab', {name: 'Notes'}));
    expect(container.querySelectorAll('.obe-meeting-notes .obe-text')).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', {name: 'Summary'}));
    expect(container.querySelector('.obe-meeting-summary .obe-text')).toBe(text);
  });
  it('creates a legacy summary only on explicit edit and confirms before regeneration', async () => {
    const generate = vi.fn().mockResolvedValue('Replacement');
    setAiBridge({ready: () => true, generate, complete: vi.fn(), tasks: vi.fn(), applyProposals: vi.fn(), applySuggestion: vi.fn()});
    const doc = createDoc([{id: 'm', type: 'meeting', props: {summary: 'Old summary', transcript: [{startMs: 0, endMs: 1, text: 'Hello'}]}, children: [{type: 'paragraph', text: 'Note'}]}]);
    render(<BlockEditor doc={doc} />);
    expect(docToJSON(doc)[0].children).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', {name: 'Edit summary'}));
    const before = docToJSON(doc);
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirm);
    fireEvent.click(screen.getByRole('button', {name: 'Regenerate summary'}));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
    expect(docToJSON(doc)).toEqual(before);
    confirm.mockReturnValue(true);
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Regenerate summary'})));
    expect(JSON.stringify(docToJSON(doc))).toContain('Replacement');
    expect(docToJSON(doc)[0].children?.slice(1)).toEqual(before[0].children?.slice(1));
  });
});
