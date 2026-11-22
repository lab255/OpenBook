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

export function meetingAudioDuration(chunks: Pick<MeetingAudio, 'durationMs' | 'startedAtMs'>[]): number {
  return withMeetingAudioOffsets(chunks).reduce((end, chunk) => Math.max(end, chunk.startedAtMs + chunk.durationMs), 0);
}

/** Exact boundaries select the following chunk; gaps snap forward to its start. */
export function meetingAudioPosition(chunks: Pick<MeetingAudio, 'durationMs' | 'startedAtMs'>[], globalMs: number): {index: number; offsetMs: number} | null {
  const timeline = withMeetingAudioOffsets(chunks);
  if (!timeline.length) return null;
  const found = timeline.findIndex((chunk) => globalMs < chunk.startedAtMs + chunk.durationMs);
  const index = found < 0 ? timeline.length - 1 : found;
  const chunk = timeline[index];
  return {index, offsetMs: Math.max(0, Math.min(chunk.durationMs, globalMs - chunk.startedAtMs))};
}

export function meetingAudioGlobalTime(chunks: Pick<MeetingAudio, 'durationMs' | 'startedAtMs'>[], index: number, offsetMs: number): number {
  const chunk = withMeetingAudioOffsets(chunks)[index];
  return chunk ? chunk.startedAtMs + Math.max(0, Math.min(chunk.durationMs, offsetMs)) : 0;
}
