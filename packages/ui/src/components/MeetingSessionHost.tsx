import {useEffect, useState, useSyncExternalStore} from 'react';
import {useData} from '@/data';
import {useHud, useNavigation} from '@/providers';
import {STATUS_DOT_CLASS} from '@/lib/statusStyles';
import {cn} from '@/lib/utils';
import {useCanWrite} from '@/lib/useCanWrite';
import {t} from '@/i18n';
import {activeSessions, meetingSessions, getVersion, meetingTime, setMeetingSessionClient, subscribe} from '@/blockeditor/meetingSessions';
import {useConfirm} from '@/providers/ConfirmProvider';
import {Button} from './ui/button';

/** App lifetime persistence bridge; navigation only detaches the block view. */
export function MeetingSessionHost() {
  const client = useData();
  const canWrite = useCanWrite();
  const {hud} = useHud();
  useEffect(() => {
    setMeetingSessionClient(client);
    return () => {
      activeSessions().forEach((session) => session.stop());
      setMeetingSessionClient(null);
    };
  }, [client]);
  useEffect(() => {
    if (!canWrite) activeSessions().forEach((session) => session.setReadOnly(true));
  }, [canWrite]);
  return hud.present.open ? null : <RecordingBubble canWrite={canWrite} />;
}

export function RecordingBubble({canWrite, presenting = false}: {canWrite: boolean; presenting?: boolean}) {
  const confirm = useConfirm();
  const {selectPageAtBlock} = useNavigation();
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const sessions = meetingSessions().filter((session) => (presenting || !session.visible) && ((session.unsaved || session.error) || (canWrite && !session.readOnly && ['recording', 'paused'].includes(session.mode))));
  const [, tick] = useState(0);
  const running = canWrite && sessions.some((session) => session.mode === 'recording');
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => tick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return <aside aria-label={t('meetingBlock.recordingSessions')} className="fixed bottom-4 right-4 z-menu pointer-events-auto flex max-w-full flex-col gap-2 print:hidden">
    <span className="sr-only" role="status" aria-live="polite">{sessions.map((session) => session.error || t(`meetingBlock.${session.unsaved && !session.active ? 'needsAttention' : session.mode === 'paused' ? 'paused' : 'recording'}`)).join(', ')}</span>
    {sessions.map((session) => <div key={`${session.pageId}:${session.blockId}`} className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-overlay">
      <span aria-hidden="true" className={cn('size-2 rounded-full', session.unsaved || session.error || session.mode === 'paused' ? STATUS_DOT_CLASS.warn : STATUS_DOT_CLASS.ok)} />
      <span>{session.error || (session.unsaved && !session.active ? t('meetingBlock.needsAttention') : t(`meetingBlock.${session.mode === 'paused' ? 'paused' : 'recording'}`))}</span>
      <span className="tabular-nums" aria-label={t('meetingBlock.elapsed')}>{meetingTime(session.elapsedMs)}</span>
      {canWrite && session.active && <Button size="xs" variant="ghost" onClick={() => session.mode === 'paused' ? session.resume() : session.pause()}>{t(`meetingBlock.${session.mode === 'paused' ? 'resume' : 'pause'}`)}</Button>}
      {session.active && <Button size="xs" variant="ghost" onClick={() => session.stop()}>{t('meetingBlock.stop')}</Button>}
      <Button size="xs" variant="ghost" onClick={() => selectPageAtBlock(session.pageId, session.blockId)}>{t('meetingBlock.goToMeeting')}</Button>
      {(session.unsaved || session.error) && <Button size="xs" variant="ghost" onClick={async () => {
        if (await confirm({title: t('meetingBlock.discardConfirm'), confirmText: t('meetingBlock.discard'), destructive: true})) session.discard();
      }}>{t('meetingBlock.discard')}</Button>}
    </div>)}
  </aside>;
}
