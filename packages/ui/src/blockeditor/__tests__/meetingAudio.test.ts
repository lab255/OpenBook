import {describe, expect, it} from 'vitest';
import {meetingAudioDuration, meetingAudioGlobalTime, meetingAudioPosition, withMeetingAudioOffsets} from '../meetingAudio';

describe('meeting audio timeline', () => {
  const chunks = [{durationMs: 45000}, {durationMs: 45000}, {durationMs: 12000}];
  it('derives legacy offsets and the full duration', () => {
    expect(withMeetingAudioOffsets(chunks).map((c) => c.startedAtMs)).toEqual([0, 45000, 90000]);
    expect(meetingAudioDuration(chunks)).toBe(102000);
  });
  it('round trips local and global positions', () => {
    expect(meetingAudioGlobalTime(chunks, 1, 1234)).toBe(46234);
    expect(meetingAudioPosition(chunks, 46234)).toEqual({index: 1, offsetMs: 1234});
  });
  it('hands off at exact boundaries and clamps outside the timeline', () => {
    expect(meetingAudioPosition(chunks, 44999)).toEqual({index: 0, offsetMs: 44999});
    expect(meetingAudioPosition(chunks, 45000)).toEqual({index: 1, offsetMs: 0});
    expect(meetingAudioPosition(chunks, -100)).toEqual({index: 0, offsetMs: 0});
    expect(meetingAudioPosition(chunks, 200000)).toEqual({index: 2, offsetMs: 12000});
    expect(meetingAudioPosition([], 0)).toBeNull();
  });
  it('preserves explicit offsets and snaps gaps forward', () => {
    const explicit = [{startedAtMs: 0, durationMs: 1000}, {startedAtMs: 2000, durationMs: 1000}, {durationMs: 500}];
    expect(withMeetingAudioOffsets(explicit)[2].startedAtMs).toBe(3000);
    expect(meetingAudioPosition(explicit, 1500)).toEqual({index: 1, offsetMs: 0});
  });
});
