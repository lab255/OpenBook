import * as Y from 'yjs';
import {setLocale, t} from '@/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import type {AiTranscriptionResult} from '@book.dev/sdk';
import {setAssetBridge} from '@/lib/assetBridge';
import {registerBlockEditorDoc} from '@/lib/aiBridge';
import {AssetBridgeHost} from '@/components/AssetBridgeHost';
import {DataProvider} from '@/data';
import type {DataClient} from '@book.dev/sdk';
import {MeetingRecorder, meetingRecorder, meetingSegments, chunkKey, type MeetingAudio, type RecordingChunk} from '../meetingRecorder';
import {MeetingBlockView} from '../MeetingBlockView';
import {blockProp, createDoc, decodeSnapshot, docToJSON, encodeSnapshot, rootBlocks, setBlockProp} from '../model';
import type {BlockEditorController} from '../useBlockEditor';
import {BlockEditor} from '../BlockEditor';
import {registerArtifactKit} from '../kit';
import {blocksToHtml, blocksToMarkdown, projectBlocksForExport} from '../exportBlocks';

class Recorder {
  static instances: Recorder[] = [];
  static isTypeSupported = vi.fn((mime: string) => mime === 'audio/webm;codecs=opus');
  state = 'inactive';
  mimeType: string;
  ondataavailable?: (event: {data: Blob}) => void;
  onstop?: () => void;
  onerror?: () => void;
  start = vi.fn(() => { this.state = 'recording'; });
  stop = vi.fn(() => {
    this.state = 'inactive';
    this.ondataavailable?.({data: new Blob(['standalone audio'], {type: this.mimeType})});
    this.onstop?.();
  });
  constructor(_stream: MediaStream, options: MediaRecorderOptions) {
    this.mimeType = options.mimeType ?? 'audio/webm'; Recorder.instances.push(this);
  }
}
const track = {stop: vi.fn(), enabled: true};
const stream = {getTracks: () => [track], getAudioTracks: () => [track]} as unknown as MediaStream;
const getUserMedia = vi.fn(async () => stream);
const putAsset = vi.fn(async () => ({id: `asset-${Recorder.instances.length}`}));
const transcribeAsset = vi.fn(async (): Promise<AiTranscriptionResult> => ({text: 'hello', segments: [{start: 0.25, end: 1.5, text: 'hello'}], durationMs: 2000}));
function harness(props = {}) {
  const doc = createDoc([{type: 'meeting', props, children: [{id: 'note', type: 'paragraph', text: 'Manual note'}]}]);
  const block = rootBlocks(doc).get(0);
  const editor = {doc, readOnly: false} as BlockEditorController;
  return {doc, block, editor, session: new MeetingRecorder(editor, block, 'page')};
}
const flush = async (): Promise<void> => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(100000);
  // The DOM test environment's Blob lacks arrayBuffer; the mock recorder's payload is opaque.
  vi.stubGlobal('Blob', class extends Blob { async arrayBuffer(): Promise<ArrayBuffer> { return new ArrayBuffer(this.size); } }); vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('URL', Object.assign(URL, {createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn()}));
  Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: {getUserMedia}});
  Recorder.instances = []; track.enabled = true;
  getUserMedia.mockReset().mockResolvedValue(stream);
  putAsset.mockReset().mockImplementation(async () => ({id: `asset-${Recorder.instances.length}`}));
  transcribeAsset.mockReset().mockResolvedValue({text: 'hello', segments: [{start: 0.25, end: 1.5, text: 'hello'}], durationMs: 2000});
  setAssetBridge({putAsset, getAsset: async () => null, transcribeAsset});
});
afterEach(() => { cleanup(); setLocale('en'); setAssetBridge(null); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('meeting recording and recovery', () => {
  it('restarts recorders into independent files, pauses/resumes, saves ordered durations and transcript offsets', async () => {
    const {session, block, doc} = harness();
    await session.start();
    expect(blockProp(block, 'status')).toBe('recording');
    await vi.advanceTimersByTimeAsync(45000);
    expect(Recorder.instances).toHaveLength(2);
    expect(Recorder.instances[0].start).toHaveBeenCalledWith(); // no timeslice
    expect(putAsset).toHaveBeenCalledWith(expect.any(Uint8Array), 'audio/webm', 'page');
    await vi.advanceTimersByTimeAsync(2000);
    session.pause(); await flush();
    expect(session.mode).toBe('paused'); expect(track.enabled).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    session.resume(); expect(track.enabled).toBe(true);
    expect(Recorder.instances).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1000);
    session.stop(); await flush();
    expect(blockProp(block, 'status')).toBe('done');
    expect((blockProp<MeetingAudio[]>(block, 'audioChunks') ?? []).map(({durationMs, startedAtMs}) => ({durationMs, startedAtMs}))).toEqual([
      {durationMs: 45000, startedAtMs: 0}, {durationMs: 2000, startedAtMs: 45000}, {durationMs: 1000, startedAtMs: 47000},
    ]);
    expect(blockProp(block, 'transcript')).toEqual([
      {startMs: 250, endMs: 1500, text: 'hello'}, {startMs: 45250, endMs: 46500, text: 'hello'}, {startMs: 47250, endMs: 48500, text: 'hello'},
    ]);
    expect(docToJSON(decodeSnapshot(encodeSnapshot(doc)))).toEqual(docToJSON(doc));
    expect(track.stop).toHaveBeenCalled();
  });

  it('keeps audio on upload failure, retries with exponential backoff, then permits manual recovery', async () => {
    putAsset.mockRejectedValue(new Error('offline'));
    const {session, block} = harness();
    await session.start(); await vi.advanceTimersByTimeAsync(1500); session.stop(); await flush();
    expect(putAsset).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000); expect(putAsset).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000); expect(putAsset).toHaveBeenCalledTimes(3);
    expect(session.chunks[0].phase).toBe('uploadFailed'); expect(session.unsaved).toBe(true);
    expect(blockProp(block, 'status')).toBe('done'); expect(transcribeAsset).not.toHaveBeenCalled();
    putAsset.mockResolvedValue({id: 'recovered'});
    await session.upload(session.chunks[0]); await flush();
    expect(session.unsaved).toBe(false); expect(blockProp(block, 'status')).toBe('done');
    expect(blockProp<MeetingAudio[]>(block, 'audioChunks')?.[0].assetId).toBe('recovered');
  });

  it('retains failed transcription, allows retry without duplicate segments, and sorts late results', async () => {
    let finishFirst!: (result: AiTranscriptionResult) => void;
    transcribeAsset.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockRejectedValueOnce(new Error('OpenBook request failed (400 Bad Request)'));
    const {session, block} = harness(); await session.start();
    await vi.advanceTimersByTimeAsync(45000);
    await vi.advanceTimersByTimeAsync(2000); session.stop(); await flush();
    expect(blockProp<MeetingAudio[]>(block, 'audioChunks')).toHaveLength(2);
    expect(session.chunks[1].error).toContain('Settings → AI');
    expect(session.chunks[1].phase).toBe('untranscribed');
    await session.transcribe(session.chunks[1]);
    finishFirst({text: 'first', segments: [{start: 0, end: 1, text: 'first'}], durationMs: 1000}); await flush();
    expect(blockProp(block, 'transcript')).toEqual([{startMs: 0, endMs: 1000, text: 'first'}, {startMs: 45250, endMs: 46500, text: 'hello'}]);
    await session.transcribe(session.chunks[1]);
    expect(transcribeAsset).toHaveBeenCalledTimes(3);
    expect(blockProp(block, 'status')).toBe('done');
  });

  it('handles permission denial and cancels a late permission grant after stop', async () => {
    const {session, block} = harness();
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    await session.start(); expect(session.mode).toBe('idle'); expect(session.error).toContain('Microphone');
    expect(blockProp(block, 'status')).toBeUndefined(); expect(Recorder.instances).toHaveLength(0);
    let grant!: (stream: MediaStream) => void;
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
    const pending = session.start(); session.stop(); grant(stream); await pending;
    expect(Recorder.instances).toHaveLength(0); expect(session.active).toBe(false);
    expect(session.mode).toBe('idle'); expect(blockProp(block, 'status')).toBe('idle');
  });

  it('uses Safari mp4 when opus is unavailable and falls back to plain transcript duration', async () => {
    Recorder.isTypeSupported.mockImplementationOnce(() => false).mockImplementationOnce(() => false).mockImplementationOnce(() => true);
    const {session} = harness(); await session.start();
    expect(Recorder.instances[0].mimeType).toBe('audio/mp4'); session.stop(); await flush();
    expect(meetingSegments({text: 'plain', durationMs: 1234}, {assetId: 'a', durationMs: 999, startedAtMs: 45000}))
      .toEqual([{startMs: 45000, endMs: 46234, text: 'plain'}]);
  });
});

describe('meeting UI and exports', () => {
  it('renders editable note children and freezes both notes and recording on read-only pages and locked groups', () => {
    registerArtifactKit();
    const {doc} = harness();
    const view = render(<BlockEditor doc={doc} />);
    expect(view.container.querySelector('[data-block-text="note"]')?.getAttribute('contenteditable')).toBe('true');
    expect((screen.getByRole('button', {name: 'Record'}) as HTMLButtonElement).disabled).toBe(false);
    view.rerender(<BlockEditor doc={doc} readOnly />);
    expect(view.container.querySelector('[data-block-text="note"]')?.getAttribute('contenteditable')).toBe('false');
    expect((screen.getByRole('button', {name: 'Record'}) as HTMLButtonElement).disabled).toBe(true);
    view.unmount();
    const locked = createDoc([{type: 'group', props: {locked: true}, children: docToJSON(doc)}]);
    const group = render(<BlockEditor doc={locked} />);
    expect(group.container.querySelector('[data-block-text="note"]')?.getAttribute('contenteditable')).toBe('false');
    expect((screen.getByRole('button', {name: 'Record'}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('wires no-AI client capability through the bridge and disables transcription without disabling recording', async () => {
    const {editor, block, doc} = harness({audioChunks: [{assetId: 'saved', durationMs: 2000}]});
    const unregister = registerBlockEditorDoc('page', doc);
    const client = {supportsTranscription: false, putAsset, getAsset: async () => null, transcribeAsset} as unknown as DataClient;
    render(<DataProvider client={client}><AssetBridgeHost /><MeetingBlockView editor={editor} block={block} pageReadOnly={false} /></DataProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByText(/Transcription requires a connected/)).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Retry transcription'}) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Record'})); await flush(); });
    expect(screen.getByRole('button', {name: 'Pause'})).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Stop'})); await flush(); });
    expect(putAsset).toHaveBeenCalled(); expect(transcribeAsset).not.toHaveBeenCalled(); unregister();
  });

  it('exports title, timestamped transcript, summary and nested notes without raw status in all three projections', () => {
    const {doc} = harness({title: 'Planning <team>', status: 'done', summary: 'Next steps', transcript: [{startMs: 61500, endMs: 62000, text: 'Discussion <safe>'}]});
    const blocks = docToJSON(doc);
    const html = blocksToHtml(blocks); const markdown = blocksToMarkdown(blocks); const standalone = JSON.stringify(projectBlocksForExport(blocks));
    for (const output of [html, markdown, standalone]) {
      expect(output).toContain('Planning'); expect(output).not.toContain('done'); expect(output).not.toContain('Transcript incomplete'); expect(output).toContain('1:01');
      expect(output).toContain('Discussion'); expect(output).toContain('Next steps'); expect(output).toContain('Manual note');
    }
    expect(html).toContain('&lt;safe&gt;'); expect(standalone).toContain('&lt;safe&gt;');
  });
});

describe('meeting asynchronous boundaries', () => {
  it('commits audio in capture order when uploads complete in reverse order', async () => {
    let first!: (asset: {id: string}) => void;
    putAsset.mockImplementationOnce(() => new Promise((resolve) => { first = resolve; }))
      .mockResolvedValueOnce({id: 'second'});
    const {session, block} = harness(); await session.start();
    await vi.advanceTimersByTimeAsync(45000);
    await vi.advanceTimersByTimeAsync(1000); session.stop(); await flush();
    expect(blockProp<MeetingAudio[]>(block, 'audioChunks')?.[0].assetId).toBe('second');
    first({id: 'first'}); await flush();
    expect(blockProp<MeetingAudio[]>(block, 'audioChunks')?.map((audio) => audio.assetId)).toEqual(['first', 'second']);
    expect(blockProp(block, 'status')).toBe('done');
  });

  it('ignores a stale permission rejection after a new recording has started', async () => {
    let deny!: (error: Error) => void;
    getUserMedia.mockImplementationOnce(() => new Promise((_resolve, reject) => { deny = reject; }));
    const {session} = harness(); const oldRequest = session.start(); session.stop();
    await session.start(); expect(session.mode).toBe('recording');
    deny(new Error('old permission denied')); await oldRequest;
    expect(session.mode).toBe('recording'); expect(session.error).toBe('');
    session.stop(); await flush();
  });

  it('waits for the final asynchronous data event before declaring done', async () => {
    const {session, block} = harness(); await session.start();
    const recorder = Recorder.instances[0];
    recorder.stop.mockImplementation(() => {
      recorder.state = 'inactive';
      setTimeout(() => { recorder.ondataavailable?.({data: new Blob(['last'])}); recorder.onstop?.(); }, 100);
    });
    session.stop(); expect(blockProp(block, 'status')).toBe('processing');
    await vi.advanceTimersByTimeAsync(100);
    expect(blockProp<MeetingAudio[]>(block, 'audioChunks')).toHaveLength(1);
    expect(blockProp(block, 'status')).toBe('done');
  });

  it.each([403, 404, 502])('keeps audio and a retryable chunk after transcription HTTP %s', async (status) => {
    transcribeAsset.mockRejectedValue(new Error(`OpenBook request failed (${status})`));
    const {session, block} = harness(); await session.start(); session.stop(); await flush();
    await vi.advanceTimersByTimeAsync(3000);
    expect(blockProp<MeetingAudio[]>(block, 'audioChunks')).toHaveLength(1);
    expect(session.chunks[0].phase).toBe('untranscribed');
    expect(session.chunks[0].error).toBeTruthy(); expect(session.unsaved).toBe(false);
    expect(blockProp(block, 'status')).toBe('done');
  });

  it('shows permission errors and actionable configuration errors with working retry buttons', async () => {
    const {block, editor, doc} = harness(); const unregister = registerBlockEditorDoc('page', doc);
    render(<MeetingBlockView block={block} editor={editor} pageReadOnly={false} />);
    getUserMedia.mockRejectedValueOnce(new Error('denied'));
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Record'})); await flush(); });
    expect(screen.getByRole('alert').textContent).toContain('Allow microphone access');
    transcribeAsset.mockRejectedValueOnce(new Error('400'));
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Record'})); await flush(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Stop'})); await flush(); });
    expect(screen.getByRole('alert').textContent).toContain('Settings → AI');
    expect(screen.getByText('Not transcribed')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Retry transcription'})); await flush(); });
    expect(screen.getByText('Transcribed')).toBeTruthy(); expect(screen.getByText('hello')).toBeTruthy();
    unregister();
  });
});

describe('MEET-5 review regressions', () => {
  it('counts only recorded time across pauses, async finalization, later sessions and reopened blocks', async () => {
    const {session, block, doc} = harness();
    await session.start(); await vi.advanceTimersByTimeAsync(2000);
    expect(session.elapsedMs).toBe(2000);
    const first = Recorder.instances[0];
    first.stop.mockImplementation(() => {
      first.state = 'inactive';
      setTimeout(() => { first.ondataavailable?.({data: new Blob(['first'])}); first.onstop?.(); }, 100);
    });
    session.pause(); expect(session.elapsedMs).toBe(2000);
    await vi.advanceTimersByTimeAsync(3000); expect(session.elapsedMs).toBe(2000);
    session.resume(); await vi.advanceTimersByTimeAsync(1000);
    expect(session.elapsedMs).toBe(3000); session.stop(); await flush();
    await vi.advanceTimersByTimeAsync(60000); expect(session.elapsedMs).toBe(3000);
    await session.start(); await vi.advanceTimersByTimeAsync(1000); session.stop(); await flush();
    expect(session.elapsedMs).toBe(4000);
    expect(blockProp<MeetingAudio[]>(block, 'audioChunks')?.map((audio) => audio.startedAtMs)).toEqual([0, 2000, 3000]);
    const reopened = decodeSnapshot(encodeSnapshot(doc)); const reopenedBlock = rootBlocks(reopened).get(0);
    const next = new MeetingRecorder({doc: reopened, readOnly: false} as BlockEditorController, reopenedBlock, 'page');
    await vi.advanceTimersByTimeAsync(60000); await next.start(); await vi.advanceTimersByTimeAsync(1000); next.stop(); await flush();
    expect(next.elapsedMs).toBe(5000);
    expect(blockProp<MeetingAudio[]>(reopenedBlock, 'audioChunks')?.slice(-1)[0]?.startedAtMs).toBe(4000);
  });

  it('keeps oversized audio recoverable without bricking Record or adding idle gaps', async () => {
    const {editor, block, doc} = harness(); const unregister = registerBlockEditorDoc('page', doc);
    render(<MeetingBlockView block={block} editor={editor} pageReadOnly={false} />);
    const session = meetingRecorder(editor, block, 'page');
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Record'})); await flush(); });
    const recorder = Recorder.instances[0];
    recorder.stop.mockImplementation(() => {
      recorder.state = 'inactive';
      recorder.ondataavailable?.({data: new Blob([new Uint8Array(10 * 1024 * 1024 + 1)])}); recorder.onstop?.();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); fireEvent.click(screen.getByRole('button', {name: 'Stop'})); await flush(); });
    expect(session.mode).toBe('done'); expect(session.unsaved).toBe(true); expect(putAsset).not.toHaveBeenCalled();
    expect((screen.getByRole('button', {name: 'Record'}) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('link', {name: 'Save audio copy'})).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Retry upload'})); await flush(); });
    expect(session.unsaved).toBe(true); expect(session.mode).toBe('done');
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); fireEvent.click(screen.getByRole('button', {name: 'Record'})); await flush(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); fireEvent.click(screen.getByRole('button', {name: 'Stop'})); await flush(); });
    expect(blockProp<MeetingAudio[]>(block, 'audioChunks')?.[0].startedAtMs).toBe(2000);
    expect(session.elapsedMs).toBe(3000); unregister();
    // Dispose the recovery guard after checking the retained blob.
    session.chunks[0].blob = undefined;
    await act(async () => { await session.start(); session.stop(); await flush(); });
  });

  it('keeps one focused toggle and announces only status, with no idle timer', async () => {
    const {editor, block, doc} = harness(); const unregister = registerBlockEditorDoc('page', doc);
    const interval = vi.spyOn(globalThis, 'setInterval');
    const view = render(<MeetingBlockView block={block} editor={editor} pageReadOnly={false} />);
    expect(interval).not.toHaveBeenCalled();
    const toggle = screen.getByRole('button', {name: 'Record'}); toggle.focus();
    await act(async () => { fireEvent.click(toggle); await flush(); });
    expect(screen.getByRole('button', {name: 'Pause'})).toBe(toggle); expect(document.activeElement).toBe(toggle);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    const status = view.container.querySelector('header [role="status"]')!;
    expect(status.textContent).toBe('Recording');
    const timer = status.nextElementSibling!;
    expect(timer.getAttribute('aria-hidden')).toBe('true'); expect(timer.textContent).toBe('0:02');
    await act(async () => { fireEvent.click(toggle); await flush(); });
    expect(screen.getByRole('button', {name: 'Resume'})).toBe(toggle); expect(document.activeElement).toBe(toggle);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(timer.textContent).toBe('0:02'); expect(status.textContent).toBe('Paused');
    await act(async () => { fireEvent.click(toggle); await flush(); });
    expect(screen.getByRole('button', {name: 'Pause'})).toBe(toggle); expect(document.activeElement).toBe(toggle);
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Stop'})); await flush(); });
    expect(vi.getTimerCount()).toBe(0); interval.mockRestore(); unregister();
  });

  it('edits the durable title through KitFrame and distinguishes page read-only from section locks', () => {
    registerArtifactKit(); const {doc, block} = harness({title: 'Planning'});
    const view = render(<BlockEditor doc={doc} />);
    expect(view.container.querySelector('.obe-kit-meeting')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', {name: 'Display name'}), {target: {value: 'Weekly planning'}});
    expect(blockProp(block, 'title')).toBe('Weekly planning'); expect(blockProp(block, 'label')).toBeUndefined();
    view.rerender(<BlockEditor doc={doc} readOnly />);
    expect(screen.queryByRole('textbox', {name: 'Display name'})).toBeNull();
    expect(screen.getByText('Read-only meeting')).toBeTruthy(); view.unmount();
    const locked = createDoc([{type: 'group', props: {locked: true}, children: docToJSON(doc)}]);
    const group = render(<BlockEditor doc={locked} />);
    expect(group.container.querySelector('.obe-kit-meeting input')).toBeNull();
    expect(screen.getByText('Meeting locked by its section')).toBeTruthy();
  });

  it('does not append a second transcript when a remote completion arrives during the await', async () => {
    const audio = {assetId: 'shared', durationMs: 1000, startedAtMs: 0};
    const {editor, block, doc, session} = harness({status: 'done', audioChunks: [audio]});
    const remoteDoc = decodeSnapshot(encodeSnapshot(doc)); const remoteBlock = rootBlocks(remoteDoc).get(0);
    const remote = new MeetingRecorder({...editor, doc: remoteDoc}, remoteBlock, 'page');
    let complete!: (result: AiTranscriptionResult) => void;
    transcribeAsset.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const chunk: RecordingChunk = {id: 'local', audio, phase: 'untranscribed'};
    const pending = session.transcribe(chunk);
    await remote.transcribe({id: 'remote', audio, phase: 'untranscribed'});
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remoteDoc));
    complete({text: 'duplicate', durationMs: 1000}); await pending;
    expect(blockProp(block, 'transcript')).toEqual([{startMs: 250, endMs: 1500, text: 'hello'}]);
    expect(blockProp(block, 'transcriptionCompleted')).toEqual([chunkKey(audio)]);
    expect(chunk.phase).toBe('done'); expect(chunk.busy).toBe(false);
  });

  it.each(['recording', 'processing'])('blocks a new local recording when the persisted status is %s', async (status) => {
    const {doc, block, editor, session} = harness({status});
    render(<MeetingBlockView block={block} editor={editor} pageReadOnly={false} />);
    expect((screen.getByRole('button', {name: 'Record'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Recording or processing on another client.')).toBeTruthy();
    await session.start(); expect(getUserMedia).not.toHaveBeenCalled();
    expect(blockProp(block, 'status')).toBe(status);
    // A remote completion is observed by the editor and unblocks recording.
    cleanup(); registerArtifactKit(); const view = render(<BlockEditor doc={doc} />);
    act(() => doc.transact(() => setBlockProp(block, 'status', 'done')));
    expect((screen.getByRole('button', {name: 'Record'}) as HTMLButtonElement).disabled).toBe(false);
    view.unmount();
  });

  it('abandons a permission grant if another client starts recording first', async () => {
    const {session, doc, block} = harness(); let grant!: (stream: MediaStream) => void;
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
    const pending = session.start(); doc.transact(() => setBlockProp(block, 'status', 'recording'));
    grant(stream); await pending;
    expect(Recorder.instances).toHaveLength(0); expect(session.recordingElsewhere).toBe(true);
    expect(blockProp(block, 'status')).toBe('recording'); expect(blockProp(block, 'startedAt')).toBeUndefined();
  });

  it('enforces effective read-only inside start, including permission-time changes', async () => {
    const {block, editor, doc} = harness(); const unregister = registerBlockEditorDoc('page', doc);
    render(<MeetingBlockView block={block} editor={editor} pageReadOnly />);
    const session = meetingRecorder(editor, block, 'page');
    expect(editor.readOnly).toBe(false); await session.start(); expect(getUserMedia).not.toHaveBeenCalled();
    cleanup(); session.readOnly = false;
    let grant!: (stream: MediaStream) => void;
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
    const pending = session.start(); session.readOnly = true; grant(stream); await pending;
    expect(Recorder.instances).toHaveLength(0); expect(session.mode).toBe('idle'); unregister();
  });

  it('never persists done when cancelling a permission prompt without audio or startedAt', async () => {
    const {session, block} = harness(); const statuses: unknown[] = [];
    block.observeDeep(() => statuses.push(blockProp(block, 'status')));
    let grant!: (stream: MediaStream) => void;
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
    const pending = session.start(); session.stop(); grant(stream); await pending;
    expect(statuses).not.toContain('done'); expect(blockProp(block, 'status')).toBe('idle');
    expect(blockProp(block, 'startedAt')).toBeUndefined(); expect(session.mode).toBe('idle');
  });

  it('retains the pending audio element identity when an earlier upload leaves the list', async () => {
    let first!: (asset: {id: string}) => void;
    putAsset.mockImplementationOnce(() => new Promise((resolve) => { first = resolve; })).mockRejectedValue(new Error('offline'));
    const {block, editor, doc} = harness(); const unregister = registerBlockEditorDoc('page', doc);
    const view = render(<MeetingBlockView block={block} editor={editor} pageReadOnly={false} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Record'})); await flush(); await vi.advanceTimersByTimeAsync(45000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); fireEvent.click(screen.getByRole('button', {name: 'Stop'})); await flush(); });
    const second = screen.getByLabelText('Play audio chunk starting at 0:45');
    await act(async () => { first({id: 'first'}); await flush(); });
    expect(screen.getByLabelText('Play audio chunk starting at 0:45')).toBe(second);
    await act(async () => { putAsset.mockResolvedValue({id: 'second'}); await vi.advanceTimersByTimeAsync(1000); });
    expect(view.container.querySelectorAll('audio')).toHaveLength(0); // saved assets are unavailable in this mock bridge
    unregister();
  });

  it.each(['en', 'de', 'ja', 'zh'] as const)('exports translated incompleteness and hour timestamps in %s', (locale) => {
    setLocale(locale);
    for (const status of ['idle', 'recording', 'processing', 'done']) {
      const {doc} = harness({status, transcript: [{startMs: 5423000, endMs: 5424000, text: 'Long meeting'}]});
      const blocks = docToJSON(doc);
      for (const output of [blocksToHtml(blocks), blocksToMarkdown(blocks), JSON.stringify(projectBlocksForExport(blocks))]) {
        expect(output).toContain('1:30:23'); expect(output).not.toContain(status);
        if (status === 'done') expect(output).not.toContain(t('meetingBlock.incomplete'));
        else expect(output).toContain(t('meetingBlock.incomplete'));
        expect(output).toContain('Manual note');
      }
    }
  });
});
