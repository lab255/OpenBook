import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {MeetingTranscript} from '../MeetingTranscript';
import type {MeetingRecorder} from '../meetingRecorder';
import {activeMeetingSegment, transcriptFollowing, transcriptScrollDelta} from '../meetingTranscriptPlayback';
import {setAssetBridge} from '@/lib/assetBridge';

const transcript = [
  {startMs: 1000, endMs: 3000, text: 'First segment'},
  {startMs: 3000, endMs: 45000, text: 'Second segment'},
  {startMs: 46000, endMs: 48000, text: 'Later chunk'},
];
const session = {chunks: [], retry: vi.fn()} as unknown as MeetingRecorder;
beforeEach(() => {
  setAssetBridge({getAsset: async () => ({bytes: new Uint8Array([1]), mime: 'audio/webm'}), putAsset: vi.fn()});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:meeting');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { cleanup(); setAssetBridge(null); vi.restoreAllMocks(); });

describe('transcript playback', () => {
  it('resolves half-open boundaries, gaps, overlaps and stopped playback', () => {
    for (const [time, expected] of [[0, -1], [1000, 0], [2999, 0], [3000, 1], [45000, -1], [46000, 2], [48000, -1]]) {
      expect(activeMeetingSegment(transcript, time, true)).toBe(expected);
    }
    expect(activeMeetingSegment(transcript, 2000, false)).toBe(-1);
    expect(activeMeetingSegment([transcript[0], transcript[0]], 2000, true)).toBe(0);
    expect(activeMeetingSegment([], 2000, true)).toBe(-1);
  });
  it('defers to manual scrolling until the next seek and only moves offscreen rows', () => {
    expect(transcriptFollowing(true, 'user-scroll')).toBe(false);
    expect(transcriptFollowing(false, 'playback')).toBe(false);
    expect(transcriptFollowing(false, 'seek')).toBe(true);
    expect(transcriptFollowing(true, 'playback')).toBe(true);
    expect(transcriptScrollDelta(20, 60, 100)).toBe(0);
    expect(transcriptScrollDelta(-20, 20, 100)).toBe(-20);
    expect(transcriptScrollDelta(80, 120, 100)).toBe(20);
    expect(transcriptScrollDelta(0, 200, 100)).toBe(0);
  });
  it.each([false, true])('seeks before loading and follows global playback in readOnly=%s', async (readOnly) => {
    const view = render(<MeetingTranscript saved={[{assetId: 'one', durationMs: 45000}, {assetId: 'two', durationMs: 5000}]}
      completed={[]} session={session} readOnly={readOnly} canTranscribe transcript={transcript} />);
    expect(view.container.querySelectorAll('audio[src]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', {name: 'Seek to 0:46'}));
    await waitFor(() => expect(view.container.querySelectorAll('audio')[1].currentTime).toBe(1));
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('0:46 / 0:50');
    expect(view.container.querySelectorAll('[data-active="true"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', {name: 'Play'}));
    expect(screen.getByRole('button', {name: 'Seek to 0:46'}).getAttribute('aria-current')).toBe('time');
    const audio = view.container.querySelectorAll('audio');
    audio[1].currentTime = 3; fireEvent.timeUpdate(audio[1]);
    expect(view.container.querySelectorAll('.obe-meeting-transcript-row[data-active="true"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', {name: 'Seek to 0:03'}));
    await waitFor(() => expect(audio[0].currentTime).toBe(3));
    expect(screen.getByRole('button', {name: 'Seek to 0:03'}).getAttribute('aria-current')).toBe('time');
    fireEvent.ended(audio[0]);
    audio[1].currentTime = 1; fireEvent.timeUpdate(audio[1]);
    expect(screen.getByRole('button', {name: 'Seek to 0:46'}).getAttribute('aria-current')).toBe('time');
    fireEvent.click(screen.getByRole('button', {name: 'Pause playback'}));
    expect(view.container.querySelectorAll('.obe-meeting-transcript-row[data-active="true"]')).toHaveLength(0);
    expect(view.container.querySelector('[aria-live="polite"]')).toBeTruthy();
  });
  it('scrolls only its pane, suppresses following on user input, and resumes on seek', async () => {
    const view = render(<MeetingTranscript saved={[{assetId: 'one', durationMs: 50000}]} completed={[]}
      session={session} readOnly canTranscribe transcript={transcript} />);
    const pane = screen.getByRole('region', {name: 'Transcript'});
    Object.defineProperty(pane, 'clientHeight', {value: 100});
    vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue({top: 0} as DOMRect);
    const rows = view.container.querySelectorAll('.obe-meeting-transcript-row');
    for (const row of rows) vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({top: 150, height: 40} as DOMRect);
    fireEvent.click(screen.getByRole('button', {name: 'Seek to 0:01'}));
    await waitFor(() => expect(view.container.querySelector('audio')!.currentTime).toBe(1));
    fireEvent.click(screen.getByRole('button', {name: 'Play'}));
    expect(pane.scrollTop).toBe(90);
    fireEvent.scroll(pane); // The programmatic scroll must not suspend following.
    const audio = view.container.querySelector('audio')!;
    audio.currentTime = 3; fireEvent.timeUpdate(audio);
    expect(pane.scrollTop).toBe(180);
    fireEvent.wheel(pane);
    audio.currentTime = 46; fireEvent.timeUpdate(audio);
    expect(pane.scrollTop).toBe(180);
    fireEvent.click(screen.getByRole('button', {name: 'Seek to 0:01'}));
    expect(pane.scrollTop).toBe(270);
    pane.scrollTop = 30; fireEvent.scroll(pane); // Scrollbar drag.
    audio.currentTime = 3; fireEvent.timeUpdate(audio);
    expect(pane.scrollTop).toBe(30);
  });
  it('keeps transcripts visible without audio and does not seek when selecting prose', () => {
    render(<MeetingTranscript saved={[]} completed={[]} session={session} readOnly canTranscribe={false} transcript={transcript} />);
    fireEvent.click(screen.getByText('First segment'));
    expect(screen.getByText('First segment')).toBeTruthy();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
});
