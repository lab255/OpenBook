import {t} from '@/i18n';
import {meetingTime, type MeetingAudio, type MeetingSegment, type MeetingRecorder} from './meetingRecorder';
import {MeetingPlayer} from './MeetingPlayer';

export function MeetingTranscript({saved, completed, transcript, session, readOnly, canTranscribe}: {
  saved: MeetingAudio[]; completed: string[]; transcript: MeetingSegment[];
  session: MeetingRecorder; readOnly: boolean; canTranscribe: boolean;
}) {
  return <>
    <MeetingPlayer saved={saved} completed={completed} session={session} readOnly={readOnly} canTranscribe={canTranscribe} />
    <section className="obe-meeting-transcript" aria-label={t('meetingBlock.transcript')}>
      {transcript.map((segment, index) => <p key={index}><time>{meetingTime(segment.startMs)}</time> {segment.text}</p>)}
    </section>
  </>;
}
