import type {ReactNode} from 'react';
import {t} from '@/i18n';
import {meetingTime, type MeetingRecorder} from './meetingRecorder';

/** management is reserved for meeting actions supplied by the shell. */
export function MeetingHeader({session, status, elapsed, readOnly, pageReadOnly, locked, management}: {
  session: MeetingRecorder; status: string; elapsed: number; readOnly: boolean;
  pageReadOnly: boolean; locked: boolean; management?: ReactNode;
}) {
  const statusLabel = t(`meetingBlock.${status as 'idle' | 'recording' | 'processing' | 'done' | 'paused' | 'requesting'}`);
  return (
    <header className="obe-meeting-header">
      <span role="status" aria-live="polite">{statusLabel}</span>
      <span className="obe-meeting-elapsed" aria-hidden="true">{meetingTime(elapsed)}</span>
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
      <div className="obe-meeting-management">{management}</div>
    </header>
  );
}
