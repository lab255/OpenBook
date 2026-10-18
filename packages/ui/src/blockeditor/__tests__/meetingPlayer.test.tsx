import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {MeetingPlayer} from '../MeetingPlayer';
import type {MeetingRecorder} from '../meetingRecorder';
import {setAssetBridge} from '@/lib/assetBridge';

const saved = [{assetId: 'first', durationMs: 45000}, {assetId: 'second', durationMs: 12000}];
const retry = vi.fn();
const session = {chunks: [], retry} as unknown as MeetingRecorder;
let play: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  setAssetBridge({getAsset: async () => ({bytes: new Uint8Array([1]), mime: 'audio/webm'}), putAsset: vi.fn()});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:meeting');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { cleanup(); setAssetBridge(null); vi.restoreAllMocks(); retry.mockClear(); });
async function mount(readOnly = false) {
  const view = render(<MeetingPlayer saved={saved} completed={[]} session={session} readOnly={readOnly} canTranscribe />);
  expect(view.container.querySelectorAll('audio[src]')).toHaveLength(0);
  fireEvent.change(screen.getByRole('slider'), {target: {value: '100'}});
  await waitFor(() => expect(view.container.querySelectorAll('audio[src]')).toHaveLength(2));
  return {...view, audio: Array.from(view.container.querySelectorAll('audio'))};
}

describe('unified meeting playback', () => {
  it('preloads chunks, seeks globally, hands over automatically and stops at the end', async () => {
    const {audio} = await mount();
    expect(screen.getAllByRole('slider')).toHaveLength(1);
    fireEvent.change(screen.getByRole('slider'), {target: {value: '0'}});
    expect(screen.getByText('0:00 / 0:57')).toBeTruthy();
    expect(audio.every((element) => element.preload === 'auto' && !element.controls)).toBe(true);
    fireEvent.change(screen.getByRole('slider'), {target: {value: '44000'}});
    expect(audio[0].currentTime).toBe(44);
    fireEvent.click(screen.getByRole('button', {name: 'Play'}));
    expect(play).toHaveBeenLastCalledWith();
    fireEvent.ended(audio[0]);
    expect(play.mock.instances.at(-1)).toBe(audio[1]);
    expect(audio[1].currentTime).toBe(0);
    audio[1].currentTime = 2; fireEvent.timeUpdate(audio[1]);
    expect(screen.getByText('0:47 / 0:57')).toBeTruthy();
    fireEvent.change(screen.getByRole('slider'), {target: {value: '1000'}});
    await waitFor(() => expect(play.mock.instances.at(-1)).toBe(audio[0]));
    fireEvent.ended(audio[0]);
    await waitFor(() => expect(play.mock.instances.at(-1)).toBe(audio[1]));
    fireEvent.ended(audio[1]);
    expect(screen.getByRole('button', {name: 'Play'})).toBeTruthy();
    expect(screen.getByText('0:57 / 0:57')).toBeTruthy();
  });
  it('offers retries inside marker details and allows read-only playback without mutations', async () => {
    const view = await mount();
    expect(screen.queryByRole('button', {name: 'Retry transcription'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '0:45 · Not transcribed'}));
    fireEvent.click(screen.getByRole('button', {name: 'Retry transcription'}));
    expect(retry).toHaveBeenCalledWith({...saved[1], startedAtMs: 45000});
    view.rerender(<MeetingPlayer saved={saved} completed={[]} session={session} readOnly canTranscribe />);
    expect(screen.queryByRole('button', {name: 'Retry transcription'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Play'}));
    expect(play).toHaveBeenCalled();
  });
  it('preserves persisted completion keys for legacy chunks without offsets', () => {
    render(<MeetingPlayer saved={saved} completed={['0:first', '0:second']} session={session} readOnly={false} canTranscribe />);
    fireEvent.click(screen.getByRole('button', {name: '0:45 · Transcribed'}));
    expect(screen.queryByRole('button', {name: 'Retry transcription'})).toBeNull();
  });
  it('surfaces playback rejection and releases object URLs on unmount', async () => {
    const view = await mount(true);
    play.mockRejectedValueOnce(new Error('blocked'));
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Play'})));
    expect(screen.getByRole('alert').textContent).toContain('could not be played');
    expect(screen.getByRole('button', {name: 'Play'})).toBeTruthy();
    const pauses = vi.mocked(HTMLMediaElement.prototype.pause); pauses.mockClear();
    view.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(pauses.mock.instances).toContain(view.audio[0]);
    expect(pauses.mock.instances).toContain(view.audio[1]);
  });
  it('resumes pending audio when it becomes saved during playback', async () => {
    const blob = new Blob(['audio'], {type: 'audio/webm'});
    const pending = {chunks: [{id: 'pending', audio: {...saved[0], assetId: '', startedAtMs: 0}, blob, phase: 'uploading'}], retry} as unknown as MeetingRecorder;
    const view = render(<MeetingPlayer saved={[]} completed={[]} session={pending} readOnly={false} canTranscribe />);
    fireEvent.click(screen.getByRole('button', {name: 'Play'}));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    const audio = view.container.querySelector('audio')!;
    audio.currentTime = 2;
    fireEvent.timeUpdate(audio);
    view.rerender(<MeetingPlayer saved={[saved[0]]} completed={[]} session={session} readOnly={false} canTranscribe />);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    expect(view.container.querySelector('audio')).toBe(audio);
    expect(audio.currentTime).toBe(2);
    expect(screen.getByRole('button', {name: 'Pause playback'})).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('loads only the active and next chunk and advances the window on handover', async () => {
    const view = render(<MeetingPlayer saved={[...saved, {assetId: 'third', durationMs: 10000}]} completed={[]} session={session} readOnly canTranscribe />);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(view.container.querySelectorAll('audio[src]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', {name: 'Play'}));
    await waitFor(() => expect(view.container.querySelectorAll('audio[src]')).toHaveLength(2));
    const audio = view.container.querySelectorAll('audio');
    expect(audio[2].hasAttribute('src')).toBe(false);
    fireEvent.ended(audio[0]);
    await waitFor(() => expect(audio[2].hasAttribute('src')).toBe(true));
    expect(audio[0].hasAttribute('src')).toBe(false);
    expect(view.container.querySelectorAll('audio[src]')).toHaveLength(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(play.mock.instances.at(-1)).toBe(audio[1]);
  });
  it.each([false, true])('queues a seek before URLs load (play=%s)', async (playing) => {
    let release!: (value: {bytes: Uint8Array; mime: string}) => void;
    setAssetBridge({getAsset: () => new Promise((resolve) => { release = resolve; }), putAsset: vi.fn()});
    const view = render(<MeetingPlayer saved={[saved[0]]} completed={[]} session={session} readOnly canTranscribe />);
    fireEvent.change(screen.getByRole('slider'), {target: {value: '2000'}});
    if (playing) fireEvent.click(screen.getByRole('button', {name: 'Play'}));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(play).not.toHaveBeenCalled();
    await act(async () => release({bytes: new Uint8Array([1]), mime: 'audio/webm'}));
    expect(view.container.querySelector('audio')!.currentTime).toBe(2);
    expect(play).toHaveBeenCalledTimes(playing ? 1 : 0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps normal uploading quiet and announces status without opening details', () => {
    const pending = {chunks: [{id: 'pending', audio: {...saved[0], startedAtMs: 0}, blob: new Blob(['audio']), phase: 'uploading'}], retry} as unknown as MeetingRecorder;
    const view = render(<MeetingPlayer saved={[]} completed={[]} session={pending} readOnly={false} canTranscribe />);
    expect(view.container.querySelector('[data-attention="true"]')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Save audio copy')).toBeNull();
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByRole('status').textContent).toContain('Saving audio');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('renders failures inline, collapses more than two, and resolves them without floating surfaces', () => {
    const audio = [...saved, {assetId: 'third', durationMs: 1000}].map((chunk, index) => ({...chunk, startedAtMs: index * 45000}));
    const failedSession = {chunks: audio.map((chunk) => ({audio: chunk, phase: 'untranscribed', error: 'Service failed'})), retry} as unknown as MeetingRecorder;
    const view = render(<MeetingPlayer saved={audio} completed={[]} session={failedSession} readOnly={false} canTranscribe />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(view.container.querySelectorAll('[data-attention="true"]')).toHaveLength(3);
    expect(screen.queryByRole('button', {name: 'Retry transcription'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '3 chunks not transcribed'}));
    expect(screen.getAllByRole('button', {name: 'Retry transcription'})).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('button', {name: 'Retry transcription'})[0]);
    expect(retry).toHaveBeenCalledWith(audio[0]);
    view.rerender(<MeetingPlayer saved={audio} completed={audio.map((chunk) => `${chunk.startedAtMs}:${chunk.assetId}`)} session={session} readOnly={false} canTranscribe />);
    expect(view.container.querySelectorAll('.obe-meeting-attention')).toHaveLength(0);
  });
  it('offers upload recovery only on failed rows and user-opened popovers', () => {
    const upload = vi.fn();
    const pending = {chunks: [{id: 'pending', audio: {...saved[0], startedAtMs: 0}, blob: new Blob(['audio']), phase: 'uploadFailed', error: 'Upload failed'}], retry, upload} as unknown as MeetingRecorder;
    const view = render(<MeetingPlayer saved={[]} completed={[]} session={pending} readOnly={false} canTranscribe />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('link', {name: 'Save audio copy'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Retry upload'}));
    expect(upload).toHaveBeenCalledWith(pending.chunks[0]);
    fireEvent.click(screen.getByRole('button', {name: /0:00 · Upload failed/}));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getAllByRole('link', {name: 'Save audio copy'})).toHaveLength(2);
    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<MeetingPlayer saved={[]} completed={[]} session={pending} readOnly canTranscribe />);
    expect(screen.queryByRole('button', {name: 'Retry upload'})).toBeNull();
  });

});
