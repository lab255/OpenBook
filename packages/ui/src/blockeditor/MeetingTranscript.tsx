import {memo, useCallback, useLayoutEffect, useRef, useState} from 'react';
import {t} from '@/i18n';
import {meetingTime, type MeetingAudio, type MeetingSegment, type MeetingRecorder} from './meetingRecorder';
import {MeetingPlayer} from './MeetingPlayer';
import {activeMeetingSegment, transcriptFollowing, transcriptScrollDelta} from './meetingTranscriptPlayback';

const TranscriptRow = memo(function TranscriptRow({segment, isActive, onSeek}: {
  segment: MeetingSegment; isActive: boolean; onSeek?: (globalMs: number) => void;
}) {
  const time = meetingTime(segment.startMs);
  return <p className="obe-meeting-transcript-row" data-active={isActive}>
    {onSeek ? <button type="button" className="obe-meeting-timestamp" aria-label={t('meetingBlock.seekSegment', {time})}
      aria-current={isActive ? 'time' : undefined} onClick={() => onSeek(segment.startMs)}>
      <time data-t={time}>{time}</time>
    </button> : <time className="obe-meeting-timestamp" data-t={time}>{time}</time>}{' '}
    <span>{segment.text}</span>
  </p>;
});

function TranscriptRows({transcript, position, playing, canSeek, seek}: {
  transcript: MeetingSegment[]; position: number; playing: boolean; canSeek: boolean; seek: (globalMs: number) => void;
}) {
  const pane = useRef<HTMLElement>(null);
  const following = useRef(true);
  const expectedScroll = useRef(0);
  const latestSeek = useRef(seek);
  latestSeek.current = seek;
  const resnap = useRef(false);
  const previousActive = useRef(-1);
  const [seekVersion, setSeekVersion] = useState(0);
  const onSeek = useCallback((globalMs: number) => {
    following.current = transcriptFollowing(following.current, 'seek');
    resnap.current = true;
    setSeekVersion((version) => version + 1);
    latestSeek.current(globalMs);
  }, []);
  const active = activeMeetingSegment(transcript, position, playing);
  useLayoutEffect(() => {
    const changed = previousActive.current !== active;
    previousActive.current = active;
    if (!changed && !resnap.current) return;
    const container = pane.current;
    const row = container?.children[active] as HTMLElement | undefined;
    if (!container || !row || !following.current) return;
    resnap.current = false;
    const bounds = container.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    const top = rect.top - bounds.top - container.clientTop;
    const delta = transcriptScrollDelta(top, top + rect.height, container.clientHeight);
    if (delta) container.scrollTop += delta;
    expectedScroll.current = container.scrollTop;
  }, [active, position, seekVersion]);
  const suppress = () => { following.current = transcriptFollowing(following.current, 'user-scroll'); };
  return <section ref={pane} className="obe-meeting-transcript" aria-label={t('meetingBlock.transcript')}
    onPointerDown={(e) => { if (e.target === e.currentTarget) suppress(); }}
    tabIndex={0} onWheel={suppress} onTouchMove={suppress}
    onKeyDown={(event) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) suppress(); }}
    onScroll={() => { if (pane.current?.scrollTop !== expectedScroll.current) suppress(); }}>
    {transcript.map((segment, index) => <TranscriptRow key={index} segment={segment} isActive={active === index}
      onSeek={canSeek ? onSeek : undefined} />)}
  </section>;
}

export function MeetingTranscript({saved, completed, transcript, session, readOnly, canTranscribe}: {
  saved: MeetingAudio[]; completed: string[]; transcript: MeetingSegment[];
  session: MeetingRecorder; readOnly: boolean; canTranscribe: boolean;
}) {
  return <MeetingPlayer saved={saved} completed={completed} session={session} readOnly={readOnly} canTranscribe={canTranscribe}>
    {(playback) => <TranscriptRows transcript={transcript} {...playback} />}
  </MeetingPlayer>;
}
