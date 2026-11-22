import type {MeetingSegment} from './meetingRecorder';

/** Half-open intervals; the first matching segment wins malformed overlaps. */
export function activeMeetingSegment(segments: MeetingSegment[], position: number, playing: boolean): number {
  return playing ? segments.findIndex(({startMs, endMs}) => startMs <= position && position < endMs) : -1;
}

/** Following resumes only on an explicit timestamp seek. */
export function transcriptFollowing(following: boolean, action: 'user-scroll' | 'seek' | 'playback'): boolean {
  return action === 'seek' || (action === 'playback' && following);
}

export function transcriptScrollDelta(top: number, bottom: number, height: number): number {
  if (top < 0) return top;
  if (bottom > height) return Math.min(top, bottom - height);
  return 0;
}
