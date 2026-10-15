import {useEffect, useRef, useState} from 'react';
import {t} from '@/i18n';
import {assetBridge} from '@/lib/assetBridge';
import {meetingAudioDuration, meetingAudioGlobalTime, meetingAudioPosition, withMeetingAudioOffsets} from './meetingAudio';
import {meetingTime} from './meetingTime';
import {chunkKey, type MeetingAudio, type MeetingRecorder} from './meetingRecorder';

function PlaybackChunk({audio, blob, register, onTime, onEnd, onError}: {
  audio: MeetingAudio; blob?: Blob; register: (element: HTMLAudioElement | null) => void;
  onTime: (element: HTMLAudioElement) => void; onEnd: () => void; onError: () => void;
}) {
  const [url, setUrl] = useState('');
  const media = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    let disposed = false;
    let objectUrl = '';
    setUrl('');
    void (async () => {
      const asset = blob ? null : await assetBridge.getAsset(audio.assetId);
      const data = blob ?? (asset ? new Blob([new Uint8Array(asset.bytes)], {type: asset.mime}) : null);
      if (disposed || !data) return;
      objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
    })().catch(() => {});
    return () => { disposed = true; media.current?.pause(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [audio.assetId, blob]);
  return url ? <>
    <audio hidden preload="auto" ref={(element) => { if (element) media.current = element; register(element); }} src={url}
      aria-label={t('meetingBlock.playback', {time: meetingTime(audio.startedAtMs ?? 0)})}
      onTimeUpdate={(event) => onTime(event.currentTarget)} onEnded={onEnd} onError={onError} />
    {blob && <a href={url} download={`meeting-${audio.startedAtMs ?? 0}.${blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`}>{t('meetingBlock.saveAudio')}</a>}
  </> : null;
}

export function MeetingPlayer({saved, completed, session, readOnly, canTranscribe}: {
  saved: MeetingAudio[]; completed: string[]; session: MeetingRecorder; readOnly: boolean; canTranscribe: boolean;
}) {
  const pending = session.chunks.filter((chunk) => chunk.blob);
  const entries = [
    ...withMeetingAudioOffsets(saved).map((audio, index) => ({audio, id: chunkKey(saved[index]), originalKey: chunkKey(saved[index]), blob: undefined as Blob | undefined})),
    ...pending.map((chunk) => ({audio: chunk.audio, id: chunk.id, originalKey: chunkKey(chunk.audio), blob: chunk.blob})),
  ].sort((a, b) => (a.audio.startedAtMs ?? 0) - (b.audio.startedAtMs ?? 0));
  const chunks = withMeetingAudioOffsets(entries.map((entry) => entry.audio));
  const total = meetingAudioDuration(chunks);
  const elements = useRef(new Map<string, HTMLAudioElement>());
  const active = useRef<string | null>(null);
  const playingRef = useRef(false);
  const request = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const stop = () => {
    request.current++;
    playingRef.current = false; setPlaying(false);
    elements.current.forEach((element) => element.pause());
  };
  const seek = (globalMs: number, play: boolean) => {
    const target = meetingAudioPosition(chunks, globalMs);
    stop(); setFailed(false);
    if (!target) return;
    const entry = entries[target.index];
    active.current = entry.id;
    setPosition(meetingAudioGlobalTime(chunks, target.index, target.offsetMs));
    const element = elements.current.get(entry.id);
    if (!element) { setFailed(true); return; }
    element.currentTime = target.offsetMs / 1000;
    if (play) {
      playingRef.current = true; setPlaying(true);
      const version = request.current;
      void element.play().catch(() => {
        if (request.current === version && active.current === entry.id && playingRef.current) { stop(); setFailed(true); }
      });
    }
  };
  useEffect(() => () => { elements.current.forEach((element) => element.pause()); }, []);
  if (!entries.length) return null;
  return <section className="obe-meeting-player" aria-label={t('meetingBlock.player')}>
    <div className="obe-meeting-controls">
      <button type="button" onClick={() => playing ? stop() : seek(position >= total ? 0 : position, true)}>{t(`meetingBlock.${playing ? 'pausePlayback' : 'play'}`)}</button>
      <input type="range" min={0} max={total} step={100} value={Math.min(position, total)} aria-label={t('meetingBlock.seek')}
        aria-valuetext={`${meetingTime(position)} / ${meetingTime(total)}`} onChange={(event) => seek(Number(event.target.value), playingRef.current)} />
      <span className="obe-meeting-elapsed">{meetingTime(position)} / {meetingTime(total)}</span>
    </div>
    {failed && <p role="alert">{t('meetingBlock.playbackFailed')}</p>}
    <div className="obe-meeting-markers">
      {entries.map((entry, index) => {
        const audio = chunks[index];
        const progress = session.chunks.find((chunk) => chunkKey(chunk.audio) === chunkKey(audio) || chunkKey(chunk.audio) === entry.originalKey);
        const done = completed.includes(chunkKey(audio)) || completed.includes(entry.originalKey);
        const status = t(`meetingBlock.${entry.blob ? progress?.phase === 'uploadFailed' ? 'uploadFailed' : 'uploading' : done ? 'transcribed' : progress?.phase === 'transcribing' ? 'transcribing' : 'untranscribed'}`);
        const open = detail === entry.id || !!entry.blob || !!progress?.error;
        return <div className="obe-meeting-marker" key={entry.id} style={{flexGrow: audio.durationMs || 1}}>
          <button type="button" className="obe-meeting-marker-button" data-attention={!!entry.blob || !!progress?.error} aria-label={`${meetingTime(audio.startedAtMs)} · ${status}`} aria-expanded={open}
            onClick={() => setDetail(detail === entry.id ? null : entry.id)}>●</button>
          {open && <div className="obe-meeting-chunk-detail">
            <span role="status">{status}</span>
            {progress?.error && <p role="alert">{progress.error}</p>}
            {!readOnly && !entry.blob && !done && <button type="button" disabled={!canTranscribe || progress?.busy} onClick={() => { setDetail(entry.id); session.retry(audio); }}>{t('meetingBlock.retryTranscription')}</button>}
            {!readOnly && entry.blob && progress?.phase === 'uploadFailed' && <button type="button" onClick={() => void session.upload(progress)}>{t('meetingBlock.retryUpload')}</button>}
          </div>}
          <PlaybackChunk audio={audio} blob={entry.blob} register={(element) => { if (element) elements.current.set(entry.id, element); else elements.current.delete(entry.id); }}
            onTime={(element) => { if (active.current === entry.id) setPosition(meetingAudioGlobalTime(chunks, index, element.currentTime * 1000)); }}
            onError={() => { if (active.current === entry.id) { stop(); setFailed(true); } }}
            onEnd={() => {
              if (active.current !== entry.id || !playingRef.current) return;
              if (index + 1 < chunks.length) seek(chunks[index + 1].startedAtMs, true);
              else { stop(); setPosition(total); }
            }} />
        </div>;
      })}
    </div>
  </section>;
}
