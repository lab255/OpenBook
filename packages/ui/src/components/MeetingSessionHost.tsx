import {useEffect, useState, useSyncExternalStore} from 'react';
import {useData} from '@/data';
import {useNavigation} from '@/providers';
import {STATUS_DOT_CLASS} from '@/lib/statusStyles';
import {cn} from '@/lib/utils';
import {useCanWrite} from '@/lib/useCanWrite';
import {t} from '@/i18n';
import {activeSessions, getVersion, meetingTime, setMeetingSessionClient, subscribe} from '@/blockeditor/meetingSessions';
import {Button} from './ui/button';

/** App lifetime persistence bridge; navigation only detaches the block view. */
export function MeetingSessionHost() {
  const client = useData();
  const canWrite = useCanWrite();
  useEffect(() => {
    setMeetingSessionClient(client);
    return () => setMeetingSessionClient(null);
  }, [client]);
  useEffect(() => {
    if (!canWrite) activeSessions().forEach((session) => session.setReadOnly(true));
  }, [canWrite]);
  return <RecordingBubble canWrite={canWrite} />;
}

export function RecordingBubble({canWrite}: {canWrite: boolean}) {
  const {selectPageAtBlock} = useNavigation();
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const sessions = activeSessions().filter((session) => !session.visible && !session.readOnly && ['recording', 'paused'].includes(session.mode));
  const [, tick] = useState(0);
  const running = canWrite && sessions.some((session) => session.mode === 'recording');
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => tick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return <aside aria-label={t('meetingBlock.recordingSessions')} className="fixed bottom-4 right-4 z-toast flex max-w-full flex-col gap-2 print:hidden">
    <span className="sr-only" role="status" aria-live="polite">{canWrite && sessions.map((session) => t(`meetingBlock.${session.mode === 'paused' ? 'paused' : 'recording'}`)).join(', ')}</span>
    {canWrite && sessions.map((session) => <div key={`${session.pageId}:${session.blockId}`} className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-overlay">
      <span aria-hidden="true" className={cn('size-2 rounded-full', session.mode === 'paused' ? STATUS_DOT_CLASS.warn : STATUS_DOT_CLASS.ok)} />
      <span>{t(`meetingBlock.${session.mode === 'paused' ? 'paused' : 'recording'}`)}</span>
      <span className="tabular-nums" aria-label={t('meetingBlock.elapsed')}>{meetingTime(session.elapsedMs)}</span>
      <Button size="xs" variant="ghost" onClick={() => session.mode === 'paused' ? session.resume() : session.pause()}>{t(`meetingBlock.${session.mode === 'paused' ? 'resume' : 'pause'}`)}</Button>
      <Button size="xs" variant="ghost" onClick={() => session.stop()}>{t('meetingBlock.stop')}</Button>
      <Button size="xs" variant="ghost" onClick={() => selectPageAtBlock(session.pageId, session.blockId)}>{t('meetingBlock.goToMeeting')}</Button>
    </div>)}
  </aside>;
}
