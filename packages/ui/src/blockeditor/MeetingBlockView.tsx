import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {t} from '@/i18n';
import {assetBridge, subscribeAssetBridge} from '@/lib/assetBridge';
import {getPageIdForDoc} from '@/lib/aiBridge';
import {blockChildren, blockProp, insertBlock} from './model';
import type {CustomBlockDef, CustomBlockProps} from './registry';
import {exportMeetingAudio} from './meetingAudioExport';
import {MeetingSummary} from './MeetingSummary';
import {MeetingHeader} from './MeetingHeader';
import {MeetingTranscript} from './MeetingTranscript';
import {MeetingTabs} from './MeetingTabs';
import {useKitLock} from './kit/lock';
import {KitFrame, NameDescriptionFields} from './kit/KitFrame';
import {meetingRecorder, type MeetingAudio, type MeetingSegment} from './meetingRecorder';

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
  const canTranscribe = useSyncExternalStore(subscribeAssetBridge, assetBridge.canTranscribe, assetBridge.canTranscribe);
  const control = <section className="obe-meeting" aria-label={t('meetingBlock.label')}>
    <MeetingHeader session={session} status={status} elapsed={elapsed} readOnly={readOnly} pageReadOnly={pageReadOnly} locked={locked} />
    {saved.length > 0 && <button type="button" disabled={exporting} aria-busy={exporting} onClick={async () => {
      setExporting(true); setExportError(false);
      try { await exportMeetingAudio(saved, blockProp<string>(block, 'title') || t('meetingBlock.label')); }
      catch { setExportError(true); }
      finally { setExporting(false); }
    }}>{t('meetingBlock.exportAudio')}</button>}
    {exportError && <p role="alert">{t('meetingBlock.exportAudioFailed')}</p>}
    {session.error && <p role="alert">{session.error}</p>}
    {!canTranscribe && <p>{t('meetingBlock.noAI')}</p>}
    <MeetingTabs status={status} attention={session.unsaved || session.chunks.some((c) => !!c.error)} hasSummary={!!blockProp<string>(block, 'summary')?.trim()}
      transcript={<MeetingTranscript saved={saved} completed={completed} transcript={transcript} session={session} readOnly={readOnly} canTranscribe={canTranscribe} />}
      summary={<MeetingSummary block={block} editor={editor} readOnly={readOnly} status={status} transcript={transcript} />}
      notes={<section className="obe-meeting-notes" aria-label={t('meetingBlock.notes')}><h4>{t('meetingBlock.notes')}</h4>{children}
        {!readOnly && !blockChildren(block)?.length && <button type="button" onClick={() => editor.doc.transact(() => {
          const notes = blockChildren(block);
          if (notes) insertBlock(editor.doc, notes, 0, {type: 'paragraph'});
        }, 'local')}>{t('meetingBlock.addNote')}</button>}</section>} />
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
