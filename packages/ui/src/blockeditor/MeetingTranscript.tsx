import {useLayoutEffect, useRef} from 'react';
import {t} from '@/i18n';
import {meetingTime, type MeetingAudio, type MeetingSegment, type MeetingRecorder} from './meetingRecorder';
import {MeetingPlayer} from './MeetingPlayer';
import {activeMeetingSegment, transcriptFollowing, transcriptScrollDelta} from './meetingTranscriptPlayback';

function TranscriptRows({transcript, position, playing, seek}: {
  transcript: MeetingSegment[]; position: number; playing: boolean; seek: (globalMs: number) => void;
}) {
  const pane = useRef<HTMLElement>(null);
  const following = useRef(true);
  const expectedScroll = useRef(0);
  const active = activeMeetingSegment(transcript, position, playing);
  useLayoutEffect(() => {
    const container = pane.current;
    const row = container?.children[active] as HTMLElement | undefined;
    if (!container || !row || !following.current) return;
    const bounds = container.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    const top = rect.top - bounds.top - container.clientTop;
    const delta = transcriptScrollDelta(top, top + rect.height, container.clientHeight);
    if (delta) container.scrollTop += delta;
    expectedScroll.current = container.scrollTop;
  }, [active, position]);
  const suppress = () => { following.current = transcriptFollowing(following.current, 'user-scroll'); };
  return <section ref={pane} className="obe-meeting-transcript" aria-label={t('meetingBlock.transcript')}
    tabIndex={0} onWheel={suppress} onTouchMove={suppress}
    onKeyDown={(event) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) suppress(); }}
    onScroll={() => { if (pane.current?.scrollTop !== expectedScroll.current) suppress(); }}>
    {transcript.map((segment, index) => <p key={index} className="obe-meeting-transcript-row" data-active={active === index}>
      <button type="button" className="obe-meeting-timestamp" aria-label={t('meetingBlock.seekSegment', {time: meetingTime(segment.startMs)})}
        aria-current={active === index ? 'time' : undefined} onClick={() => {
          following.current = transcriptFollowing(following.current, 'seek');
          seek(segment.startMs);
        }}><time>{meetingTime(segment.startMs)}</time></button>{' '}
      <span>{segment.text}</span>
    </p>)}
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
