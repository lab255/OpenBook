import {useEffect, useState, useSyncExternalStore} from 'react';
import {t} from '@/i18n';
import {assetBridge} from '@/lib/assetBridge';
import {getPageIdForDoc} from '@/lib/aiBridge';
import {blockChildren, blockProp, insertBlock} from './model';
import type {CustomBlockDef, CustomBlockProps} from './registry';
import {useKitLock} from './kit/lock';
import {chunkKey, meetingRecorder, meetingTime, type MeetingAudio, type MeetingSegment} from './meetingRecorder';

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
    <audio controls preload="metadata" src={url} aria-label={t('meetingBlock.playback')} />
    {blob && <a href={url} download={`meeting-${audio.startedAtMs ?? 0}.${blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`}>{t('meetingBlock.saveAudio')}</a>}
  </> : null;
}

export function MeetingBlockView({block, editor, pageReadOnly, children}: CustomBlockProps) {
  const locked = useKitLock();
  const readOnly = editor.readOnly || pageReadOnly || locked;
  const session = meetingRecorder(editor, block, getPageIdForDoc(editor.doc) ?? '');
  useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(timer); session.stop(); };
  }, [session]);
  useEffect(() => { if (readOnly) session.stop(); }, [readOnly, session]);
  const saved = blockProp<MeetingAudio[]>(block, 'audioChunks') ?? [];
  const completed = blockProp<string[]>(block, 'transcriptionCompleted') ?? [];
  const transcript = blockProp<MeetingSegment[]>(block, 'transcript') ?? [];
  const startedAt = blockProp<number>(block, 'startedAt');
  const elapsed = session.active && startedAt != null ? Date.now() - startedAt
    : Math.max(0, ...saved.map((audio) => (audio.startedAtMs ?? 0) + audio.durationMs));
  const status = session.active ? session.mode : blockProp<string>(block, 'status') ?? 'idle';
  const statusLabel = t(`meetingBlock.${status as 'idle' | 'recording' | 'processing' | 'done' | 'paused' | 'requesting'}`);
  const canTranscribe = assetBridge.canTranscribe();
  return <section className="obe-meeting" aria-label={t('meetingBlock.label')}>
    <header><strong>{blockProp<string>(block, 'title') || t('meetingBlock.label')}</strong>
      <span role="status" aria-live="polite">{statusLabel} · {meetingTime(elapsed)}</span></header>
    <div className="obe-meeting-controls">
      {!session.active && <button type="button" disabled={readOnly || session.mode === 'processing'} onClick={() => void session.start()}>{t('meetingBlock.record')}</button>}
      {session.mode === 'recording' && <button type="button" disabled={readOnly} onClick={() => session.pause()}>{t('meetingBlock.pause')}</button>}
      {session.mode === 'paused' && <button type="button" disabled={readOnly} onClick={() => session.resume()}>{t('meetingBlock.resume')}</button>}
      {session.active && <button type="button" disabled={readOnly} onClick={() => session.stop()}>{t('meetingBlock.stop')}</button>}
    </div>
    {session.error && <p role="alert">{session.error}</p>}
    {!canTranscribe && <p>{t('meetingBlock.noAI')}</p>}
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
      {session.chunks.filter((chunk) => chunk.blob).map((chunk, index) => <li key={`pending-${index}`}>
        <span role="status">{t(`meetingBlock.${chunk.phase === 'uploadFailed' ? 'uploadFailed' : 'uploading'}`)}</span>
        <ChunkAudio audio={chunk.audio} blob={chunk.blob} />
        {chunk.phase === 'uploadFailed' && <button type="button" disabled={readOnly} onClick={() => void session.upload(chunk)}>{t('meetingBlock.retryUpload')}</button>}
      </li>)}
    </ol>
    <section className="obe-meeting-transcript" aria-label={t('meetingBlock.transcript')}>
      <h4>{t('meetingBlock.transcript')}</h4>
      {transcript.map((segment, index) => <p key={index}><time>{meetingTime(segment.startMs)}</time> {segment.text}</p>)}
    </section>
    {blockProp<string>(block, 'summary') && <p className="obe-meeting-summary">{blockProp<string>(block, 'summary')}</p>}
    <section className="obe-meeting-notes" aria-label={t('meetingBlock.notes')}><h4>{t('meetingBlock.notes')}</h4>{children}
      {!readOnly && !blockChildren(block)?.length && <button type="button" onClick={() => editor.doc.transact(() => {
        const notes = blockChildren(block);
        if (notes) insertBlock(editor.doc, notes, 0, {type: 'paragraph'});
      }, 'local')}>{t('meetingBlock.addNote')}</button>}</section>
  </section>;
}

export const MEETING_BLOCK: CustomBlockDef = {
  type: 'meeting', render: MeetingBlockView,
  slash: {label: 'Meeting', hint: 'Record audio, transcribe and take notes', keywords: 'meeting record recorder audio microphone transcript notes', group: 'interactive',
    make: () => ({type: 'meeting', children: [{type: 'paragraph'}]})},
};
