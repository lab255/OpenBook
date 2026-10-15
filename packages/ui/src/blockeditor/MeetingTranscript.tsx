import {useEffect, useState} from 'react';
import {t} from '@/i18n';
import {assetBridge} from '@/lib/assetBridge';
import {chunkKey, meetingTime, type MeetingAudio, type MeetingSegment, type MeetingRecorder} from './meetingRecorder';

function ChunkAudio({audio, blob}: {audio: MeetingAudio; blob?: Blob}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let disposed = false;
    let objectUrl = '';
    const load = async (): Promise<void> => {
      const asset = blob ? null : await assetBridge.getAsset(audio.assetId);
      const data = blob ?? (asset ? new Blob([new Uint8Array(asset.bytes)], {type: asset.mime}) : null);
      if (disposed || !data) return;
      objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
    };
    void load().catch(() => {});
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [audio.assetId, blob]);
  return url ? <>
    <audio controls preload="metadata" src={url} aria-label={t('meetingBlock.playback', {time: meetingTime(audio.startedAtMs ?? 0)})} />
    {blob && <a href={url} download={`meeting-${audio.startedAtMs ?? 0}.${blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`}>{t('meetingBlock.saveAudio')}</a>}
  </> : null;
}

export function MeetingTranscript({saved, completed, transcript, session, readOnly, canTranscribe}: {
  saved: MeetingAudio[]; completed: string[]; transcript: MeetingSegment[];
  session: MeetingRecorder; readOnly: boolean; canTranscribe: boolean;
}) {
  return <>
    <ol className="obe-meeting-chunks">
      {saved.map((audio) => {
        const progress = session.chunks.find((chunk) => chunkKey(chunk.audio) === chunkKey(audio));
        const done = completed.includes(chunkKey(audio));
        return <li key={chunkKey(audio)}>
          <span>{meetingTime(audio.startedAtMs ?? 0)} · {meetingTime(audio.durationMs)}</span>
          <ChunkAudio audio={audio} />
          <span aria-live="polite">{t(`meetingBlock.${done ? 'transcribed' : progress?.phase === 'transcribing' ? 'transcribing' : 'untranscribed'}`)}</span>
          {progress?.error && <p role="alert">{progress.error}</p>}
          {!done && <button type="button" disabled={readOnly || !canTranscribe || progress?.busy} onClick={() => session.retry(audio)}>{t('meetingBlock.retryTranscription')}</button>}
        </li>;
      })}
      {session.chunks.filter((chunk) => chunk.blob).map((chunk) => <li key={chunk.id}>
        <span role="status">{t(`meetingBlock.${chunk.phase === 'uploadFailed' ? 'uploadFailed' : 'uploading'}`)}</span>
        <ChunkAudio audio={chunk.audio} blob={chunk.blob} />
        {chunk.phase === 'uploadFailed' && <button type="button" disabled={readOnly} onClick={() => void session.upload(chunk)}>{t('meetingBlock.retryUpload')}</button>}
      </li>)}
    </ol>
    <section className="obe-meeting-transcript" aria-label={t('meetingBlock.transcript')}>
      <h4>{t('meetingBlock.transcript')}</h4>
      {transcript.map((segment, index) => <p key={index}><time>{meetingTime(segment.startMs)}</time> {segment.text}</p>)}
    </section>
  </>;
}
