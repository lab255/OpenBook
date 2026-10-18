import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {PauseIcon, PlayIcon} from '@heroicons/react/24/outline';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {downloadBlob} from '@/lib/download';
import {t} from '@/i18n';
import {assetBridge} from '@/lib/assetBridge';
import {meetingAudioDuration, meetingAudioGlobalTime, meetingAudioPosition, withMeetingAudioOffsets} from './meetingAudio';
import {meetingTime} from './meetingTime';
import {chunkKey, type MeetingAudio, type MeetingRecorder} from './meetingRecorder';

function PlaybackChunk({src, register, onTime, onEnd, onError}: {
  src?: string; register: (element: HTMLAudioElement | null) => void;
  onTime: (element: HTMLAudioElement) => void; onEnd: () => void; onError: () => void;
}) {
  const media = useRef<HTMLAudioElement | null>(null);
  const latestRegister = useRef(register);
  latestRegister.current = register;
  useLayoutEffect(() => {
    if (!src) return;
    latestRegister.current(media.current);
    return () => { media.current?.pause(); latestRegister.current(null); };
  }, [src]);
  return <audio hidden preload="auto" ref={media} src={src}
    onTimeUpdate={(event) => onTime(event.currentTarget)} onEnded={onEnd} onError={onError} />;
}

interface AudioResource {assetId: string; blob?: Blob; url?: string; disposed: boolean}

export function MeetingPlayer({saved, completed, session, readOnly, canTranscribe}: {
  saved: MeetingAudio[]; completed: string[]; session: MeetingRecorder; readOnly: boolean; canTranscribe: boolean;
}) {
  const pending = session.chunks.filter((chunk) => chunk.blob);
  const savedKeys = new Set(saved.map(chunkKey));
  const sources = [
    ...withMeetingAudioOffsets(saved).map((audio, index) => ({audio, id: chunkKey(saved[index]), originalKey: chunkKey(saved[index]), blob: undefined as Blob | undefined})),
    ...pending.filter((chunk) => !savedKeys.has(chunkKey(chunk.audio))).map((chunk) => ({audio: chunk.audio, id: chunk.id, originalKey: chunkKey(chunk.audio), blob: chunk.blob})),
  ].sort((a, b) => (a.audio.startedAtMs ?? 0) - (b.audio.startedAtMs ?? 0));
  const chunks = withMeetingAudioOffsets(sources.map((entry) => entry.audio));
  const entries = sources.map((entry, index) => ({...entry, id: String(chunks[index].startedAtMs)}));
  const total = meetingAudioDuration(chunks);
  const elements = useRef(new Map<string, HTMLAudioElement>());
  const active = useRef<string | null>(null);
  const playingRef = useRef(false);
  const request = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [failed, setFailed] = useState(false);
  const resumeAt = useRef<number | null>(null);
  const pendingSeek = useRef<{globalMs: number; play: boolean} | null>(null);
  const [windowStart, setWindowStart] = useState<number | null>(null);
  const resources = useRef(new Map<string, AudioResource>());
  const [, refreshUrls] = useState(0);
  // Retain overlapping URLs, and dispose requests as soon as they leave the window.
  useEffect(() => {
    const windowEntries = windowStart === null ? [] : entries.slice(windowStart, windowStart + 2);
    for (const [id, resource] of resources.current) {
      const entry = windowEntries.find((entry) => entry.id === id);
      if (entry && resource.assetId === entry.audio.assetId && resource.blob === entry.blob) continue;
      resource.disposed = true;
      if (resource.url) URL.revokeObjectURL(resource.url);
      resources.current.delete(id);
    }
    for (const entry of windowEntries) {
      if (resources.current.has(entry.id)) continue;
      const resource: AudioResource = {assetId: entry.audio.assetId, blob: entry.blob, disposed: false};
      resources.current.set(entry.id, resource);
      void (async () => {
        const asset = entry.blob ? null : await assetBridge.getAsset(entry.audio.assetId);
        const data = entry.blob ?? (asset ? new Blob([new Uint8Array(asset.bytes)], {type: asset.mime}) : null);
        if (resource.disposed || !data) return;
        resource.url = URL.createObjectURL(data);
        refreshUrls((version) => version + 1);
      })().catch(() => {});
    }
  });
  useEffect(() => () => {
    for (const resource of resources.current.values()) {
      resource.disposed = true;
      if (resource.url) URL.revokeObjectURL(resource.url);
    }
    resources.current.clear();
  }, []);
  const [expandedFailures, setExpandedFailures] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const stop = () => {
    pendingSeek.current = null; resumeAt.current = null;
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
    setWindowStart(target.index);
    setPosition(meetingAudioGlobalTime(chunks, target.index, target.offsetMs));
    const element = elements.current.get(entry.id);
    if (!element) { pendingSeek.current = {globalMs, play}; return; }
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
  const statuses = entries.map((entry, index) => {
    const audio = chunks[index];
    const progress = session.chunks.find((chunk) => chunkKey(chunk.audio) === chunkKey(audio) || chunkKey(chunk.audio) === entry.originalKey);
    const done = completed.includes(chunkKey(audio)) || completed.includes(entry.originalKey);
    const uploadFailed = progress?.phase === 'uploadFailed';
    const status = t(`meetingBlock.${entry.blob ? uploadFailed ? 'uploadFailedStatus' : 'uploading' : done ? 'transcribed' : progress?.phase === 'transcribing' ? 'transcribing' : 'untranscribed'}`);
    return {...entry, audio, progress, done, uploadFailed, status, attention: !!progress?.error || uploadFailed};
  });
  const failures = statuses.filter((entry) => entry.attention);
  const actions = (entry: typeof statuses[number]) => <>
    {!readOnly && !entry.blob && !entry.done && <button type="button" disabled={!canTranscribe || entry.progress?.busy} onClick={() => session.retry(entry.audio)}>{t('meetingBlock.retryTranscription')}</button>}
    {!readOnly && entry.uploadFailed && entry.progress && <button type="button" onClick={() => void session.upload(entry.progress!)}>{t('meetingBlock.retryUpload')}</button>}
    {entry.uploadFailed && entry.blob && <a href="#" onClick={(event) => {
      event.preventDefault();
      const blob = entry.blob!;
      downloadBlob(`meeting-${entry.audio.startedAtMs}.${blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`, blob);
    }}>{t('meetingBlock.saveAudio')}</a>}
  </>;
  if (!entries.length) return null;
  return <section className="obe-meeting-player" aria-label={t('meetingBlock.player')}>
    <div className="obe-meeting-controls">
      <button type="button" className="obe-meeting-play" aria-label={t(`meetingBlock.${playing ? 'pausePlayback' : 'play'}`)}
        onClick={() => playing ? stop() : seek(position >= total ? 0 : position, true)}>
        {playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
      </button>
      <div className="obe-meeting-track">
        <input type="range" min={0} max={total} step={100} value={Math.min(position, total)} aria-label={t('meetingBlock.seek')}
          aria-valuetext={`${meetingTime(position)} / ${meetingTime(total)}`} onChange={(event) => seek(Number(event.target.value), playingRef.current)} />
        <div className="obe-meeting-markers">
          {statuses.map((entry) => <div className="obe-meeting-marker" key={entry.id} style={{flexGrow: entry.audio.durationMs || 1}}>
            <Popover open={detail === entry.id} onOpenChange={(open) => setDetail(open ? entry.id : null)}>
              <PopoverTrigger asChild>
                <button type="button" className="obe-meeting-marker-button" data-attention={entry.attention}
                  data-active={playing && active.current === entry.id} aria-label={`${meetingTime(entry.audio.startedAtMs)} · ${entry.status}`} />
              </PopoverTrigger>
              <PopoverContent className="w-max">
                <span>{meetingTime(entry.audio.startedAtMs)} · {entry.status}</span>
                {entry.progress?.error && <p className="text-sm text-muted-foreground">{entry.progress.error}</p>}
                <div className="obe-meeting-chunk-actions">{actions(entry)}</div>
              </PopoverContent>
            </Popover>
          </div>)}
        </div>
      </div>
      <span className="obe-meeting-elapsed">{meetingTime(position)} / {meetingTime(total)}</span>
    </div>
    {failed && <p role="alert">{t('meetingBlock.playbackFailed')}</p>}
    <div className="sr-only" role="status" aria-live="polite">
      {statuses.map((entry) => `${meetingTime(entry.audio.startedAtMs)} · ${entry.status}${entry.progress?.error ? ` — ${entry.progress.error}` : ''}`).join('; ')}
    </div>
    {failures.length > 2 && <button type="button" className="obe-meeting-failure-disclosure" aria-expanded={expandedFailures}
      onClick={() => setExpandedFailures(!expandedFailures)}>{t('meetingBlock.failedChunks', {count: failures.length})}</button>}
    {(failures.length <= 2 || expandedFailures) && failures.map((entry) => <div className="obe-meeting-attention" key={entry.id}>
      <span className="obe-meeting-attention-status">{meetingTime(entry.audio.startedAtMs)} · {entry.status}</span>
      {entry.progress?.error && <span> — {entry.progress.error}</span>}
      {actions(entry)}
    </div>)}
    {entries.map((entry, index) => <PlaybackChunk key={entry.id} src={windowStart !== null && index >= windowStart && index <= windowStart + 1
            && resources.current.get(entry.id)?.assetId === entry.audio.assetId && resources.current.get(entry.id)?.blob === entry.blob
      ? resources.current.get(entry.id)?.url : undefined} register={(element) => {
      if (element) {
        elements.current.set(entry.id, element);
        const pending = pendingSeek.current ?? (resumeAt.current === null ? null : {globalMs: resumeAt.current, play: true});
        if (pending && meetingAudioPosition(chunks, pending.globalMs)?.index === index) seek(pending.globalMs, pending.play);
      } else {
        if (active.current === entry.id && playingRef.current) { const at = position; stop(); resumeAt.current = at; }
        elements.current.delete(entry.id);
      }
    }}
    onTime={(element) => { if (active.current === entry.id) setPosition(meetingAudioGlobalTime(chunks, index, element.currentTime * 1000)); }}
    onError={() => { if (active.current === entry.id) { stop(); setFailed(true); } }}
    onEnd={() => {
      if (active.current !== entry.id || !playingRef.current) return;
      if (index + 1 < chunks.length) seek(chunks[index + 1].startedAtMs, true);
      else { stop(); setPosition(total); }
    }} />
    )}
  </section>;
}
