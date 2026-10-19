import type * as Y from 'yjs';
import {setBlockProp, type BlockMap} from './model';
import {meetingTime} from './meetingTime';
import type {MeetingRecorder, RecordingChunk} from './meetingSessions';

export function meetingTranscriptLines(transcript: {startMs: number; text: string}[]): string[] {
  return transcript.map((segment) => `[${meetingTime(segment.startMs)}] ${segment.text}`);
}

export function failedTranscriptionChunks(session: Pick<MeetingRecorder, 'chunks'>): RecordingChunk[] {
  return session.chunks.filter((chunk) => chunk.phase === 'untranscribed' && !!chunk.error && !chunk.busy && !!chunk.audio.assetId);
}

export function retryFailedTranscriptions(session: Pick<MeetingRecorder, 'chunks' | 'retry'>): void {
  failedTranscriptionChunks(session).forEach((chunk) => session.retry(chunk.audio));
}

export function deleteMeetingTranscript(doc: Y.Doc, block: BlockMap): void {
  doc.transact(() => {
    setBlockProp(block, 'transcript', []);
    setBlockProp(block, 'transcriptionCompleted', []);
  }, 'local');
}
