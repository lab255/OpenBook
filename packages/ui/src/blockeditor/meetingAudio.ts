import type {MeetingAudio} from './meetingRecorder';

export const AUDIO_DATA_URI_RE = /^data:(?:audio\/(?:webm|ogg|mp4|mpeg|wav)|video\/webm)(?:;codecs=[\w.-]+)?;base64,[A-Za-z0-9+/]*={0,2}$/;

/** Fill legacy chunk offsets from preceding durations, preserving recording order. */
export function withMeetingAudioOffsets<T extends Pick<MeetingAudio, 'durationMs' | 'startedAtMs'>>(chunks: T[]): (T & {startedAtMs: number})[] {
  let offset = 0;
  return chunks.map((chunk) => {
    const start = chunk.startedAtMs ?? offset;
    offset = start + chunk.durationMs;
    return {...chunk, startedAtMs: start};
  });
}
