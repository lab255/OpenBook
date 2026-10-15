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
  await waitFor(() => expect(view.container.querySelectorAll('audio')).toHaveLength(2));
  return {...view, audio: Array.from(view.container.querySelectorAll('audio'))};
}

describe('unified meeting playback', () => {
  it('preloads chunks, seeks globally, hands over automatically and stops at the end', async () => {
    const {audio} = await mount();
    expect(screen.getAllByRole('slider')).toHaveLength(1);
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
    expect(play.mock.instances.at(-1)).toBe(audio[0]);
    fireEvent.ended(audio[0]); fireEvent.ended(audio[1]);
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
    view.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
