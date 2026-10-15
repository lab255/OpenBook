import {useState} from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {MeetingTabs} from '../MeetingTabs';
import {BlockEditor} from '../BlockEditor';
import {registerArtifactKit} from '../kit';
import {createDoc, docToJSON} from '../model';
import {writeSelection} from '../richtext';

registerArtifactKit();
afterEach(cleanup);

function DraftNote() {
  const [draft, setDraft] = useState('');
  return <input aria-label="Draft note" value={draft} onChange={(event) => setDraft(event.target.value)} />;
}

describe('meeting tabs', () => {
  it('preserves mounted pane state and DOM identity across keyboard and pointer switches', () => {
    render(<MeetingTabs attention={false} status="idle" hasSummary={false} summary="Recap" notes={<DraftNote />} transcript="Words" />);
    const note = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(note, {target: {value: 'Unsaved draft'}});
    fireEvent.click(screen.getByRole('tab', {name: 'Summary'}));
    expect(note.isConnected).toBe(true);
    expect(note.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(true);
    expect(screen.getAllByRole('tabpanel', {hidden: true})).toHaveLength(3);
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Summary'}), {key: 'ArrowRight'});
    expect(screen.getByRole('textbox')).toBe(note);
    expect(note.value).toBe('Unsaved draft');
    expect(document.activeElement).toBe(screen.getByRole('tab', {name: 'Notes'}));
  });

  it('preserves the actual CRDT notes editor across switches', () => {
    const doc = createDoc([{type: 'meeting', children: [{type: 'paragraph', text: 'Agenda'}]}]);
    const {container} = render(<BlockEditor doc={doc} />);
    const note = container.querySelector('.obe-meeting-notes .obe-text') as HTMLElement;
    act(() => { note.focus(); writeSelection(note, 0, 6); });
    act(() => { note.dispatchEvent(new InputEvent('beforeinput', {inputType: 'insertText', data: 'Edited agenda', bubbles: true, cancelable: true})); });
    const edited = docToJSON(doc);
    expect(JSON.stringify(edited)).toContain('Edited agenda');
    fireEvent.click(screen.getByRole('tab', {name: 'Transcript'}));
    fireEvent.click(screen.getByRole('tab', {name: 'Notes'}));
    expect(container.querySelector('.obe-meeting-notes .obe-text')).toBe(note);
    expect(note.textContent).toBe('Edited agenda');
    expect(docToJSON(doc)).toEqual(edited);
  });

  it.each([
    ['idle', false, 'Notes'], ['done', true, 'Summary'], ['recording', true, 'Transcript'],
    ['paused', false, 'Transcript'], ['processing', true, 'Transcript'],
  ] as const)('defaults %s with summary=%s to %s', (status, hasSummary, tab) => {
    render(<MeetingTabs attention={false} status={status} hasSummary={hasSummary} summary="Recap" notes="Agenda" transcript="Words" />);
    expect(screen.getByRole('tab', {name: tab}).getAttribute('aria-selected')).toBe('true');
  });

  it('defaults to Transcript when attention is required', () => {
    render(<MeetingTabs attention status="done" hasSummary summary="Recap" notes="Agenda" transcript="Words" />);
    expect(screen.getByRole('tab', {name: 'Transcript'}).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps Notes selected after focus when a summary arrives', () => {
    const panes = {attention: false, status: 'idle', summary: 'Recap', notes: <DraftNote />, transcript: 'Words'};
    const view = render(<MeetingTabs {...panes} hasSummary={false} />);
    fireEvent.focus(screen.getByRole('textbox'));
    view.rerender(<MeetingTabs {...panes} hasSummary />);
    expect(screen.getByRole('tab', {name: 'Notes'}).getAttribute('aria-selected')).toBe('true');
  });

  it('follows lifecycle defaults until a user chooses a pane', () => {
    const panes = {summary: 'Recap', notes: 'Agenda', transcript: 'Words', hasSummary: false};
    const view = render(<MeetingTabs attention={false} {...panes} status="idle" />);
    view.rerender(<MeetingTabs attention={false} {...panes} status="recording" />);
    expect(screen.getByRole('tab', {name: 'Transcript'}).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', {name: 'Notes'}));
    view.rerender(<MeetingTabs attention={false} {...panes} status="processing" />);
    expect(screen.getByRole('tab', {name: 'Notes'}).getAttribute('aria-selected')).toBe('true');
  });
});
