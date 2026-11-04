import * as Y from 'yjs';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ConfirmProvider} from '@/providers/ConfirmProvider';
import {copyText} from '@/lib/pageActions';
import {showToast} from '@/components/ui/toast';
import {MeetingManagementMenu} from '../MeetingManagementMenu';
import {deleteMeetingTranscript, meetingTranscriptLines, retryFailedTranscriptions} from '../meetingManagement';
import {blockProp, createDoc, docToJSON, rootBlocks} from '../model';
import {blocksToMarkdown} from '../exportBlocks';
import type {BlockEditorController} from '../useBlockEditor';
import type {MeetingRecorder, RecordingChunk} from '../meetingSessions';

vi.mock('@/lib/pageActions', () => ({copyText: vi.fn(async () => true)}));
vi.mock('@/components/ui/toast', () => ({showToast: vi.fn()}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const transcript = [{startMs: 0, endMs: 1000, text: 'Hello'}, {startMs: 65000, endMs: 66000, text: 'Next steps'}];
const audio = {assetId: 'a', durationMs: 66000};
function harness(readOnly = false, empty = false, chunks: RecordingChunk[] = [], canTranscribe = true) {
  const doc = createDoc([{type: 'meeting', props: {transcript: empty ? [] : transcript, audioChunks: empty ? [] : [audio], transcriptionCompleted: ['0:a'], summary: 'Summary'}, children: [{type: 'paragraph', text: [{t: 'Notes'}]}]}]);
  const block = rootBlocks(doc).get(0);
  const retry = vi.fn();
  const session = {chunks, retry} as unknown as MeetingRecorder;
  const generate = vi.fn(async () => {});
  const showTab = vi.fn();
  render(<ConfirmProvider><MeetingManagementMenu block={block} editor={{doc} as BlockEditorController}
    session={session} readOnly={readOnly} saved={empty ? [] : [audio]} transcript={empty ? [] : transcript}
    canTranscribe={canTranscribe} showTab={showTab} summary={{label: 'Generate summary', generate, canGenerate: true}} exporting={false} onExport={vi.fn(async () => {})} /></ConfirmProvider>);
  return {doc, block, generate, retry, showTab};
}
function openMenu() { fireEvent.keyDown(screen.getByRole('button', {name: 'Meeting actions'}), {key: 'ArrowDown'}); }

describe('meeting management', () => {
  it('retries exactly failed transcription chunks through the session service', () => {
    const chunk = (phase: RecordingChunk['phase'], extra: Partial<RecordingChunk> = {}): RecordingChunk => ({id: phase, phase, audio, ...extra});
    const failed = chunk('untranscribed', {error: 'failed'});
    const retry = vi.fn();
    retryFailedTranscriptions({retry, chunks: [failed, chunk('untranscribed'), chunk('untranscribed', {error: 'busy', busy: true}), chunk('uploadFailed', {error: 'upload'}), chunk('done'), chunk('transcribing'), chunk('untranscribed', {error: 'missing', audio: {...audio, assetId: ''}})]});
    expect(retry.mock.calls).toEqual([[failed.audio]]);
  });
  it('copies export-format transcript text and announces success', async () => {
    harness(true); openMenu();
    await act(async () => fireEvent.click(screen.getByRole('menuitem', {name: 'Copy transcript'})));
    expect(copyText).toHaveBeenCalledWith('[0:00] Hello\n[1:05] Next steps');
    expect(showToast).toHaveBeenCalledWith({message: 'Transcript copied'});
    const markdown = blocksToMarkdown([{id: 'm', type: 'meeting', props: {transcript, status: 'done'}}]);
    for (const line of meetingTranscriptLines(transcript)) expect(markdown).toContain(line.replace(/\[/g, '\\[').replace(/\]/g, '\\]'));
  });
  it('reports clipboard failure without claiming success', async () => {
    vi.mocked(copyText).mockResolvedValueOnce(false);
    harness(true); openMenu();
    await act(async () => fireEvent.click(screen.getByRole('menuitem', {name: 'Copy transcript'})));
    expect(showToast).toHaveBeenCalledWith({message: 'Could not copy transcript'});
  });
  it('clears transcript and completion markers in one transaction, preserving other content', () => {
    const {doc, block} = harness();
    const before = docToJSON(doc);
    const updates = vi.fn(); doc.on('update', updates);
    deleteMeetingTranscript(doc, block);
    expect(updates).toHaveBeenCalledTimes(1);
    expect(docToJSON(doc)).toEqual(before.map((b) => ({...b, props: {...b.props, transcript: [], transcriptionCompleted: []}})));
  });
  it('requires destructive confirmation and supports cancellation', async () => {
    const {block} = harness(); openMenu();
    await act(async () => fireEvent.click(screen.getByRole('menuitem', {name: 'Delete transcript'})));
    expect(screen.getByRole('dialog').textContent).toContain('Audio, summary and notes are kept');
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Cancel'})));
    expect(blockProp(block, 'transcript')).toEqual(transcript);
    openMenu();
    await act(async () => fireEvent.click(screen.getByRole('menuitem', {name: 'Delete transcript'})));
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Delete transcript'})));
    expect(blockProp(block, 'transcript')).toEqual([]);
  });
  it('shows only export and copy in read-only mode', () => {
    harness(true); openMenu();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Export audio', 'Copy transcript']);
  });
  it('hides the read-only menu when there is nothing to export or copy', () => {
    harness(true, true);
    expect(screen.queryByRole('button', {name: 'Meeting actions'})).toBeNull();
  });
  it('hides bulk retry when no chunks failed and invokes the shared summary action', async () => {
    const {generate} = harness(); openMenu();
    expect(screen.queryByRole('menuitem', {name: 'Retry failed transcriptions'})).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('menuitem', {name: 'Generate summary'})));
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('retries the one failed chunk from the menu and opens Transcript', async () => {
    const failed: RecordingChunk = {id: 'failed', phase: 'untranscribed', error: 'failed', audio};
    const {retry, showTab} = harness(false, false, [failed]);
    openMenu();
    const item = screen.getByRole('menuitem', {name: 'Retry failed transcriptions'});
    expect(item.getAttribute('aria-disabled')).not.toBe('true');
    await act(async () => fireEvent.click(item));
    expect(showTab).toHaveBeenCalledWith('transcript');
    expect(retry.mock.calls).toEqual([[failed.audio]]);
  });
  it('disables retry when failures exist but transcription is unavailable', () => {
    harness(false, false, [{id: 'failed', phase: 'untranscribed', error: 'failed', audio}], false);
    openMenu();
    expect(screen.getByRole('menuitem', {name: 'Retry failed transcriptions'}).getAttribute('aria-disabled')).toBe('true');
  });
  it.each([false, true])('only warns about new text when a chunk is pending=%s', async (pending) => {
    harness(false, false, pending ? [{id: 'pending', phase: 'transcribing', busy: true, audio}] : []);
    openMenu();
    await act(async () => fireEvent.click(screen.getByRole('menuitem', {name: 'Delete transcript'})));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Delete transcript?');
    expect(dialog.textContent?.includes('Transcription still in progress may add new text.')).toBe(pending);
  });
  it('undoes transcript deletion and restores both props', () => {
    const {doc, block} = harness();
    const undo = new Y.UndoManager(rootBlocks(doc), {trackedOrigins: new Set(['local'])});
    deleteMeetingTranscript(doc, block);
    expect(blockProp(block, 'transcript')).toEqual([]);
    expect(blockProp(block, 'transcriptionCompleted')).toEqual([]);
    undo.undo();
    expect(blockProp(block, 'transcript')).toEqual(transcript);
    expect(blockProp(block, 'transcriptionCompleted')).toEqual(['0:a']);
    undo.destroy();
  });

});
