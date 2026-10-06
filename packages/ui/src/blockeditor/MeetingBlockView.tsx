import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {t} from '@/i18n';
import {assetBridge, subscribeAssetBridge} from '@/lib/assetBridge';
import {getPageIdForDoc} from '@/lib/aiBridge';
import {blockChildren, blockProp, insertBlock} from './model';
import type {CustomBlockDef, CustomBlockProps} from './registry';
import {exportMeetingAudio} from './meetingAudioExport';
import {MeetingSummary} from './MeetingSummary';
import {useKitLock} from './kit/lock';
import {KitFrame, NameDescriptionFields} from './kit/KitFrame';
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
    <audio controls preload="metadata" src={url} aria-label={t('meetingBlock.playback', {time: meetingTime(audio.startedAtMs ?? 0)})} />
    {blob && <a href={url} download={`meeting-${audio.startedAtMs ?? 0}.${blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`}>{t('meetingBlock.saveAudio')}</a>}
  </> : null;
}

export function MeetingBlockView({block, editor, pageReadOnly, children}: CustomBlockProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const locked = useKitLock();
  const readOnly = editor.readOnly || pageReadOnly || locked;
  const session = meetingRecorder(editor, block, getPageIdForDoc(editor.doc) ?? '');
  session.readOnly = readOnly;
  const chromeEditor = useMemo(() => ({...editor, readOnly}), [editor, readOnly]);
  useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [, tick] = useState(0);
  const active = session.active;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => () => session.stop(), [session]);
  useEffect(() => { if (readOnly) session.stop(); }, [readOnly, session]);
  const saved = blockProp<MeetingAudio[]>(block, 'audioChunks') ?? [];
  const completed = blockProp<string[]>(block, 'transcriptionCompleted') ?? [];
  const transcript = blockProp<MeetingSegment[]>(block, 'transcript') ?? [];
  const elapsed = session.elapsedMs;
  const status = session.active ? session.mode : blockProp<string>(block, 'status') ?? 'idle';
  const statusLabel = t(`meetingBlock.${status as 'idle' | 'recording' | 'processing' | 'done' | 'paused' | 'requesting'}`);
  const canTranscribe = useSyncExternalStore(subscribeAssetBridge, assetBridge.canTranscribe, assetBridge.canTranscribe);
  const control = <section className="obe-meeting" aria-label={t('meetingBlock.label')}>
    <header>
      <span role="status" aria-live="polite">{statusLabel}</span>
      <span className="obe-meeting-elapsed" aria-hidden="true">{meetingTime(elapsed)}</span>
    </header>
    {readOnly && <p className="obe-meeting-lock">{t(!pageReadOnly && locked ? 'meetingBlock.locked' : 'meetingBlock.readOnly')}</p>}
    {session.recordingElsewhere && <p>{t('meetingBlock.elsewhere')}</p>}
    <div className="obe-meeting-controls">
      <button type="button" disabled={readOnly || session.mode === 'processing' || session.recordingElsewhere}
        aria-busy={session.mode === 'requesting'}
        onClick={() => {
          if (session.mode === 'recording') session.pause();
          else if (session.mode === 'paused') session.resume();
          else void session.start();
        }}>
        {t(`meetingBlock.${session.mode === 'recording' ? 'pause' : session.mode === 'paused' ? 'resume' : session.mode === 'requesting' ? 'requesting' : 'record'}`)}
      </button>
      <button type="button" disabled={readOnly || !session.active} onClick={() => session.stop()}>{t('meetingBlock.stop')}</button>
    </div>
    {saved.length > 0 && <button type="button" disabled={exporting} aria-busy={exporting} onClick={async () => {
      setExporting(true); setExportError(false);
      try { await exportMeetingAudio(saved, blockProp<string>(block, 'title') || t('meetingBlock.label')); }
      catch { setExportError(true); }
      finally { setExporting(false); }
    }}>{t('meetingBlock.exportAudio')}</button>}
    {exportError && <p role="alert">{t('meetingBlock.exportAudioFailed')}</p>}
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
    <MeetingSummary block={block} editor={editor} readOnly={readOnly} status={status} transcript={transcript} />
    <section className="obe-meeting-notes" aria-label={t('meetingBlock.notes')}><h4>{t('meetingBlock.notes')}</h4>{children}
      {!readOnly && !blockChildren(block)?.length && <button type="button" onClick={() => editor.doc.transact(() => {
        const notes = blockChildren(block);
        if (notes) insertBlock(editor.doc, notes, 0, {type: 'paragraph'});
      }, 'local')}>{t('meetingBlock.addNote')}</button>}</section>
  </section>;
  return <KitFrame block={block} editor={chromeEditor} kind="meeting" defaultName={t('meetingBlock.label')}
    labelKey="title" symbol={false} control={control}
    config={<NameDescriptionFields block={block} editor={chromeEditor} nameKey="title" namePlaceholder={t('meetingBlock.label')} />} />;
}

export const MEETING_BLOCK: CustomBlockDef = {
  type: 'meeting', render: MeetingBlockView,
  slash: {label: 'Meeting', hint: 'Record audio, transcribe and take notes', keywords: 'meeting record recorder audio microphone transcript notes', group: 'interactive',
    make: () => ({type: 'meeting', children: [{type: 'paragraph'}]})},
};
