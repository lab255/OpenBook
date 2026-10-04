import {zipSync} from 'fflate';
import {assetBridge} from '@/lib/assetBridge';
import {downloadBlob, safeFilename} from '@/lib/download';
import {withMeetingAudioOffsets} from './meetingAudio';
import {meetingTime} from './meetingTime';
import type {MeetingAudio} from './meetingRecorder';

const extension = (mime: string): string => {
  const type = mime.split(';')[0].trim().toLowerCase();
  return ({'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav'} as Record<string, string>)[type] ?? 'bin';
};

/** Preserve standalone chunks byte-for-byte; stitching would require remuxing or re-encoding. */
export async function exportMeetingAudio(chunks: MeetingAudio[], title: string): Promise<void> {
  if (!chunks.length) return;
  const ordered = withMeetingAudioOffsets(chunks).sort((a, b) => a.startedAtMs - b.startedAtMs);
  const files: Record<string, Uint8Array> = {};
  for (const [index, chunk] of ordered.entries()) {
    const asset = await assetBridge.getAsset(chunk.assetId);
    if (!asset) throw new Error('Audio unavailable');
    const timestamp = meetingTime(chunk.startedAtMs, true);
    if (ordered.length === 1) {
      downloadBlob(`${safeFilename(title, 'Meeting')}-${timestamp}.${extension(asset.mime)}`,
        new Blob([new Uint8Array(asset.bytes)], {type: asset.mime}));
      return;
    }
    files[`${String(index + 1).padStart(3, '0')}-${timestamp}.${extension(asset.mime)}`] = asset.bytes;
  }
  downloadBlob(`${safeFilename(title, 'Meeting')}-audio.zip`, new Blob([zipSync(files, {level: 0}) as BlobPart], {type: 'application/zip'}));
}
